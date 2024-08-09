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
  channels: string[],
  token: string,
  expiresAt: Date,
) => {
  Cookies.set(`bucket-token-${userId}`, JSON.stringify({ channels, token }), {
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

  try {
    const { channels, token } = JSON.parse(val) as {
      channels: string[];
      token: string;
    };
    if (!channels?.length || !token?.length) {
      return undefined;
    }
    return {
      channels,
      token,
    };
  } catch (e) {
    return undefined;
  }
};

export const forgetAuthToken = (userId: string) => {
  Cookies.remove(`bucket-token-${userId}`);
};
