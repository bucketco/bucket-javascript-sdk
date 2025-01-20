import { Fragment, FunctionComponent, h } from "preact";
import { useCallback, useEffect, useRef } from "preact/hooks";

import {
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "./packages/floating-ui-preact-dom";
import { Position } from "./types";
import { parseUnanchoredPosition } from "./utils";

type CssPosition = Partial<
  Record<"top" | "left" | "right" | "bottom", number | string>
>;

export interface OpenDialogOptions {
  /**
   * Control the placement and behavior of the dialog.
   */
  position: Position;

  strategy?: "fixed" | "absolute";

  open: boolean;

  onClose?: () => void;
  onDismiss?: () => void;

  containerId: string;

  DialogContent: preact.FunctionComponent<{
    close: () => void;
    onClose?: () => void;
    dismiss: () => void;
  }>;
}

export const Dialog: FunctionComponent<OpenDialogOptions> = ({
  position,
  open,
  onClose,
  onDismiss,
  containerId,
  DialogContent,
  strategy,
}) => {
  const arrowRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
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
    strategy,
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
    unanchoredPosition = parseUnanchoredPosition(position);
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

  function setDiagRef(node: HTMLDialogElement | null) {
    refs.setFloating(node);
    dialogRef.current = node;
  }

  useEffect(() => {
    if (open) {
      if (dialogRef.current && !dialogRef.current.hasAttribute("open")) {
        dialogRef.current[position.type === "MODAL" ? "showModal" : "show"]();
      }
    }
  }, [dialogRef, open, position.type]);

  return (
    <>
      <dialog
        ref={setDiagRef}
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
        <DialogContent close={close} dismiss={dismiss} onClose={onClose} />

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
