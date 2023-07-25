export interface Feedback {
  score: number;
  comment: string;
}

export interface FeedbackDialogOptions {
  featureId: string;
  title: string;
  isModal?: boolean;
  anchor?: HTMLElement;
  placement?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  onSubmit?: (data: Feedback) => void;
  onClose?: () => void;
}
