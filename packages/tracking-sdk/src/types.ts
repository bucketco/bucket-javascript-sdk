import {
  FeedbackPosition,
  FeedbackSubmission,
  FeedbackTranslations,
  OpenFeedbackFormOptions,
} from "./feedback/types";

export type Key = string;

export type Options = {
  persistUser?: boolean;
  host?: string;
  sseHost?: string;
  debug?: boolean;
  feedback?: {
    /**
     * @deprecated Use `enableLiveSatisfaction` instead
     */
    enableLiveFeedback?: boolean;
    enableLiveSatisfaction?: boolean;
    /**
     * @deprecated Use `liveSatisfactionHandler` instead
     */
    liveFeedbackHandler?: FeedbackPromptHandler;
    liveSatisfactionHandler?: FeedbackPromptHandler;
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
  };
};

export type User = {
  userId: string;
  attributes?: {
    name?: string;
    [key: string]: any;
  };
  context?: Context;
};

export type Company = {
  userId: string;
  companyId: string;
  attributes?: {
    name?: string;
    [key: string]: any;
  };
  context?: Context;
};

export type TrackedEvent = {
  event: string;
  userId: string;
  companyId?: string;
  attributes?: Record<string, any>;
  context?: Context;
};

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
   * This only needs to be populated if the feedback was submitted through the Live Satisfaction channel.
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
   * - `prompt` - Feedback submitted by a Live Satisfaction prompt
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

export type Context = {
  active?: boolean;
};
