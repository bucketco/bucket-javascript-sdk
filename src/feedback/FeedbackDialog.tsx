import { Fragment, FunctionComponent, h } from "preact";
import { useEffect, useRef } from "preact/hooks";

import { Logo } from "./icons/Logo";
import {
  arrow,
  autoUpdate,
  offset,
  shift,
  useFloating,
} from "./packages/floating-ui-preact-dom";
import { feedbackContainerId } from "./constants";
import { FeedbackForm } from "./FeedbackForm";
import styles from "./index.css?inline";
import {
  OpenFeedbackFormOptions,
  WithRequired,
  FeedbackPosition,
} from "./types";

type Position = Partial<
  Record<"top" | "left" | "right" | "bottom", number | string>
>;

export type FeedbackDialogProps = WithRequired<
  OpenFeedbackFormOptions,
  "onSubmit"
>;

const DEFAULT_POSITION: FeedbackPosition = {
  type: "DIALOG",
  placement: "bottom-right",
};

export const FeedbackDialog: FunctionComponent<FeedbackDialogProps> = ({
  featureId,
  title = "How satisfied are you with this feature?",
  position = DEFAULT_POSITION,
  onSubmit,
  onClose,
}) => {
  const arrowRef = useRef<HTMLDivElement>(null);
  const anchor = position.type === "POPOVER" ? position.anchor : null;
  const {
    refs,
    floatingStyles,
    middlewareData,
    placement: actualPlacement,
  } = useFloating({
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
  if (position.type === "DIALOG") {
    switch (position.placement) {
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
  }

  const { x: arrowX, y: arrowY } = middlewareData.arrow ?? {};

  const staticSide =
    {
      top: "bottom",
      right: "left",
      bottom: "top",
      left: "right",
    }[actualPlacement.split("-")[0]] || "bottom";

  const arrowStyles = {
    left: arrowX != null ? `${arrowX}px` : "",
    top: arrowY != null ? `${arrowY}px` : "",
    right: "",
    bottom: "",
    [staticSide]: "-4px",
  };

  useEffect(() => {
    // Only enable 'quick dismiss' for popovers
    if (position.type === "MODAL" || position.type === "DIALOG") return;

    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key == "Escape") {
        const dialog = refs.floating.current as HTMLDialogElement | null;
        dialog?.close();
        onClose?.();
      }
    };
    const clickOutsideHandler = (e: MouseEvent) => {
      const dialog = refs.floating.current as HTMLDialogElement | null;
      if (
        !(e.target instanceof Element) ||
        !e.target.closest(`#${feedbackContainerId}`)
      ) {
        dialog?.close();
        onClose?.();
      }
    };
    window.addEventListener("click", clickOutsideHandler);
    window.addEventListener("keydown", escapeHandler);
    return () => {
      window.removeEventListener("click", clickOutsideHandler);
      window.removeEventListener("keydown", escapeHandler);
    };
  }, [position.type]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      <dialog
        ref={refs.setFloating}
        class={[
          "dialog",
          position.type === "MODAL"
            ? "modal"
            : anchor
            ? "anchored"
            : "unanchored",
          actualPlacement,
        ].join(" ")}
        style={anchor ? floatingStyles : unanchoredPosition}
      >
        <FeedbackForm key={featureId} question={title} onSubmit={onSubmit} />
        <footer class="plug">
          Powered by <Logo /> Bucket
        </footer>
        {anchor && (
          <div
            ref={arrowRef}
            class={["arrow", actualPlacement].join(" ")}
            style={arrowStyles}
          ></div>
        )}
      </dialog>
    </>
  );
};
