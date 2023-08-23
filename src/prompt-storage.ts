export const markPromptMessageCompleted = (
  userId: string,
  promptId: string,
) => {
  localStorage.setItem(`prompt-${userId}`, promptId);
};

export const checkPromptMessageCompleted = (
  userId: string,
  promptId: string,
) => {
  console.log(userId, promptId);
  const id = localStorage.getItem(`prompt-${userId}`);
  return id === promptId;
};
