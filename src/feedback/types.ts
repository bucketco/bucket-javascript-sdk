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

  onSubmit: (data: FeedbackSubmission) => Promise<void> | void;
  onClose?: () => void;
  onDismiss?: () => void;
}

export type FeedbackTranslations = {
  DefaultQuestionLabel: string;
  QuestionPlaceholder: string;
  ScoreVeryDissatisfiedLabel: string;
  ScoreDissatisfiedLabel: string;
  ScoreNeutralLabel: string;
  ScoreSatisfiedLabel: string;
  ScoreVerySatisfiedLabel: string;
  SuccessMessage: string;
  SendButton: string;
};
