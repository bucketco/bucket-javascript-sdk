import { h, FunctionComponent } from "preact";
import { FeedbackForm } from "./FeedbackForm";
import { Feedback, FeedbackDialogOptions } from "./types";
import { Logo } from "../icons/Logo";

import styles from "./index.css?inline";

export const FeedbackDialog: FunctionComponent<FeedbackDialogOptions> = ({
  title = "How satisfied are you with this feature?",
  isModal = false,
  anchor = null,
  placement = "bottom-right",
  onSubmit = () => {},
}) => {
  let position: Partial<
    Record<"top" | "left" | "right" | "bottom", number | string>
  > = {};
  if (anchor) {
    const anchorRect = anchor.getBoundingClientRect();
    position = {
      top: anchorRect.top + anchorRect.height,
      left: anchorRect.left,
    };
  } else {
    switch (placement) {
      case "top-left":
        position = { top: "1rem", left: "1rem" };
        break;
      case "top-right":
        position = { top: "1rem", right: "1rem" };
        break;
      case "bottom-left":
        position = { bottom: "1rem", left: "1rem" };
        break;
      case "bottom-right":
        position = { bottom: "1rem", right: "1rem" };
        break;
    }
  }

  const handleSubmit = (feedback: Feedback) => {
    // TODO: Submit to Bucket

    onSubmit(feedback);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      <dialog
        class={["dialog", isModal ? "modal" : "", anchor ? "popover" : ""].join(
          " "
        )}
        style={position}
      >
        <FeedbackForm question={title} onSubmit={handleSubmit} />
        <footer class="plug">
          Powered by <Logo /> Bucket
        </footer>
      </dialog>
    </>
  );
};
