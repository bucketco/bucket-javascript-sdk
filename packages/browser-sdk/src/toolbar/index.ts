import { h, render } from "preact";

import { BucketClient } from "../client";
import { toolbarContainerId } from "../ui/constants";
import { Position } from "../ui/types";
import { attachDialogContainer } from "../ui/utils";

import Toolbar from "./Toolbar";
// import { OpenFeedbackFormOptions } from "./types";

interface OpenToolbarOptions {
  position?: Position;
  bucketClient: BucketClient;
}

export const DEFAULT_POSITION: Position = {
  type: "DIALOG",
  placement: "bottom-left",
};

export function openToolbar(options: OpenToolbarOptions): void {
  const shadowRoot = attachDialogContainer(toolbarContainerId);
  const position = options.position || DEFAULT_POSITION;

  if (position.type === "POPOVER") {
    if (!position.anchor) {
      console.warn(
        "[Bucket]",
        "Unable to open popover. Anchor must be a defined DOM-element",
      );
      return;
    }

    if (!document.body.contains(position.anchor)) {
      console.warn(
        "[Bucket]",
        "Unable to open popover. Anchor must be an attached DOM-element",
      );
      return;
    }
  }

  render(h(Toolbar, { ...options, position }), shadowRoot);

  const dialog = shadowRoot.querySelector("dialog");

  if (dialog && !dialog.hasAttribute("open")) {
    dialog[position.type === "MODAL" ? "showModal" : "show"]();
  }
}
