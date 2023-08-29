import { h, render } from "preact";

import { feedbackContainerId } from "./constants";
import { FeedbackDialog, FeedbackDialogProps } from "./FeedbackDialog";

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

export function openFeedbackForm(options: FeedbackDialogProps): void {
  const shadowRoot = attachDialogContainer();

  render(h(FeedbackDialog, options), shadowRoot);

  const dialog = shadowRoot.querySelector("dialog");

  if (dialog && !dialog.hasAttribute("open")) {
    dialog[options.isModal ? "showModal" : "show"]();
  }
}
