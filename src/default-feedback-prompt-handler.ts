import { FeedbackPrompt, FeedbackPromptHandler } from "./types";

export const defaultFeedbackPromptHandler: FeedbackPromptHandler = (
  prompt: FeedbackPrompt,
  handlers,
) => {
  handlers.openFeedbackForm({
    placement: "bottom-right",
    title: prompt.question,
  });
};
