import fetch from "cross-fetch";
import { isForNode } from "is-bundling-for-browser-or-node";

import type { FeedbackPosition, FeedbackTranslations } from "./feedback/types";
import {
  API_HOST,
  FLAG_EVENTS_PER_MIN,
  SDK_VERSION,
  SDK_VERSION_HEADER_NAME,
  SSE_REALTIME_HOST,
} from "./config";
import { createDefaultFeedbackPromptHandler } from "./default-feedback-prompt-handler";
import * as feedbackLib from "./feedback";
import { FeatureFlagsOptions, Flag, Flags } from "./flags";
import { getFlags, mergeDeep } from "./flags-fetch";
import { getAuthToken } from "./prompt-storage";
import {
  FeedbackPromptCompletionHandler,
  parsePromptMessage,
  processPromptMessage,
} from "./prompts";
import { readonly as proxify } from "./proxy";
import rateLimited from "./rate-limiter";
import { AblySSEChannel, closeAblySSEChannel, openAblySSEChannel } from "./sse";
import type {
  Company,
  Context,
  Feedback,
  FeedbackPrompt,
  FeedbackPromptHandler,
  FeedbackPromptHandlerCallbacks,
  FeedbackPromptReplyHandler,
  Key,
  Options,
  RequestFeedbackOptions,
  TrackedEvent,
  User,
} from "./types";

async function postRequest(url: string, body: any) {
  return fetch(url, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      [SDK_VERSION_HEADER_NAME]: SDK_VERSION,
    },
    body: JSON.stringify(body),
  });
}

const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

