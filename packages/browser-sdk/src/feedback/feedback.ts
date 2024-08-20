import { HttpClient } from "../httpClient";
import { Logger } from "../logger";
import { AblySSEChannel, openAblySSEChannel } from "../sse";

import {
  FeedbackPosition,
  FeedbackSubmission,
  FeedbackTranslations,
  OpenFeedbackFormOptions,
} from "./ui/types";
import {
  FeedbackPromptCompletionHandler,
  parsePromptMessage,
  processPromptMessage,
} from "./prompts";
import { getAuthToken } from "./promptStorage";
import { DEFAULT_POSITION } from "./ui";
import * as feedbackLib from "./ui";

export type Key = string;

export type FeedbackOptions = {
  enableAutoSurveys?: boolean;
  autoSurveysHandler?: FeedbackPromptHandler;
  ui?: {
    /**
     * Control the placement and behavior of the feedback form.
     */
    position?: FeedbackPosition;

    /**
     * Add your own custom translations for the feedback form.
     * Undefined translation keys fall back to english defaults.
     */
    translations?: Partial<FeedbackTranslations>;
  };

  // Deprecated
  enableLiveSatisfaction?: boolean;
  liveSatisfactionHandler?: FeedbackPromptHandler;
};

export function handleDeprecatedFeedbackOptions(
  opts?: FeedbackOptions,
): FeedbackOptions {
  return {
    ...opts,
    enableAutoSurveys: opts?.enableAutoSurveys ?? opts?.enableLiveSatisfaction,
    autoSurveysHandler:
      opts?.autoSurveysHandler ?? opts?.liveSatisfactionHandler,
  };
}

export interface RequestFeedbackOptions
  extends Omit<OpenFeedbackFormOptions, "key" | "onSubmit"> {
  /**
   * Bucket feature ID
   */
  featureId: string;

  /**
   * User ID from your own application.
   */
  userId: string;

  /**
   * Company ID from your own application.
   */
  companyId?: string;

  /**
   * Allows you to handle a copy of the already submitted
   * feedback.
   *
   * This can be used for side effects, such as storing a
   * copy of the feedback in your own application or CRM.
   *
   * @param {Object} data
   * @param data.
   */
  onAfterSubmit?: (data: FeedbackSubmission) => void;
}

export type Feedback = {
  /**
   * Bucket feedback ID
   */
  feedbackId?: string;

  /**
   * Bucket feature ID
   */
  featureId: string;

  /**
   * User ID from your own application.
   */
  userId?: string;

  /**
   * Company ID from your own application.
   */
  companyId?: string;

  /**
   * The question that was presented to the user.
   */
  question?: string;

  /**
   * The original question.
   * This only needs to be populated if the feedback was submitted through the Automated Feedback Surveys channel.
   */
  promptedQuestion?: string;

  /**
   * Customer satisfaction score.
   */
  score?: number;

  /**
   * User supplied comment about your feature.
   */
  comment?: string;

  /**
   * Bucket feedback prompt ID.
   *
   * This only exists if the feedback was submitted
   * as part of an automated prompt from Bucket.
   *
   * Used for internal state management of automated
   * feedback.
   */
  promptId?: string;

  /**
   * Source of the feedback, depending on how the user was asked
   * - `prompt` - Feedback submitted by a Automated Feedback Surveys prompt
   * - `widget` - Feedback submitted via `requestFeedback`
   * - `sdk` - Feedback submitted via `feedback`
   */
  source?: "prompt" | "sdk" | "widget";
};

export type FeedbackPrompt = {
  question: string;
  showAfter: Date;
  showBefore: Date;
  promptId: string;
  featureId: string;
};

export type FeedbackPromptReply = {
  question: string;
  companyId?: string;
  score?: number;
  comment?: string;
};

export type FeedbackPromptReplyHandler = <T extends FeedbackPromptReply | null>(
  reply: T,
) => T extends null ? Promise<void> : Promise<{ feedbackId: string }>;

export type FeedbackPromptHandlerOpenFeedbackFormOptions = Omit<
  RequestFeedbackOptions,
  "featureId" | "userId" | "companyId" | "onClose" | "onDismiss"
>;

export type FeedbackPromptHandlerCallbacks = {
  reply: FeedbackPromptReplyHandler;
  openFeedbackForm: (
    options: FeedbackPromptHandlerOpenFeedbackFormOptions,
  ) => void;
};

export type FeedbackPromptHandler = (
  prompt: FeedbackPrompt,
  handlers: FeedbackPromptHandlerCallbacks,
) => void;

export const createDefaultFeedbackPromptHandler = (
  options: FeedbackPromptHandlerOpenFeedbackFormOptions = {},
): FeedbackPromptHandler => {
  return (_prompt: FeedbackPrompt, handlers) => {
    handlers.openFeedbackForm(options);
  };
};
export const DEFAULT_FEEDBACK_CONFIG = {
  promptHandler: createDefaultFeedbackPromptHandler(),
  feedbackPosition: DEFAULT_POSITION,
  translations: {},
  autoSurveysEnabled: true,
};

