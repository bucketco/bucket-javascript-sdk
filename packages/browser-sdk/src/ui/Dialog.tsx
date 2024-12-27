import { Fragment, FunctionComponent, h } from "preact";
import { useCallback, useEffect, useRef } from "preact/hooks";

import { Offset } from "../../ui/types";

import {
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "./packages/floating-ui-preact-dom";
import { Position } from "./types";

type CssPosition = Partial<
  Record<"top" | "left" | "right" | "bottom", number | string>
>;

export interface OpenDialogOptions {
  key: string;

  /**
   * Control the placement and behavior of the dialog.
   */
  position: Position;

  onClose?: () => void;
  onDismiss?: () => void;

  containerId: string;

  styles: string;

  DialogContent: preact.FunctionComponent<{
    close: () => void;
    onClose: () => void;
    dismiss: () => void;
  }>;
}

export const Dialog: FunctionComponent<OpenDialogOptions> = ({
  position,
  onClose,
  onDismiss,
  containerId,
  DialogContent,
  styles,
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
      flip({
        padding: 10,
        mainAxis: true,
        crossAxis: true,
        fallbackAxisSideDirection: "end",
      }),
      shift(),
      offset(8),
      arrow({
        element: arrowRef,
      }),
    ],
  });

  let unanchoredPosition: CssPosition = {};
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
    onClose?.();
  }, [onClose]);

  const dismiss = useCallback(() => {
    close();
    onDismiss?.();
  }, [close, onDismiss]);

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
        !e.target.closest(`#${containerId}`)
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
        <DialogContent close={close} dismiss={dismiss} />

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
