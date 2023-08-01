export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export interface Feedback {
  score: number;
  comment: string;
}

export interface FeedbackDialogOptions {
  featureId: string;
  userId: string;
  companyId?: string;
  title?: string;
  isModal?: boolean;
  anchor?: HTMLElement;
  placement?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  quickDismiss?: boolean;
  onSubmit?: (data: Feedback) => Promise<any>;
  onClose?: () => void;
}
