import Cookies from "js-cookie";

export const markPromptMessageCompleted = (
  userId: string,
  promptId: string,
  expiresAt: Date,
) => {
  Cookies.set(`prompt-${userId}`, promptId, { expires: expiresAt });
};

export const checkPromptMessageCompleted = (
  userId: string,
  promptId: string,
) => {
  const id = Cookies.get(`bucket-prompt-${userId}`);
  return id === promptId;
};
