import crypto from "crypto";
import http from "http";
import chalk from "chalk";
import open from "open";

import { authStore } from "../stores/auth.js";
import { configStore } from "../stores/config.js";

import { errorUrl, loginUrl, successUrl } from "./path.js";
import { ParamType } from "./types.js";

interface waitForAccessToken {
  accessToken: string;
  expiresAt: Date;
}

export async function waitForAccessToken(baseUrl: string, apiUrl: string) {
  let resolve: (args: waitForAccessToken) => void,
    reject: (arg0: Error) => void;
  const promise = new Promise<waitForAccessToken>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  // PCKE code verifier and challenge
  const codeVerifier = crypto.randomUUID();
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const timeout = setTimeout(() => {
    cleanupAndReject(new Error("Authentication timed out after 60 seconds"));
  }, 60000);

  function cleanupAndReject(error: Error) {
    cleanup();
    reject(error);
  }

  function cleanup() {
    clearTimeout(timeout);
    server.close();
    server.closeAllConnections();
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (url.pathname !== "/cli-login") {
      res.writeHead(404).end("Invalid path");
      cleanupAndReject(new Error("Could not authenticate: Invalid path"));
      return;
    }

    const code = url.searchParams.get("code");

    if (!code) {
      res.writeHead(400).end("Could not authenticate");
      cleanupAndReject(new Error("Could not authenticate: no code provided"));
      return;
    }

    const response = await fetch(`${apiUrl}/oauth/cli/access-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        codeVerifier,
      }),
    });

    if (!response.ok) {
      res
        .writeHead(302, {
          location: errorUrl(
            baseUrl,
            "Could not authenticate: Unable to fetch access token",
          ),
        })
        .end("Could not authenticate");
      cleanupAndReject(new Error("Could not authenticate"));
      return;
    }
    res
      .writeHead(302, {
        location: successUrl(baseUrl),
      })
      .end("Authentication successful");

    const jsonResponse = await response.json();

    cleanup();
    resolve({
      accessToken: jsonResponse.accessToken,
      expiresAt: new Date(jsonResponse.expiresAt),
    });
  });

  server.listen();
  const address = server.address();
  if (address == null || typeof address !== "object") {
    throw new Error("Could not start server");
  }

  const port = address.port;
  const browserUrl = loginUrl(apiUrl, port, codeChallenge);

  console.log(
    `Opened web browser to facilitate login: ${chalk.cyan(browserUrl)}`,
  );

  void open(browserUrl);

  return promise;
}

export async function authRequest<T = Record<string, unknown>>(
  url: string,
  options?: RequestInit & {
    params?: Record<string, ParamType | ParamType[] | null | undefined>;
  },
  retryCount = 0,
): Promise<T> {
  const { baseUrl, apiUrl } = configStore.getConfig();
  const token = authStore.getToken(baseUrl);

  if (!token) {
    const accessToken = await waitForAccessToken(baseUrl, apiUrl);
    await authStore.setToken(baseUrl, accessToken.accessToken);
    return authRequest(url, options);
  }
  const resolvedUrl = new URL(`${apiUrl}/${url}`);
  if (options?.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => resolvedUrl.searchParams.append(key, String(v)));
        } else {
          resolvedUrl.searchParams.set(key, String(value));
        }
      }
    });
  }

  const response = await fetch(resolvedUrl, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      await authStore.setToken(baseUrl, undefined);
      if (retryCount < 1) {
        await waitForAccessToken(baseUrl, apiUrl);
        return authRequest(url, options, retryCount + 1);
      }
    }
    throw response;
  }

  return response.json();
}
