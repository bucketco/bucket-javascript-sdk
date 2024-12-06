import { Fragment, FunctionComponent, h } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { DEFAULT_TRANSLATIONS } from "./config/defaultTranslations";
import { useTimer } from "./hooks/useTimer";
import { Close } from "./icons/Close";
import {
  arrow,
  autoPlacement,
  autoUpdate,
  offset,
  shift,
  useFloating,
} from "./packages/floating-ui-preact-dom";
import { feedbackContainerId } from "./constants";
import { FeedbackForm } from "./FeedbackForm";
import styles from "./index.css?inline";
import { RadialProgress } from "./RadialProgress";
import {
  FeedbackScoreSubmission,
  FeedbackSubmission,
  Offset,
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

const INACTIVE_DURATION_MS = 20 * 1000;
const SUCCESS_DURATION_MS = 3 * 1000;

export const FeedbackDialog: FunctionComponent<FeedbackDialogProps> = ({
  key,
  title = DEFAULT_TRANSLATIONS.DefaultQuestionLabel,
  position,
  translations = DEFAULT_TRANSLATIONS,
  openWithCommentVisible = false,
  onClose,
  onDismiss,
  onSubmit,
  onScoreSubmit,
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
      autoPlacement(),
      arrow({
        element: arrowRef,
      }),
    ],
  });

  let unanchoredPosition: Position = {};
  if (position.type === "DIALOG") {
    const offsetY = parseOffset(position.offset?.y);
    const offsetX = parseOffset(position.offset?.x);

    switch (position.placement) {
      case "top-left":
        unanchoredPosition = {
          top: offsetY,
          left: offsetX,
        };
        break;
      case "top-right":
        unanchoredPosition = {
          top: offsetY,
          right: offsetX,
        };
        break;
      case "bottom-left":
        unanchoredPosition = {
          bottom: offsetY,
          left: offsetX,
        };
        break;
      case "bottom-right":
        unanchoredPosition = {
          bottom: offsetY,
          right: offsetX,
        };
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
    autoClose.stop();
    onClose?.();
  }, [onClose]);

  const dismiss = useCallback(() => {
    close();
    onDismiss?.();
  }, [close, onDismiss]);

  const [feedbackId, setFeedbackId] = useState<string | undefined>(undefined);
  const [scoreState, setScoreState] = useState<
    "idle" | "submitting" | "submitted"
  >("idle");

  const submit = useCallback(
    async (data: Omit<FeedbackSubmission, "feedbackId">) => {
      await onSubmit({ ...data, feedbackId });
      autoClose.startWithDuration(SUCCESS_DURATION_MS);
    },
    [feedbackId, onSubmit],
  );

  const submitScore = useCallback(
    async (data: Omit<FeedbackScoreSubmission, "feedbackId">) => {
      if (onScoreSubmit !== undefined) {
        setScoreState("submitting");

        const res = await onScoreSubmit({ ...data, feedbackId });
        setFeedbackId(res.feedbackId);
        setScoreState("submitted");
      }
    },
    [feedbackId, onSubmit],
  );

  const autoClose = useTimer({
    enabled: position.type === "DIALOG",
    initialDuration: INACTIVE_DURATION_MS,
    onEnd: close,
  });

  useEffect(() => {
    // Only enable 'quick dismiss' for popovers
    if (position.type === "MODAL" || position.type === "DIALOG") return;

    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key == "Escape") {
        dismiss();
      }
    };

    const clickOutsideHandler = (e: MouseEvent) => {
      if (
        !(e.target instanceof Element) ||
        !e.target.closest(`#${feedbackContainerId}`)
      ) {
        dismiss();
      }
    };

    const observer = new MutationObserver((mutations) => {
      if (position.anchor === null) return;

      mutations.forEach((mutation) => {
        const removedNodes = Array.from(mutation.removedNodes);
        const hasBeenRemoved = removedNodes.some((node) => {
          return node === position.anchor || node.contains(position.anchor);
        });

        if (hasBeenRemoved) {
          close();
        }
      });
    });

    window.addEventListener("mousedown", clickOutsideHandler);
    window.addEventListener("keydown", escapeHandler);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
    });

    return () => {
      window.removeEventListener("mousedown", clickOutsideHandler);
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
        <FeedbackForm
          t={{ ...DEFAULT_TRANSLATIONS, ...translations }}
          key={key}
          question={title}
          openWithCommentVisible={openWithCommentVisible}
          onSubmit={submit}
          onScoreSubmit={submitScore}
          scoreState={scoreState}
          onInteraction={autoClose.stop}
        />

        <button onClick={dismiss} class="close">
          {!autoClose.stopped && autoClose.elapsedFraction > 0 && (
            <RadialProgress
              diameter={28}
              progress={1.0 - autoClose.elapsedFraction}
            />
          )}
          <Close />
        </button>

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

function parseOffset(offsetInput?: Offset["x"] | Offset["y"]) {
  if (offsetInput === undefined) return "1rem";
  if (typeof offsetInput === "number") return offsetInput + "px";

  return offsetInput;
}
