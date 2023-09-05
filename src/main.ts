import fetch from "cross-fetch";
import { isForNode } from "is-bundling-for-browser-or-node";

import { version } from "../package.json";

import type { OpenFeedbackFormOptions } from "./feedback/types";
import { TRACKING_HOST } from "./config";
import * as feedbackLib from "./feedback";
import {
  FeedbackPromptCompletionHandler,
  parsePromptMessage,
  processPromptMessage,
} from "./prompts";
import { AblySSEChannel, closeAblySSEChannel, openAblySSEChannel } from "./sse";
import {
  Company,
  Context,
  Feedback,
  FeedbackPrompt,
  FeedbackPromptHandler,
  Key,
  Options,
  TrackedEvent,
  User,
} from "./types";

async function request(url: string, body: any) {
  return fetch(url, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Bucket-Sdk-Version": version,
    },
    body: JSON.stringify(body),
  });
}

export default function main() {
  let trackingKey: string | undefined = undefined;
  let trackingHost: string = TRACKING_HOST;
  let sessionUserId: string | undefined = undefined;
  let persistUser: boolean = !isForNode;
  let automaticFeedbackPrompting: boolean = false;
  let feedbackPromptHandler: FeedbackPromptHandler | undefined = undefined;
  let sseChannel: AblySSEChannel | undefined = undefined;
  let feedbackPromptingUserId: string | undefined = undefined;
  let debug = false;

  log("Instance created");

  function getUrl() {
    return `${trackingHost}/${trackingKey}`;
  }
  function checkKey() {
    if (!trackingKey) {
      err("Tracking key is not set, please call init() first");
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

  function err(message: string, ...args: any[]): never {
    if (debug) {
      console.error("[Bucket]", message, ...args);
    }
    throw new Error(message);
  }

  function resolveUser(userId?: User["userId"]): string | never {
    if (persistUser) {
      return getSessionUser();
    } else if (!userId) {
      err("No userId provided and persistUser is disabled");
    }

    return userId!;
  }

  // methods

  function init(key: Key, options?: Options) {
    reset();
    if (!key) {
      err("Tracking key was not provided");
    }
    trackingKey = key;
    if (options?.host) trackingHost = options.host;
    if (typeof options?.persistUser !== "undefined")
      persistUser = options.persistUser;
    if (options?.debug) debug = options.debug;
    if (options?.automaticFeedbackPrompting) {
      if (isForNode) {
        err("Feedback prompting is not supported in Node.js environment");
      }
      if (!persistUser) {
        err("Feedback prompting is not supported when persistUser is disabled");
      } else {
        automaticFeedbackPrompting = options.automaticFeedbackPrompting;
      }
    }
    if (options?.feedbackPromptHandler) {
      feedbackPromptHandler = options.feedbackPromptHandler;
    }
    log(`initialized with key "${trackingKey}" and options`, options);
  }

  async function user(
    userId: User["userId"],
    attributes?: User["attributes"],
    context?: Context,
  ) {
    checkKey();
    if (!userId) err("No userId provided");
    if (persistUser) {
      if (sessionUserId && sessionUserId !== userId) {
        reset();
      }
      sessionUserId = userId;
      if (automaticFeedbackPrompting && !sseChannel) {
        await initFeedbackPrompting(userId);
      }
    }
    const payload: User = {
      userId,
      attributes,
      context,
    };
    const res = await request(`${getUrl()}/user`, payload);
    log(`sent user`, res);
    return res;
  }

  async function company(
    companyId: Company["companyId"],
    attributes?: Company["attributes"] | null,
    userId?: Company["userId"],
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
    const res = await request(`${getUrl()}/company`, payload);
    log(`sent company`, res);
    return res;
  }

  async function track(
    eventName: TrackedEvent["event"],
    attributes?: TrackedEvent["attributes"] | null,
    userId?: Company["userId"],
    companyId?: Company["companyId"],
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
    const res = await request(`${getUrl()}/event`, payload);
    log(`sent event`, res);
    return res;
  }

  async function feedback({
    featureId,
    score,
    userId,
    companyId,
    comment,
    promptId,
  }: Feedback) {
    checkKey();
    if (!featureId) err("No featureId provided");
    if (!score && !comment) err("Either 'score' or 'comment' must be provided");
    userId = resolveUser(userId);

    const payload: Feedback & { userId: User["userId"] } = {
      userId,
      featureId,
      score,
      companyId,
      comment,
      promptId,
    };

    const res = await request(`${getUrl()}/feedback`, payload);
    log(`sent feedback`, res);
    return res;
  }

  async function initFeedbackPrompting(userId?: User["userId"]) {
    checkKey();
    if (isForNode) {
      err("Feedback prompting is not supported in Node.js environment");
    }

    if (sseChannel) {
      err("Feedback prompting already initialized. Use reset() first.");
    }
    userId = resolveUser(userId);

    const res = await request(`${getUrl()}/feedback/prompting-init`, {
      userId,
    });
    log(`feedback prompting status sent`, res);
    const body: { success: boolean; channel?: string } = await res.json();
    if (!body.success || !body.channel) {
      log(`feedback prompting not enabled`);
      return res;
    }

    log(`feedback prompting enabled`);

    feedbackPromptingUserId = userId;
    sseChannel = openAblySSEChannel(
      `${getUrl()}/feedback/prompting-auth`,
      userId,
      body.channel,
      (message) => handleFeedbackPromptRequest(userId!, message),
      { debug },
    );
    log(`feedback prompting connection established`);
    return res;
  }

  function handleFeedbackPromptRequest(userId: User["userId"], message: any) {
    const parsed = parsePromptMessage(message);
    if (!parsed) {
      err(`invalid feedback prompt message received`, message);
    } else {
      if (
        !processPromptMessage(userId, parsed, async (u, m, cb) => {
          await feedbackPromptEvent(parsed.promptId, "received", userId);
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
    userId: User["userId"],
    message: FeedbackPrompt,
    completionHandler: FeedbackPromptCompletionHandler,
  ) {
    if (feedbackPromptingUserId !== userId) {
      log(
        `feedback prompt not shown, received for another user`,
        userId,
        message,
      );
      return;
    }

    await feedbackPromptEvent(message.promptId, "shown", userId);

    feedbackPromptHandler?.(message, async (reply) => {
      if (!reply) {
        await feedbackPromptEvent(message.promptId, "dismissed", userId);
      } else {
        await feedback({
          featureId: message.featureId,
          userId,
          companyId: reply.companyId,
          score: reply.score,
          comment: reply.comment,
          promptId: message.promptId,
        });
      }

      completionHandler();
    });
  }

  async function feedbackPromptEvent(
    promptId: string,
    event: "received" | "shown" | "dismissed",
    userId: User["userId"],
  ) {
    checkKey();
    if (!promptId) err("No promptId provided");
    if (!event) err("No event provided");

    const payload = {
      userId,
      promptId,
      action: event,
    };

    const res = await request(`${getUrl()}/feedback/prompt-events`, payload);
    log(`sent prompt event`, res);
    return res;
  }

  function openFeedbackForm(options: OpenFeedbackFormOptions) {
    if (isForNode) {
      err("openFeedbackForm can only be called in the browser");
    }

    if (!options.featureId) err("No featureId provided");
    if (persistUser) {
      options.userId = getSessionUser();
    } else if (!options.userId) {
      err("No userId provided and persistUser is disabled");
    }

    // Wait a tick before opening the feedback form,
    // to prevent the same click from closing it.
    setTimeout(() => {
      feedbackLib.openFeedbackForm({
        onSubmit: async (data) => {
          // Default onSubmit handler
          await feedback({
            featureId: options.featureId,
            userId: options.userId,
            companyId: options.companyId,
            ...data,
          });
        },
        ...options,
      });
    }, 1);
  }

  function reset() {
    sessionUserId = undefined;
    feedbackPromptingUserId = undefined;
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
    // requests
    user,
    company,
    track,
    feedback,
    // feedback prompting
    openFeedbackForm,
    initFeedbackPrompting,
  };
}
