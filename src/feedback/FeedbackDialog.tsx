import { Fragment, FunctionComponent, h } from "preact";
import { useCallback, useEffect, useRef } from "preact/hooks";

import { Close } from "./icons/Close";
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
  FeedbackTranslations,
  OpenFeedbackFormOptions,
  WithRequired,
} from "./types";

type Position = Partial<
  Record<"top" | "left" | "right" | "bottom", number | string>
>;

export type FeedbackDialogProps = WithRequired<
  OpenFeedbackFormOptions,
  "onSubmit" | "position"
>;

const DEFAULT_TRANSLATIONS: FeedbackTranslations = {
  DefaultQuestionLabel: "How satisfied are you with this feature?",
  QuestionPlaceholder: "How can we improve this feature?",
  CommentLabel: "Leave a comment (optional)",
  ScoreVeryDissatisfiedLabel: "Very dissatisfied",
  ScoreDissatisfiedLabel: "Dissatisfied",
  ScoreNeutralLabel: "Neutral",
  ScoreSatisfiedLabel: "Satisfied",
  ScoreVerySatisfiedLabel: "Very satisfied",
  SuccessMessage: "Thank you for sending your feedback!",
  SendButton: "Send",
};

export const FeedbackDialog: FunctionComponent<FeedbackDialogProps> = ({
  key,
  title = DEFAULT_TRANSLATIONS.DefaultQuestionLabel,
  position,
  translations = DEFAULT_TRANSLATIONS,
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

  const close = useCallback(() => {
    const dialog = refs.floating.current as HTMLDialogElement | null;
    dialog?.close();
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    // Only enable 'quick dismiss' for popovers
    if (position.type === "MODAL" || position.type === "DIALOG") return;

    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key == "Escape") {
        close();
      }
    };

    const clickOutsideHandler = (e: MouseEvent) => {
      if (
        !(e.target instanceof Element) ||
        !e.target.closest(`#${feedbackContainerId}`)
      ) {
        close();
      }
    };

    const observer = new MutationObserver((mutations) => {
      if (position.anchor === null) return;

      mutations.forEach((mutation) => {
        const removedNodes = Array.from(mutation.removedNodes);
        const hasBeenRemoved =
          removedNodes.includes(position.anchor!) ||
          removedNodes.some((r) => r.contains(position.anchor!));

        if (hasBeenRemoved) {
          close();
        }
      });
    });

    window.addEventListener("click", clickOutsideHandler);
    window.addEventListener("keydown", escapeHandler);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
    });

    return () => {
      window.removeEventListener("click", clickOutsideHandler);
      window.removeEventListener("keydown", escapeHandler);
      observer.disconnect();
    };
  }, [position.type, close]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      <dialog
        ref={refs.setFloating}
        class={[
          "dialog",
          position.type === "MODAL"
            ? "modal"
            : position.type === "POPOVER"
            ? "anchored"
            : `unanchored unanchored-${position.placement}`,
          actualPlacement,
        ].join(" ")}
        style={anchor ? floatingStyles : unanchoredPosition}
      >
        <button onClick={close} class="close">
          <Close />
        </button>

        <FeedbackForm
          t={{ ...DEFAULT_TRANSLATIONS, ...translations }}
          key={key}
          question={title}
          onSubmit={onSubmit}
        />

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
