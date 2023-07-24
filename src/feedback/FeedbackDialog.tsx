import { h, FunctionComponent } from "preact";
import { FeedbackForm } from "./feedback-form";
import { Feedback, FeedbackDialogOptions } from "./types";
import styles from "./FeedbackDialog.css?inline";
import { Logo } from "../icons/Logo";

export const FeedbackDialog: FunctionComponent<FeedbackDialogOptions> = ({
  title,
  onSubmit = () => {},
}) => {
  const handleSubmit = (feedback: Feedback) => {
    // TODO: Submit to Bucket

    onSubmit(feedback);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      <dialog class="dialog">
        <h2>{title}</h2>

        <FeedbackForm onSubmit={handleSubmit} />
        <footer>
          Powered by <Logo /> Bucket
        </footer>
      </dialog>
    </>
  );
};
