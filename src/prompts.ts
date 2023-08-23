import { FeedbackPrompt, User } from "./types";

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

const rememberMessage = (userId: string, promptId: string) => {
  localStorage.setItem(`prompt-${userId}`, promptId);
};

const seenMessage = (userId: string, promptId: string) => {
  const id = localStorage.getItem(`prompt-${userId}`);
  return id === promptId;
};

export type FeedbackPromptCompletionHandler = () => void;
export type FeedbackPromptDisplayHandler = (
  userId: User["userId"],
  prompt: FeedbackPrompt,
  completionHandler: FeedbackPromptCompletionHandler,
) => void;

export const processPromptMessage = (
  userId: User["userId"],
  prompt: FeedbackPrompt,
  displayHandler: FeedbackPromptDisplayHandler,
) => {
  const now = new Date();

  const completionHandler = () => {
    rememberMessage(userId, prompt.promptId);
  };

  if (seenMessage(userId, prompt.promptId)) {
    return false;
  } else if (now > prompt.showBefore) {
    rememberMessage(userId, prompt.promptId);
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
