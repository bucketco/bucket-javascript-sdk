import {
  ComputePositionConfig,
  ComputePositionReturn,
  arrow,
  computePosition,
  flip,
  offset,
} from "@floating-ui/dom";
import { RefCallback } from "preact";
import { useCallback, useRef, useState } from "preact/hooks";

export const usePositionHook = (anchor: HTMLElement | null | undefined) => {
  const prevOptions = useRef<Partial<ComputePositionConfig>>();
  const [computedPosition, setComputedPosition] =
    useState<ComputePositionReturn>();
  const floatingRef = useCallback<RefCallback<HTMLDialogElement>>(
    (element) => {
      if (!anchor || !element) return;
      const options = {
        placement: "top",
        middleware: [flip(), offset(8)],
      } satisfies ComputePositionConfig;
      const arrowElement = element.querySelector(".arrow");
      if (arrowElement) {
        options.middleware.push(arrow({ element: arrowElement }));
      }
      computePosition(anchor, element, options).then(setComputedPosition);
      prevOptions.current = options;
    },
    [anchor]
  );
  return { computedPosition, floatingRef };
};
