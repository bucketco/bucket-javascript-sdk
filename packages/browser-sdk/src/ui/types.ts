import { Placement } from "./packages/floating-ui-preact-dom/types";

export type DialogPlacement =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

export type PopoverPlacement = Placement;

export type Offset = {
  /**
   * Offset from the nearest horizontal screen edge after placement is resolved
   */
  x?: string | number;
  /**
   * Offset from the nearest vertical screen edge after placement is resolved
   */
  y?: string | number;
};

export type Position =
  | { type: "MODAL" }
  | {
      type: "DIALOG";
      placement: DialogPlacement;
      offset?: Offset;
    }
  | {
      type: "POPOVER";
      anchor: HTMLElement | null;
      placement?: PopoverPlacement;
    };
