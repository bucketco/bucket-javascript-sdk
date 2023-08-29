import { h } from "preact";
import { useState } from "preact/hooks";

import { Placement } from "../src/feedback/types";
import bucket from "../src/index";

bucket.init("123", {
  persistUser: false,
});

const ThemeButton = ({ theme }: { theme?: string }) => (
  <button
    onClick={() => {
      if (theme) document.documentElement.setAttribute("data-theme", theme);
      else document.documentElement.removeAttribute("data-theme");
    }}
  >
    Set {theme} theme
  </button>
);

export function App() {
  const [placement, setPlacement] = useState<Placement>("bottom-right");
  const [quickDismiss, setQuickDismiss] = useState<boolean>(true);
  return (
    <main style="display: flex; flex-direction: column; gap: 20px;">
      <h1>Bucket tracking playground</h1>

      <h2>Feedback theming</h2>
      <div style="display: flex; gap: 10px;">
        <ThemeButton theme="dark" />
        <ThemeButton theme="custom" />
        <ThemeButton theme="light" />
      </div>

      <h2>Feedback configs</h2>
      <div style="display: flex; gap: 10px;">
        <select
          onInput={(e) =>
            setPlacement((e.target as HTMLSelectElement).value as Placement)
          }
        >
          <option value="bottom-right">Bottom right</option>
          <option value="bottom-left">Bottom left</option>
          <option value="top-right">Top right</option>
          <option value="top-left">Top left</option>
        </select>
        <label>
          <input
            type="checkbox"
            checked={quickDismiss}
            onInput={(e) =>
              setQuickDismiss((e.target as HTMLInputElement).checked)
            }
          />
          Quick dismiss
        </label>
      </div>

      <h2>Feedback collection test</h2>
      <div style="display: flex; gap: 10px;">
        <button
          onClick={() => {
            bucket.openFeedbackForm({
              featureId: "featA",
              userId: "123",
              title: "Hello, how do you like the modal?",
              isModal: true,
              onSubmit: async (data) => console.log("Submitted data:", data),
              onClose: () => console.log("Closed dialog"),
            });
          }}
        >
          Open Modal
        </button>
        <button
          onClick={() => {
            bucket.openFeedbackForm({
              featureId: "featB",
              userId: "123",
              title: "Hello, how do you like the dialog?",
              placement,
              quickDismiss,
              onSubmit: async (data) => console.log("Submitted data:", data),
              onClose: () => console.log("Closed dialog"),
            });
          }}
        >
          Open Dialog
        </button>
        <button
          onClick={({ target }) => {
            bucket.openFeedbackForm({
              featureId: "featC",
              userId: "123",
              title: "Hello, how do you like the popover?",
              anchor: target as HTMLElement,
              quickDismiss,
              onSubmit: async (data) => console.log("Submitted data:", data),
              onClose: () => console.log("closed dialog"),
            });
          }}
        >
          Open Popover
        </button>
      </div>

      {Array.from({ length: 100 }).map((_) => (
        <br />
      ))}
    </main>
  );
}
