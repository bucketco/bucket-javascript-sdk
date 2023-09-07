import Cookies from "js-cookie";

export const markPromptMessageCompleted = (
  userId: string,
  promptId: string,
) => {
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 10);

  Cookies.set(`bucket-prompt-${userId}`, promptId, {
    // Don't show the same prompt again
    expires: expiry,
  });
};

export const checkPromptMessageCompleted = (
  userId: string,
  promptId: string,
) => {
  const id = Cookies.get(`bucket-prompt-${userId}`);
  return id === promptId;
};