export default function main() {
  let debug = false;
  let publishableKey: string | undefined = undefined;
  let host: string = API_HOST;
  let sseHost: string = SSE_REALTIME_HOST;
  let sessionUserId: string | undefined = undefined;
  let persistUser: boolean = !isForNode;
  let liveSatisfactionActive: boolean = false;
  let sseChannel: AblySSEChannel | undefined = undefined;
  let liveSatisfactionEnabled: boolean = !isForNode;
  let feedbackPromptHandler: FeedbackPromptHandler | undefined = undefined;
  let feedbackPromptingUserId: string | undefined = undefined;
  let feedbackPosition: FeedbackPosition | undefined = undefined;
  let feedbackTranslations: Partial<FeedbackTranslations> | undefined =
    undefined;

  log("Instance created");

  function getUrl() {
    return `${host}/${publishableKey}`;
  }

  function makeUrl(part: string, params?: URLSearchParams) {
    params = params || new URLSearchParams();
    params.set("publishableKey", publishableKey!);

    return `${host}/${part}?${params}`;
  }

  function checkKey() {
    if (!publishableKey) {
      err("Publishable key is not set, please call init() first");
    }
  }

  function getSessionUser() {
    if (!sessionUserId) {
      err(
        "User is not set, please call user() first or provide userId as argument",
      );
    }
    return sessionUserId;
  }

  function log(message: string, ...args: any[]) {
    if (debug) {
      console.log("[Bucket]", message, ...args);
    }
  }

  function warn(message: string, ...args: any[]) {
    console.warn("[Bucket]", message, ...args);
  }

  function err(message: string, ...args: any[]): never {
    if (debug) {
      console.error("[Bucket]", message, ...args);
    }
    throw new Error(message);
  }

  function resolveUser(userId?: string): string | never {
    if (userId) {
      return userId;
    }

    if (persistUser) {
      return getSessionUser();
    } else {
      err("No userId provided and persistUser is disabled");
    }
  }

  /**
   * Initialize the Bucket SDK.
   *
   * Must be called before calling other SDK methods.
   *
   * @param key Your Bucket publishable key
   * @param options
   */
  function init(key: Key, options: Options = {}) {
    reset();
    if (!key) {
      err("Publishable key was not provided");
    }

    publishableKey = key;

    if (options.debug) debug = options.debug;
    if (options.host) host = options.host;
    if (options.sseHost) sseHost = options.sseHost;

    if (options.feedback?.ui?.position) {
      feedbackPosition = options.feedback?.ui?.position;
    }

    if (options.feedback?.ui?.translations) {
      feedbackTranslations = options.feedback?.ui?.translations;
    }

    if (typeof options.persistUser !== "undefined") {
      persistUser = options.persistUser;
    }

    if (typeof options.feedback?.enableLiveFeedback !== "undefined") {
      liveSatisfactionEnabled = options.feedback.enableLiveFeedback;
    }

    if (typeof options.feedback?.enableLiveSatisfaction !== "undefined") {
      liveSatisfactionEnabled = options.feedback.enableLiveSatisfaction;
    }

    if (liveSatisfactionEnabled && isForNode) {
      err("Feedback prompting is not supported in Node.js environment");
    }

    if (liveSatisfactionEnabled && !persistUser) {
      err("Feedback prompting is not supported when persistUser is disabled");
    }

    feedbackPromptHandler =
      options.feedback?.liveFeedbackHandler ??
      options.feedback?.liveSatisfactionHandler ??
      createDefaultFeedbackPromptHandler(options.feedback?.ui);

    log(`initialized with key "${publishableKey}" and options`, options);
  }

  /**
   * Identify the current user in Bucket, so they are tracked against each `track` call and receive Live Satisfaction events.
   *
   * @param userId The ID you use to identify this user
   * @param attributes Any attributes you want to attach to the user in Bucket
   * @param context
   */
  async function user(
    userId: string,
    attributes?: Record<string, any>,
    context?: Context,
  ) {
    checkKey();
    if (!userId) err("No userId provided");
    if (persistUser) {
      if (sessionUserId && sessionUserId !== userId) {
        reset();
      }
      sessionUserId = userId;
      if (liveSatisfactionEnabled && !liveSatisfactionActive) {
        await initLiveSatisfaction(userId);
      }
    }
    const payload: User = {
      userId,
      attributes,
      context,
    };
    const res = await postRequest(`${getUrl()}/user`, payload);
    log(`sent user`, res);
    return res;
  }

  /**
   * Identify the current user's company in Bucket, so it is tracked against each `track` call.
   *
   * @param companyId The ID you use to identify this company
   * @param attributes Any attributes you want to attach to the company in Bucket
   * @param userId The ID you use to identify the current user
   * @param context
   */
  async function company(
    companyId: string,
    attributes?: Record<string, any> | null,
    userId?: string,
    context?: Context,
  ) {
    checkKey();
    if (!companyId) err("No companyId provided");
    userId = resolveUser(userId);

    const payload: Company = {
      userId,
      companyId,
      context,
    };
    if (attributes) payload.attributes = attributes;
    const res = await postRequest(`${getUrl()}/company`, payload);
    log(`sent company`, res);
    return res;
  }

  /**
   * Track an event in Bucket.
   *
   * @param eventName The name of the event
   * @param attributes Any attributes you want to attach to the event
   * @param userId The ID you use to identify the current user
   * @param companyId The ID you use to identify the current user's company
   * @param context
   */
  async function track(
    eventName: string,
    attributes?: Record<string, any> | null,
    userId?: string,
    companyId?: string,
    context?: Context,
  ) {
    checkKey();
    if (!eventName) err("No eventName provided");
    userId = resolveUser(userId);

    const payload: TrackedEvent = {
      userId,
      event: eventName,
      companyId,
      context,
    };
    if (attributes) payload.attributes = attributes;
    const res = await postRequest(`${getUrl()}/event`, payload);
    log(`sent event`, res);
    return res;
  }

  /**
   * Submit user feedback to Bucket. Must include either `score` or `comment`, or both.
   *
   * @param options
   * @returns
   */
  async function feedback({
    feedbackId,
    featureId,
    question,
    score,
    userId,
    companyId,
    comment,
    promptId,
    promptedQuestion,
    source,
  }: Feedback) {
    checkKey();
    if (!featureId) err("No featureId provided");
    if (!score && !comment) err("Either 'score' or 'comment' must be provided");
    userId = resolveUser(userId);

    const payload: Feedback & { userId: string } = {
      feedbackId,
      userId,
      featureId,
      score,
      companyId,
      comment,
      promptId,
      question,
      promptedQuestion,
      source: source ?? "sdk",
    };

    const res = await postRequest(`${getUrl()}/feedback`, payload);
    log(`sent feedback`, res);
    return res;
  }

  /**
   * @deprecated Use `initLiveSatisfaction` instead
   */
  const initLiveFeedback = initLiveSatisfaction;

  /**
   * Start receiving Live Satisfaction feedback prompts.
   *
   * This doesn't need to be called unless you set `enableLiveSatisfaction` to false when calling `init`.
   *
   * @param userId The ID you use to identify the user
   */
  async function initLiveSatisfaction(userId?: string) {
    checkKey();

    if (isForNode) {
      err("Feedback prompting is not supported in Node.js environment");
    }

    if (liveSatisfactionActive) {
      err("Feedback prompting already initialized. Use reset() first.");
    }

    if (isMobile) {
      warn("Feedback prompting is not supported on mobile devices");
      return;
    }

    userId = resolveUser(userId);

    const existingAuth = getAuthToken(userId);
    let channel = existingAuth?.channel;

    // while initializing, consider the channel active
    liveSatisfactionActive = true;
    try {
      if (!channel) {
        const res = await postRequest(`${getUrl()}/feedback/prompting-init`, {
          userId,
        });

        log(`feedback prompting status sent`, res);
        const body: { success: boolean; channel?: string } = await res.json();
        if (!body.success || !body.channel) {
          log(`feedback prompting not enabled`);
          return res;
        }

        channel = body.channel;
      }

      log(`feedback prompting enabled`, channel);

      sseChannel = openAblySSEChannel(
        `${getUrl()}/feedback/prompting-auth`,
        userId,
        channel,
        (message) => handleFeedbackPromptRequest(userId!, message),
        { debug, sseHost },
      );

      feedbackPromptingUserId = userId;

      log(`feedback prompting connection established`);
    } finally {
      // check that SSE channel has actually been opened, otherwise reset the value
      liveSatisfactionActive = !!sseChannel;
    }
    return channel;
  }

  function handleFeedbackPromptRequest(userId: string, message: any) {
    const parsed = parsePromptMessage(message);
    if (!parsed) {
      err(`invalid feedback prompt message received`, message);
    } else {
      if (
        !processPromptMessage(userId, parsed, async (u, m, cb) => {
          await feedbackPromptEvent({
            promptId: parsed.promptId,
            featureId: parsed.featureId,
            promptedQuestion: parsed.question,
            event: "received",
            userId,
          });
          await triggerFeedbackPrompt(u, m, cb);
        })
      ) {
        log(
          `feedback prompt not shown, it was either expired or already processed`,
          message,
        );
      }
    }
  }

  async function triggerFeedbackPrompt(
    userId: string,
    message: FeedbackPrompt,
    completionHandler: FeedbackPromptCompletionHandler,
  ) {
    let feedbackId: string | undefined = undefined;

    if (feedbackPromptingUserId !== userId) {
      log(
        `feedback prompt not shown, received for another user`,
        userId,
        message,
      );
      return;
    }

    await feedbackPromptEvent({
      promptId: message.promptId,
      featureId: message.featureId,
      promptedQuestion: message.question,
      event: "shown",
      userId,
    });

    const replyCallback: FeedbackPromptReplyHandler = async (reply) => {
      if (!reply) {
        await feedbackPromptEvent({
          promptId: message.promptId,
          featureId: message.featureId,
          event: "dismissed",
          userId,
          promptedQuestion: message.question,
        });

        completionHandler();
        return;
      }

      const response = await feedback({
        feedbackId: feedbackId,
        featureId: message.featureId,
        userId,
        companyId: reply.companyId,
        score: reply.score,
        comment: reply.comment,
        promptId: message.promptId,
        question: reply.question,
        promptedQuestion: message.question,
        source: "prompt",
      });

      completionHandler();
      return await response.json();
    };

    const handlers: FeedbackPromptHandlerCallbacks = {
      reply: replyCallback,
      openFeedbackForm: (options) => {
        feedbackLib.openFeedbackForm({
          key: message.featureId,
          title: message.question,
          onScoreSubmit: async (data) => {
            const res = await replyCallback(data);
            feedbackId = res.feedbackId;
            return { feedbackId: res.feedbackId };
          },
          onSubmit: async (data) => {
            await replyCallback(data);
            options.onAfterSubmit?.(data);
          },
          onDismiss: () => replyCallback(null),
          position: feedbackPosition,
          translations: feedbackTranslations,
          ...options,
        });
      },
    };

    feedbackPromptHandler?.(message, handlers);
  }

  async function feedbackPromptEvent(args: {
    event: "received" | "shown" | "dismissed";
    featureId: string;
    promptId: string;
    promptedQuestion: string;
    userId: string;
  }) {
    checkKey();
    if (!args.promptId) err("No promptId provided");
    if (!args.event) err("No event provided");

    const payload = {
      action: args.event,
      featureId: args.featureId,
      promptId: args.promptId,
      userId: args.userId,
      promptedQuestion: args.promptedQuestion,
    };

    const res = await postRequest(
      `${getUrl()}/feedback/prompt-events`,
      payload,
    );
    log(`sent prompt event`, res);
    return res;
  }

  /**
   * Display the Bucket feedback form UI programmatically.
   *
   * This can be used to collect feedback from users in Bucket in cases where Live Satisfaction isn't appropriate.
   *
   * @param options
   */
  function requestFeedback(options: RequestFeedbackOptions) {
    if (isForNode) {
      err("requestFeedback can only be called in the browser");
    }

    if (!options.featureId) {
      err("No featureId provided");
    }

    const userId = resolveUser(options.userId);

    // Wait a tick before opening the feedback form,
    // to prevent the same click from closing it.
    setTimeout(() => {
      feedbackLib.openFeedbackForm({
        key: options.featureId,
        title: options.title,
        position: options.position ?? feedbackPosition,
        translations: options.translations ?? feedbackTranslations,
        openWithCommentVisible: options.openWithCommentVisible,
        onClose: options.onClose,
        onDismiss: options.onDismiss,
        onScoreSubmit: async (data) => {
          const res = await feedback({
            featureId: options.featureId,
            userId,
            companyId: options.companyId,
            source: "widget",
            ...data,
          });

          const json = await res.json();
          return { feedbackId: json.feedbackId };
        },
        onSubmit: async (data) => {
          // Default onSubmit handler
          await feedback({
            featureId: options.featureId,
            userId,
            companyId: options.companyId,
            source: "widget",
            ...data,
          });

          options.onAfterSubmit?.(data);
        },
      });
    }, 1);
  }

  /**
   * Retrieve feature flags given the specified context.
   *
   *
   * @param context The context to evaluate the feature flags against.
   *                This should take the form of `{ user: { id }, company: { id } }`
   *                plus anything additional you want to be able to evaluate flags against.
   *                In the browser, if a `user` call has been made the `user.id` will be
   *                used automatically and merged with anything provided in the `context`
   *                argument.
   * @param fallbackFlags Optional array of flags to use if the request to Bucket fails.
   * @param timeoutMs Optional the timeout in milliseconds for the request to Bucket before using `fallbackFlags`. Default is 5000ms.
   * @param staleWhileRevalidate Optional whether to return potentially stale flags while revalidating the flags in the background. Default is true.
   */
  async function getFeatureFlags({
    context,
    fallbackFlags = [],
    timeoutMs,
    staleWhileRevalidate = true,
  }: FeatureFlagsOptions): Promise<Flags> {
    const baseContext = {
      user: { id: sessionUserId },
    };

    const mergedContext = mergeDeep(baseContext, context);

    let flags = await getFlags({
      apiBaseUrl: getUrl(),
      context: mergedContext,
      timeoutMs,
      staleWhileRevalidate,
    });

    if (!flags) {
      warn(`failed to fetch feature flags, using fall-back flags`);
      flags = fallbackFlags.reduce((acc, flag) => {
        acc[flag.key] = flag;
        return acc;
      }, {} as Flags);
    }

    return proxify(flags, rateLimited(FLAG_EVENTS_PER_MIN, sendCheckEvent));
  }

  function sendCheckEvent(_: keyof Flag, flag: Flag) {
    void featureFlagEvent({
      action: "check",
      flagKey: flag.key,
      flagVersion: flag.version,
      evalResult: flag.value,
    });
  }

  /**
   * Send a feature flags event.
   *
   *
   * @param action The saction that was taken, either "evaluate" or "check".
   *        "evaluate" is used when the flag is evaluated, and "check" is used when the flag is checked (after it has been evaluated).
   * @param flagKey The key of the flag that was evaluated or checked.
   * @param flagVersion The version of the flag that was evaluated or checked. Can be undefined if the flag is a fallback flag and version
   *        is not known.
   * @param evalResult The result of the flag evaluation.
   * @param evalContext Optional context that was used to evaluate the flag.
   * @param evalRuleResults Optional results of each rule that was evaluated.
   * @param evalMissingFields Optional list of missing fields that were required to evaluate the flag.
   */

  async function featureFlagEvent(args: {
    action: "evaluate" | "check";
    flagKey: string;
    flagVersion: number | undefined;
    evalResult: boolean;
    evalContext?: Record<string, any>;
    evalRuleResults?: boolean[];
    evalMissingFields?: string[];
  }) {
    checkKey();

    const payload = {
      action: args.action,
      flagKey: args.flagKey,
      flagVersion: args.flagVersion,
      evalContext: args.evalContext,
      evalResult: args.evalResult,
      evalRuleResults: args.evalRuleResults,
      evalMissingFields: args.evalMissingFields,
    };

    const res = await postRequest(makeUrl("flags/events"), payload);

    log(`sent flag event`, res);

    return res;
  }

  /**
   * Reset the active user and disconnect from Live Satisfaction events.
   */
  function reset() {
    sessionUserId = undefined;
    feedbackPromptingUserId = undefined;
    liveSatisfactionActive = false;
    if (sseChannel) {
      closeAblySSEChannel(sseChannel);
      log(`feedback prompting connection closed`);

      sseChannel = undefined;
    }
  }

  return {
    // lifecycle
    init,
    reset,
    version: SDK_VERSION,
    // requests
    user,
    company,
    track,
    feedback,
    // feedback prompting
    requestFeedback,
    initLiveSatisfaction,
    initLiveFeedback,
    // feature flags
    getFeatureFlags,
    featureFlagEvent,
  };
}
