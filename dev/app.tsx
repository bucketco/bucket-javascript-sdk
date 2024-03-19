import { h } from "preact";
import { useState } from "preact/hooks";

import { FeedbackPlacement, FeedbackTranslations } from "../src/feedback/types";
import bucket from "../src/index";

bucket.init("123", {
  persistUser: false,
  feedback: {
    enableLiveSatisfaction: false,
  },
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

const CUSTOM_TRANSLATIONS: FeedbackTranslations = {
  DefaultQuestionLabel:
    "Dans quelle mesure êtes-vous satisfait de cette fonctionnalité ?",
  QuestionPlaceholder: "Comment pouvons-nous améliorer cette fonctionnalité ?",
  ScoreStatusDescription: "Choisissez une note et laissez un commentaire",
  ScoreStatusLoading: "Chargement...",
  ScoreStatusReceived: "La note a été reçue !",
  ScoreVeryDissatisfiedLabel: "Très insatisfait",
  ScoreDissatisfiedLabel: "Insatisfait",
  ScoreNeutralLabel: "Neutre",
  ScoreSatisfiedLabel: "Satisfait",
  ScoreVerySatisfiedLabel: "Très satisfait",
  SuccessMessage: "Merci d'avoir envoyé vos commentaires!",
  SendButton: "Envoyer",
};

export function App() {
  const [placement, setPlacement] = useState<FeedbackPlacement>("bottom-right");
  const [offsetLeft, setOffsetLeft] = useState("0px");
  const [offsetTop, setOffsetTop] = useState("0px");
  const [openWithCommentVisible, setOpenWithCommentVisible] = useState(false);
  const [customTranslations, setCustomTranslations] = useState(false);

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
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <label htmlFor="placement">Placement</label>
        <select
          id="placement"
          onInput={(e) =>
            setPlacement(e.currentTarget.value as FeedbackPlacement)
          }
        >
          <option value="bottom-right">Bottom right</option>
          <option value="bottom-left">Bottom left</option>
          <option value="top-right">Top right</option>
          <option value="top-left">Top left</option>
        </select>
        <label htmlFor="offsetLeft">Offset Left</label>
        <input
          id="offsetLeft"
          type="text"
          placeholder="Offset Left"
          value={offsetLeft}
          onChange={(e) => setOffsetLeft(e.currentTarget.value)}
        />
        <label htmlFor="offsetTop">Offset Top</label>
        <input
          id="offsetTop"
          type="text"
          placeholder="Offset Top"
          value={offsetTop}
          onChange={(e) => setOffsetTop(e.currentTarget.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={customTranslations}
            onInput={(e) => setCustomTranslations(e.currentTarget.checked)}
          />
          Use custom translations?
        </label>
        <label>
          <input
            type="checkbox"
            checked={openWithCommentVisible}
            onInput={(e) => setOpenWithCommentVisible(e.currentTarget.checked)}
          />
          Start with comment expanded?
        </label>
      </div>

      <h2>Feedback collection test</h2>
      <div style="display: flex; gap: 10px;">
        <button
          onClick={() => {
            bucket.requestFeedback({
              featureId: "featA",
              userId: "123",
              title: customTranslations
                ? "Bonjour, que pensez-vous du modal ?"
                : "Hello, how do you like the modal?",
              position: { type: "MODAL" },
              openWithCommentVisible: openWithCommentVisible,
              onAfterSubmit: async (data) => console.log("Submitted:", data),
              onClose: () => console.log("Closed dialog"),
              onDismiss: () => console.log("Dismissed dialog"),
              translations: customTranslations
                ? CUSTOM_TRANSLATIONS
                : undefined,
            });
          }}
        >
          Open Modal
        </button>
        <button
          onClick={() => {
            bucket.requestFeedback({
              featureId: "featB",
              userId: "123",
              title: customTranslations
                ? "Bonjour, que pensez-vous du dialog ?"
                : "Hello, how do you like the dialog?",
              position: {
                type: "DIALOG",
                placement,
                offset: {
                  left: offsetLeft,
                  top: offsetTop,
                },
              },
              openWithCommentVisible: openWithCommentVisible,
              onAfterSubmit: async (data) => console.log("Submitted:", data),
              onClose: () => console.log("Closed dialog"),
              onDismiss: () => console.log("Dismissed dialog"),
              translations: customTranslations
                ? CUSTOM_TRANSLATIONS
                : undefined,
            });
          }}
        >
          Open Dialog
        </button>
        <button
          onClick={({ currentTarget }) => {
            bucket.requestFeedback({
              featureId: "featC",
              userId: "123",
              title: customTranslations
                ? "Bonjour, que pensez-vous du popover ?"
                : "Hello, how do you like the popover?",
              position: { type: "POPOVER", anchor: currentTarget },
              openWithCommentVisible: openWithCommentVisible,
              onAfterSubmit: async (data) => console.log("Submitted:", data),
              onClose: () => console.log("Closed dialog"),
              onDismiss: () => console.log("Dismissed dialog"),
              translations: customTranslations
                ? CUSTOM_TRANSLATIONS
                : undefined,
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
