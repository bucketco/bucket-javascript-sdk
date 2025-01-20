import { h, render } from "preact";

import { feedbackContainerId, propagatedEvents } from "../../ui/constants";
import { Position } from "../../ui/types";

import { FeedbackDialog } from "./FeedbackDialog";
import { OpenFeedbackFormOptions } from "./types";

export const DEFAULT_POSITION: Position = {
  type: "DIALOG",
  placement: "bottom-right",
};

function stopPropagation(e: Event) {
  e.stopPropagation();
}

function attachDialogContainer() {
  let container = document.querySelector(`#${feedbackContainerId}`);

  if (!container) {
    container = document.createElement("div");
    container.attachShadow({ mode: "open" });
    (container as HTMLElement).style.all = "initial";
    container.id = feedbackContainerId;
    document.body.appendChild(container);

    for (const event of propagatedEvents) {
      container.addEventListener(event, stopPropagation);
    }
  }

  return container.shadowRoot!;
}

export function openFeedbackForm(options: OpenFeedbackFormOptions): void {
  const shadowRoot = attachDialogContainer();
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

  render(h(FeedbackDialog, { ...options, position }), shadowRoot);
}
