import { h } from "preact";
import bucket from "../src/index";
import { Button } from "../src/feedback/Button";

export function App() {
  return (
    <main style="display: flex; flex-direction: column; gap: 20px;">
      <h1>Hello Bucket feedback dialog</h1>

      <p>This is what the feedback form looks like:</p>

      <hr></hr>

      <div style="display: flex; gap: 10px;">
        <Button
          onClick={() => {
            document.documentElement.toggleAttribute("data-dark-mode");
          }}
        >
          Toggle Darkmode
        </Button>
        <Button
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
        </Button>
        <Button
          onClick={() => {
            bucket.collectFeedback({
              title: "Welcome back, how's FEATURE B?",
              featureId: "abc",
              onSubmit: (data) => console.log("Submitted data:", data),
              onClose: () => console.log("closed dialog"),
            });
          }}
        >
          Dialog feedback collection
        </Button>
      </div>
    </main>
  );
}