export async function feedback(
  httpClient: HttpClient,
  logger: Logger,
  payload: Feedback,
) {
  if (!payload.score && !payload.comment) {
    logger.error("either 'score' or 'comment' must be provided");
    return;
  }

  if (!payload.userId) {
    logger.error("`feedback` call ignored, no user id given");
    return;
  }

  // set default source to sdk
  const feedbackPayload = {
    ...payload,
    source: payload.source ?? "sdk",
  };

  const res = await httpClient.post({
    path: `/feedback`,
    body: feedbackPayload,
  });
  logger.debug(`sent feedback`, res);
  return res;
}

export class AutoSurveys {
  private initialized = false;
  private sseChannel: AblySSEChannel | null = null;

  constructor(
    private sseHost: string,
    private logger: Logger,
    private httpClient: HttpClient,
    private feedbackPromptHandler: FeedbackPromptHandler = createDefaultFeedbackPromptHandler(),
    private userId: string,
    private position: FeedbackPosition = DEFAULT_POSITION,
    private feedbackTranslations: Partial<FeedbackTranslations> = {},
  ) {}

  /**
   * Start receiving Automated Feedback Surveys feedback prompts.
   */
  async initialize() {
    if (this.initialized) {
      this.logger.error("feedback prompting already initialized");
      return;
    }
    this.initialized = true;

    const channel = await this.getChannel();
    if (!channel) return;

    try {
      this.logger.debug(`feedback prompting enabled`, channel);
      this.sseChannel = openAblySSEChannel({
        userId: this.userId,
        channel,
        httpClient: this.httpClient,
        callback: (message) =>
          this.handleFeedbackPromptRequest(this.userId, message),
        logger: this.logger,
        sseHost: this.sseHost,
      });
      this.logger.debug(`feedback prompting connection established`);
    } catch (e) {
      this.logger.error(`error initializing feedback prompting`, e);
    }
  }

  private async getChannel() {
    const existingAuth = getAuthToken(this.userId);
    const channel = existingAuth?.channel;

    if (channel) {
      return channel;
    }

    try {
      if (!channel) {
        const res = await this.httpClient.post({
          path: `/feedback/prompting-init`,
          body: {
            userId: this.userId,
          },
        });

        this.logger.debug(`feedback prompting status sent`, res);
        if (res.ok) {
          const body: { success: boolean; channel?: string } = await res.json();
          if (body.success && body.channel) {
            return body.channel;
          }
        }
      }
    } catch (e) {
      this.logger.error(`error initializing feedback prompting`, e);
      return;
    }
    return;
  }

  handleFeedbackPromptRequest(userId: string, message: any) {
    const parsed = parsePromptMessage(message);
    if (!parsed) {
      this.logger.error(`invalid feedback prompt message received`, message);
    } else {
      if (
        !processPromptMessage(userId, parsed, async (u, m, cb) => {
          await this.feedbackPromptEvent({
            promptId: parsed.promptId,
            featureId: parsed.featureId,
            promptedQuestion: parsed.question,
            event: "received",
            userId,
          });
          await this.triggerFeedbackPrompt(u, m, cb);
        })
      ) {
        this.logger.info(
          `feedback prompt not shown, it was either expired or already processed`,
          message,
        );
      }
    }
  }

  stop() {
    if (this.sseChannel) {
      this.sseChannel.close();
      this.sseChannel = null;
    }
  }

  async triggerFeedbackPrompt(
    userId: string,
    message: FeedbackPrompt,
    completionHandler: FeedbackPromptCompletionHandler,
  ) {
    let feedbackId: string | undefined = undefined;

    await this.feedbackPromptEvent({
      promptId: message.promptId,
      featureId: message.featureId,
      promptedQuestion: message.question,
      event: "shown",
      userId,
    });

    const replyCallback: FeedbackPromptReplyHandler = async (reply) => {
      if (!reply) {
        await this.feedbackPromptEvent({
          promptId: message.promptId,
          featureId: message.featureId,
          event: "dismissed",
          userId,
          promptedQuestion: message.question,
        });

        completionHandler();
        return;
      }

      const feedbackPayload = {
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
      } satisfies Feedback;

      const response = await feedback(
        this.httpClient,
        this.logger,
        feedbackPayload,
      );

      completionHandler();

      if (response && response.ok) {
        return await response?.json();
      }
      return;
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
          position: this.position,
          translations: this.feedbackTranslations,
          ...options,
        });
      },
    };

    this.feedbackPromptHandler(message, handlers);
  }

  async feedbackPromptEvent(args: {
    event: "received" | "shown" | "dismissed";
    featureId: string;
    promptId: string;
    promptedQuestion: string;
    userId: string;
  }) {
    const payload = {
      action: args.event,
      featureId: args.featureId,
      promptId: args.promptId,
      userId: args.userId,
      promptedQuestion: args.promptedQuestion,
    };

    const res = await this.httpClient.post({
      path: `/feedback/prompt-events`,
      body: payload,
    });
    this.logger.debug(`sent prompt event`, res);
    return res;
  }
}
