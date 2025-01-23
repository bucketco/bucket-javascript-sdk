import { Fragment, FunctionComponent, h } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import {
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "./packages/floating-ui-preact-dom";
import styles from "./Dialog.css?inline";
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

  isOpen: boolean;
  close: () => void;
  onDismiss?: () => void;

  containerId: string;

  children?: preact.ComponentChildren;
}

export function useDialog({
  onClose,
  onOpen,
  initialValue = false,
}: {
  onClose?: () => void;
  onOpen?: () => void;
  initialValue?: boolean;
} = {}) {
  const [isOpen, setIsOpen] = useState<boolean>(initialValue);
  return {
    isOpen,
    open: () => {
      setIsOpen(true);
      onOpen?.();
    },
    close: () => {
      setIsOpen(false);
      onClose?.();
    },
    toggle: () => {
      if (isOpen) onClose?.();
      else onOpen?.();
      setIsOpen((prev) => !prev);
    },
  };
}

export const Dialog: FunctionComponent<OpenDialogOptions> = ({
  position,
  isOpen,
  close,
  onDismiss,
  containerId,
  strategy,
  children,
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
    if (!dialogRef.current) return;
    if (isOpen && !dialogRef.current.hasAttribute("open")) {
      dialogRef.current[position.type === "MODAL" ? "showModal" : "show"]();
    }
    if (!isOpen && dialogRef.current.hasAttribute("open")) {
      dialogRef.current.close();
    }
  }, [dialogRef, isOpen, position.type]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
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
        {children && <Fragment>{children}</Fragment>}

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

export function DialogHeader({
  children,
}: {
  children: preact.ComponentChildren;
}) {
  return <header class="dialog-header">{children}</header>;
}

export function DialogContent({
  children,
}: {
  children: preact.ComponentChildren;
}) {
  return <div class="dialog-content">{children}</div>;
}
