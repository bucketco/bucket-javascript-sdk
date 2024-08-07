import { FeedbackPrompt } from "./feedback";
import {
  checkPromptMessageCompleted,
  markPromptMessageCompleted,
} from "./promptStorage";

export const parsePromptMessage = (
  message: any,
): FeedbackPrompt | undefined => {
  if (
    typeof message?.question !== "string" ||
    !message.question.length ||
    typeof message.showAfter !== "number" ||
    typeof message.showBefore !== "number" ||
    typeof message.promptId !== "string" ||
    !message.promptId.length ||
    typeof message.featureId !== "string" ||
    !message.featureId.length
  ) {
    return undefined;
  } else {
    return {
      question: message.question,
      showAfter: new Date(message.showAfter),
      showBefore: new Date(message.showBefore),
      promptId: message.promptId,
      featureId: message.featureId,
    };
  }
};

export type FeedbackPromptCompletionHandler = () => void;
export type FeedbackPromptDisplayHandler = (
  userId: string,
  prompt: FeedbackPrompt,
  completionHandler: FeedbackPromptCompletionHandler,
) => void;

export const processPromptMessage = (
  userId: string,
  prompt: FeedbackPrompt,
  displayHandler: FeedbackPromptDisplayHandler,
) => {
  const now = new Date();

  const completionHandler = () => {
    markPromptMessageCompleted(userId, prompt.promptId, prompt.showBefore);
  };

  if (checkPromptMessageCompleted(userId, prompt.promptId)) {
    return false;
  } else if (now > prompt.showBefore) {
    return false;
  } else if (now < prompt.showAfter) {
    setTimeout(() => {
      displayHandler(userId, prompt, completionHandler);
    }, prompt.showAfter.getTime() - now.getTime());

    return true;
  } else {
    displayHandler(userId, prompt, completionHandler);
    return true;
  }
};
