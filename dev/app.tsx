import { h } from "preact";
import bucket from "../src/index";

export function App() {
  return (
    <main style="display: flex; flex-direction: column; gap: 20px;">
      <h1>Hello Bucket feedback dialog</h1>

      <p>This is what the feedback form looks like:</p>

      <hr></hr>

      <div style="display: flex; gap: 10px;">
        <button
          onClick={() => {
            document.documentElement.toggleAttribute("data-dark-mode");
          }}
        >
          Toggle Darkmode
        </button>
        <button
          onClick={() => {
            bucket.collectFeedback({
              isModal: true,
              title: "Hello, how do you like FEATURE A?",
              featureId: "abc",
              onSubmit: (data) => console.log("Submitted data:", data),
              onClose: () => console.log("closed dialog"),
            });
          }}
        >
          Modal feedback collection
        </button>
        <button
          onClick={({ target }) => {
            bucket.collectFeedback({
              title: "Welcome back, how is FEATURE B?",
              featureId: "abc",
              onSubmit: (data) => console.log("Submitted data:", data),
              onClose: () => console.log("closed dialog"),
            });
          }}
        >
          Dialog feedback collection
        </button>
        <button
          onClick={({ target }) => {
            bucket.collectFeedback({
              title: "Welcome back, how is FEATURE C?",
              featureId: "abc",
              anchor: target as HTMLElement,
              onSubmit: (data) => console.log("Submitted data:", data),
              onClose: () => console.log("closed dialog"),
            });
          }}
        >
          Dialog feedback anchored
        </button>
      </div>

      {Array.from({ length: 100 }).map((_, index) => (
        <br />
      ))}
    </main>
  );
}
