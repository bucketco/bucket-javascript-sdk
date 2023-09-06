import { FeedbackPrompt, FeedbackPromptHandler } from "./types";

export const defaultFeedbackPromptHandler: FeedbackPromptHandler = (
  _prompt: FeedbackPrompt,
  handlers,
) => {
  handlers.openFeedbackForm({
    position: {
      type: "DIALOG",
      placement: "bottom-left",
    },
  });
};
