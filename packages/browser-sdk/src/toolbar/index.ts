import { h, render } from "preact";

import { BucketClient } from "../client";
import { toolbarContainerId } from "../ui/constants";
import { attachContainer } from "../ui/utils";

import Toolbar from "./Toolbar";
import { ToolbarPosition } from "../ui/types";

type showToolbarToggleOptions = {
  bucketClient: BucketClient;
  position?: ToolbarPosition;
};

export const DEFAULT_PLACEMENT = "bottom-right" as const;

export function showToolbarToggle(options: showToolbarToggleOptions) {
  const shadowRoot = attachContainer(toolbarContainerId);
  const position: ToolbarPosition = options.position ?? {
    placement: DEFAULT_PLACEMENT,
  };

  render(h(Toolbar, { ...options, position }), shadowRoot);
}
