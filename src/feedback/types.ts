export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export type FeedbackPlacement =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

export type FeedbackPosition =
  | { type: "MODAL" }
  | { type: "DIALOG"; placement: FeedbackPlacement }
  | { type: "POPOVER"; anchor: HTMLElement };

export interface Feedback {
  score: number;
  comment: string;
}

export interface FeedbackDialogOptions {
  featureId: string;
  userId: string;
  companyId?: string;
  title?: string;
  position: FeedbackPosition;
  quickDismiss?: boolean;
  onSubmit?: (data: Feedback) => Promise<any>;
  onClose?: () => void;
}
