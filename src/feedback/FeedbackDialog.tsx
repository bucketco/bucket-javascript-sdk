import { h, FunctionComponent } from "preact";
import { FeedbackForm } from "./FeedbackForm";
import { Feedback, FeedbackDialogOptions } from "./types";
import { Logo } from "./icons/Logo";

import styles from "./index.css?inline";
import { autoUpdate, offset, shift, useFloating, arrow } from "../floating";
import { useRef } from "preact/hooks";

type Position = Partial<
  Record<"top" | "left" | "right" | "bottom", number | string>
>;

export const FeedbackDialog: FunctionComponent<FeedbackDialogOptions> = ({
  title = "How satisfied are you with this feature?",
  isModal = false,
  anchor = null,
  placement: propPlacement = "bottom-right",
  onSubmit = () => {},
}) => {
  const arrowRef = useRef<HTMLDivElement>(null);
  const { refs, floatingStyles, middlewareData, placement } = useFloating({
    elements: {
      reference: anchor,
    },
    transform: false,
    whileElementsMounted: autoUpdate,
    middleware: [
      shift(),
      offset(8),
      arrow({
        element: arrowRef,
      }),
    ],
  });

  let unanchoredPosition: Position = {};
  switch (propPlacement) {
    case "top-left":
      unanchoredPosition = { top: "1rem", left: "1rem" };
      break;
    case "top-right":
      unanchoredPosition = { top: "1rem", right: "1rem" };
      break;
    case "bottom-left":
      unanchoredPosition = { bottom: "1rem", left: "1rem" };
      break;
    case "bottom-right":
      unanchoredPosition = { bottom: "1rem", right: "1rem" };
      break;
  }

  const { x: arrowX, y: arrowY } = middlewareData.arrow ?? {};

  const staticSide =
    {
      top: "bottom",
      right: "left",
      bottom: "top",
      left: "right",
    }[placement.split("-")[0]] || "bottom";

  const arrowStyles = {
    left: arrowX != null ? `${arrowX}px` : "",
    top: arrowY != null ? `${arrowY}px` : "",
    right: "",
    bottom: "",
    [staticSide]: "-4px",
  };

  const handleSubmit = (feedback: Feedback) => {
    // TODO: Submit to Bucket

    onSubmit(feedback);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      <dialog
        ref={refs.setFloating}
        class={[
          "dialog",
          isModal ? "modal" : anchor ? "anchored" : "unanchored",
          placement,
        ].join(" ")}
        style={anchor ? floatingStyles : unanchoredPosition}
      >
        <FeedbackForm question={title} onSubmit={handleSubmit} />
        <footer class="plug">
          Powered by <Logo /> Bucket
        </footer>
        {anchor && (
          <div
            ref={arrowRef}
            class={["arrow", placement].join(" ")}
            style={arrowStyles}
          ></div>
        )}
      </dialog>
    </>
  );
};
