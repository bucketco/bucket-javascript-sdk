import { propagatedEvents } from "./constants";

function stopPropagation(e: Event) {
  e.stopPropagation();
}

export function attachDialogContainer(containerId: string) {
  let container = document.querySelector(`#${containerId}`);

  if (!container) {
    container = document.createElement("div");
    container.attachShadow({ mode: "open" });
    (container as HTMLElement).style.all = "initial";
    container.id = containerId;
    document.body.appendChild(container);

    for (const event of propagatedEvents) {
      container.addEventListener(event, stopPropagation);
    }
  }

  return container.shadowRoot!;
}
