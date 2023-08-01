import { h } from "preact";
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
    Set theme {theme}
  </button>
);

export function App() {
  return (
    <main style="display: flex; flex-direction: column; gap: 20px;">
      <h1>Hello Bucket feedback dialog</h1>

      <p>This is what the feedback form looks like:</p>

      <hr></hr>

      <div style="display: flex; gap: 10px;">
        <ThemeButton theme="dark" />
        <ThemeButton theme="custom" />
        <ThemeButton theme="light" />
        <button
          onClick={() => {
            bucket.collectFeedback({
              featureId: "featA",
              userId: "123",
              title: "Hello, how do you like FEATURE A?",
              isModal: true,
              onSubmit: async (data) => console.log("Submitted data:", data),
              onClose: () => console.log("closed dialog"),
            });
          }}
        >
          Modal feedback collection
        </button>
        <button
          onClick={() => {
            bucket.collectFeedback({
              featureId: "featB",
              userId: "123",
              title: "Welcome back, how is FEATURE B?",
              onSubmit: async (data) => {
                console.log("Submitted data:", data);
              },
              onClose: () => console.log("closed dialog"),
            });
          }}
        >
          Dialog feedback collection
        </button>
        <button
          onClick={({ target }) => {
            bucket.collectFeedback({
              featureId: "featC",
              userId: "123",
              title: "Welcome back, how is FEATURE C?",
              anchor: target as HTMLElement,
              onSubmit: async (data) => console.log("Submitted data:", data),
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
