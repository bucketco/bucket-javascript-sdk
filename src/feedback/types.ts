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

export interface Feedback {
  score: number;
  comment: string;
}

export interface OpenFeedbackFormOptions {
  key: string;
  title?: string;
  position?: FeedbackPosition;
  onSubmit: (data: Feedback) => Promise<void> | void;
  onAfterSubmit?: (data: Feedback) => void;
  onClose?: () => void;
}

export interface RequestFeedbackOptions
  extends Omit<OpenFeedbackFormOptions, "key" | "onSubmit"> {
  featureId: string;
  userId: string;
  companyId?: string;
}
