import { h, render } from "preact";

import { feedbackContainerId } from "./constants";
import { FeedbackDialog } from "./FeedbackDialog";
import { FeedbackPosition, OpenFeedbackFormOptions } from "./types";

const DEFAULT_POSITION: FeedbackPosition = {
  type: "DIALOG",
  placement: "bottom-right",
};

function attachDialogContainer() {
  let container = document.querySelector(`#${feedbackContainerId}`);

  if (!container) {
    container = document.createElement("div");
    container.attachShadow({ mode: "open" });
    (container as HTMLElement).style.all = "initial";
    container.id = feedbackContainerId;
    document.body.appendChild(container);
  }

  return container.shadowRoot!;
}

export function openFeedbackForm(options: OpenFeedbackFormOptions): void {
  const shadowRoot = attachDialogContainer();
  const position = options.position || DEFAULT_POSITION;

  render(h(FeedbackDialog, { ...options, position }), shadowRoot);

  const dialog = shadowRoot.querySelector("dialog");

  if (dialog && !dialog.hasAttribute("open")) {
    dialog[position.type === "MODAL" ? "showModal" : "show"]();
  }
}
