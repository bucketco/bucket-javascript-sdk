import {
  FeedbackPrompt,
  FeedbackPromptHandler,
  FeedbackPromptHandlerOpenFeedbackFormOptions,
} from "./types";

export const createDefaultFeedbackPromptHandler = (
  options: FeedbackPromptHandlerOpenFeedbackFormOptions = {},
): FeedbackPromptHandler => {
  return (_prompt: FeedbackPrompt, handlers) => {
    handlers.openFeedbackForm(options);
  };
};
