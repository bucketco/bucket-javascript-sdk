export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export type FeedbackPlacement =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

export type FeedbackPosition =
  | { type: "MODAL" }
  | { type: "DIALOG"; placement: FeedbackPlacement }
  | { type: "POPOVER"; anchor: HTMLElement | null };

export interface FeedbackSubmission {
  feedbackId?: string;
  score: number;
  comment: string;
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
  onScoreSubmit?: (data: {
    score: number;
    feedbackId?: string;
  }) => Promise<{ feedbackId: string }>; // TODO: clean up
  onClose?: () => void;
  onDismiss?: () => void;
}

export type FeedbackTranslations = {
  DefaultQuestionLabel: string;
  QuestionPlaceholder: string;
  ScoreStatusDescription: string;
  ScoreStatusReceived: string;
  ScoreVeryDissatisfiedLabel: string;
  ScoreDissatisfiedLabel: string;
  ScoreNeutralLabel: string;
  ScoreSatisfiedLabel: string;
  ScoreVerySatisfiedLabel: string;
  SuccessMessage: string;
  SendButton: string;
};
