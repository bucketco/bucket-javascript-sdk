import Cookies from "js-cookie";

export const markPromptMessageCompleted = (
  userId: string,
  promptId: string,
  expiresAt: Date,
) => {
  Cookies.set(`bucket-prompt-${userId}`, promptId, {
    expires: expiresAt,
    sameSite: "strict",
    secure: true,
  });
};

export const checkPromptMessageCompleted = (
  userId: string,
  promptId: string,
) => {
  const id = Cookies.get(`bucket-prompt-${userId}`);
  return id === promptId;
};

export const rememberAuthToken = (
  userId: string,
  channel: string,
  token: string,
  expiresAt: Date,
) => {
  Cookies.set(`bucket-token-${userId}`, `${channel}:${token}`, {
    expires: expiresAt,
    sameSite: "strict",
    secure: true,
  });
};

export const getAuthToken = (userId: string) => {
  const val = Cookies.get(`bucket-token-${userId}`);
  if (!val) {
    return undefined;
  }

  const [channel, token] = val.split(":");
  if (!channel?.length || !token?.length) {
    throw new Error(`Invalid token: ${val}`);
  }

  return {
    channel,
    token,
  };
};
