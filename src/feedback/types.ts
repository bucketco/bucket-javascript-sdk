export interface Feedback {
  rating: number;
  comment: string;
}

export interface FeedbackDialogOptions {
  featureId: string;
  title: string;
  isModal?: boolean;
  onSubmit?: (data: Feedback) => void;
  onClose?: () => void;
}
