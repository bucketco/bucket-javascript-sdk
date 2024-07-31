export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export type FeedbackPlacement =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

export type Offset = {
  /**
   * Offset from the nearest horizontal screen edge after placement is resolved
   */
  x?: string | number;
  /**
   * Offset from the nearest vertical screen edge after placement is resolved
   */
  y?: string | number;
};

export type FeedbackPosition =
  | { type: "MODAL" }
  | { type: "DIALOG"; placement: FeedbackPlacement; offset?: Offset }
  | { type: "POPOVER"; anchor: HTMLElement | null };

export interface FeedbackSubmission {
  question: string;
  feedbackId?: string;
  score: number;
  comment: string;
}

export interface FeedbackScoreSubmission {
  feedbackId?: string;
  question: string;
  score: number;
}

export interface OnScoreSubmitResult {
  feedbackId: string;
}

export interface OpenFeedbackFormOptions {
  key: string;
  title?: string;

  /**
   * Control the placement and behavior of the feedback form.
   */
  position?: FeedbackPosition;

  /**
   * Add your own custom translations for the feedback form.
   * Undefined translation keys fall back to english defaults.
   */
  translations?: Partial<FeedbackTranslations>;

  /**
   * Open the form with both the score and comment fields visible.
   * Defaults to `false`
   */
  openWithCommentVisible?: boolean;

  onSubmit: (data: FeedbackSubmission) => Promise<void> | void;
  onScoreSubmit?: (
    data: FeedbackScoreSubmission,
  ) => Promise<OnScoreSubmitResult>;
  onClose?: () => void;
  onDismiss?: () => void;
}

export type FeedbackTranslations = {
  DefaultQuestionLabel: string;
  QuestionPlaceholder: string;
  ScoreStatusDescription: string;
  ScoreStatusLoading: string;
  ScoreStatusReceived: string;
  ScoreVeryDissatisfiedLabel: string;
  ScoreDissatisfiedLabel: string;
  ScoreNeutralLabel: string;
  ScoreSatisfiedLabel: string;
  ScoreVerySatisfiedLabel: string;
  SuccessMessage: string;
  SendButton: string;
};
