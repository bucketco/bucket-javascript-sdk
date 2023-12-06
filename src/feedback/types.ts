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

export const FEEDBACK_STYLES_MAP = {
  fontSize: "--bucket-feedback-dialog-font-size",
  fontFamily: "--bucket-feedback-dialog-font-family",
  borderRadius: "--bucket-feedback-dialog-border-radius",
  backgroundColor: "--bucket-feedback-dialog-background-color",
  color: "--bucket-feedback-dialog-color",
  secondaryColor: "--bucket-feedback-dialog-secondary-color",
  border: "--bucket-feedback-dialog-border",
  primaryButtonBackgroundColor:
    "--bucket-feedback-dialog-primary-button-background-color",
  primaryButtonColor: "--bucket-feedback-dialog-primary-button-color",
  inputBorderColor: "--bucket-feedback-dialog-input-border-color",
  inputFocusBorderColor: "--bucket-feedback-dialog-input-focus-border-color",
  submittedCheckBackgroundColor:
    "--bucket-feedback-dialog-submitted-check-background-color",
  submittedCheckColor: "--bucket-feedback-dialog-submitted-check-color",
  tooltipColor: "--bucket-feedback-dialog-tooltip-color",
  tooltipBackgroundColor: "--bucket-feedback-dialog-tooltip-background-color",
  rating1Color: "--bucket-feedback-dialog-rating-1-color",
  rating1BackgroundColor: "--bucket-feedback-dialog-rating-1-background-color",
  rating2Color: "--bucket-feedback-dialog-rating-2-color",
  rating2BackgroundColor: "--bucket-feedback-dialog-rating-2-background-color",
  rating3Color: "--bucket-feedback-dialog-rating-3-color",
  rating3BackgroundColor: "--bucket-feedback-dialog-rating-3-background-color",
  rating4Color: "--bucket-feedback-dialog-rating-4-color",
  rating4BackgroundColor: "--bucket-feedback-dialog-rating-4-background-color",
  rating5Color: "--bucket-feedback-dialog-rating-5-color",
  rating5BackgroundColor: "--bucket-feedback-dialog-rating-5-background-color",
} as const;

export type FeedbackStyle = keyof typeof FEEDBACK_STYLES_MAP;

export type FeedbackStyles = {
  [K in FeedbackStyle]: string;
};
