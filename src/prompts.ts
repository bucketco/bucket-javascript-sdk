import { FeedbackPrompt } from "./types";

export const parsePromptMessage = (
  message: any,
): FeedbackPrompt | undefined => {
  if (
    typeof message?.question !== "string" ||
    !message.question.length ||
    typeof message?.showAfter !== "number" ||
    typeof message?.showBefore !== "number"
  ) {
    return undefined;
  } else {
    return {
      question: message.question,
      showAfter: new Date(message.showAfter),
      showBefore: new Date(message.showBefore),
    };
  }
};
