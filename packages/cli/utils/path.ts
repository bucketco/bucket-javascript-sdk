export function stripTrailingSlash<T extends string | undefined>(str: T): T {
  return str?.endsWith("/") ? (str.slice(0, -1) as T) : str;
}

export const successUrl = (baseUrl: string) => `${baseUrl}/cli-login/success`;
export const errorUrl = (baseUrl: string, error: string) =>
  `${baseUrl}/cli-login/error?error=${error}`;

export const loginUrl = (
  baseUrl: string,
  localPort: number,
  codeChallenge: string,
) =>
  `${baseUrl}/oauth/cli/authorize?port=${localPort}&codeChallenge=${codeChallenge}`;
