import type {
  ComputePositionConfig,
  ComputePositionReturn,
  VirtualElement,
} from "@floating-ui/dom";
import { h, RefObject } from "preact";

export { arrow, Options as ArrowOptions } from "./arrow";
export { useFloating } from "./useFloating";
export type {
  AlignedPlacement,
  Alignment,
  AutoPlacementOptions,
  AutoUpdateOptions,
  Axis,
  Boundary,
  ClientRectObject,
  ComputePositionConfig,
  ComputePositionReturn,
  Coords,
  DetectOverflowOptions,
  Dimensions,
  ElementContext,
  ElementRects,
  Elements,
  FlipOptions,
  FloatingElement,
  HideOptions,
  InlineOptions,
  Length,
  Middleware,
  MiddlewareArguments,
  MiddlewareData,
  MiddlewareReturn,
  MiddlewareState,
  NodeScroll,
  OffsetOptions,
  Padding,
  Placement,
  Platform,
  Rect,
  ReferenceElement,
  RootBoundary,
  ShiftOptions,
  Side,
  SideObject,
  SizeOptions,
  Strategy,
  VirtualElement,
} from "@floating-ui/dom";
export {
  autoPlacement,
  autoUpdate,
  computePosition,
  detectOverflow,
  flip,
  getOverflowAncestors,
  hide,
  inline,
  limitShift,
  offset,
  platform,
  shift,
  size,
} from "@floating-ui/dom";

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type UseFloatingData = Prettify<
  ComputePositionReturn & { isPositioned: boolean }
>;

export type ReferenceType = Element | VirtualElement;

export type UseFloatingReturn<RT extends ReferenceType = ReferenceType> =
  Prettify<
    UseFloatingData & {
      /**
       * Update the position of the floating element, re-rendering the component
       * if required.
       */
      update: () => void;
      /**
       * Pre-configured positioning styles to apply to the floating element.
       */
      floatingStyles: h.JSX.CSSProperties;
      /**
       * Object containing the reference and floating refs and reactive setters.
       */
      refs: {
        /**
         * A React ref to the reference element.
         */
        reference: RefObject<RT | null>;
        /**
         * A React ref to the floating element.
         */
        floating: RefObject<HTMLElement | null>;
        /**
         * A callback to set the reference element (reactive).
         */
        setReference: (node: RT | null) => void;
        /**
         * A callback to set the floating element (reactive).
         */
        setFloating: (node: HTMLElement | null) => void;
      };
      elements: {
        reference: RT | null;
        floating: HTMLElement | null;
      };
    }
  >;

export type UseFloatingOptions<RT extends ReferenceType = ReferenceType> =
  Prettify<
    Partial<ComputePositionConfig> & {
      /**
       * A callback invoked when both the reference and floating elements are
       * mounted, and cleaned up when either is unmounted. This is useful for
       * setting up event listeners (e.g. pass `autoUpdate`).
       */
      whileElementsMounted?: (
        reference: RT,
        floating: HTMLElement,
        update: () => void,
      ) => () => void;
      elements?: {
        reference?: RT | null;
        floating?: HTMLElement | null;
      };
      /**
       * The `open` state of the floating element to synchronize with the
       * `isPositioned` value.
       */
      open?: boolean;
      /**
       * Whether to use `transform` for positioning instead of `top` and `left`
       * (layout) in the `floatingStyles` object.
       */
      transform?: boolean;
    }
  >;
