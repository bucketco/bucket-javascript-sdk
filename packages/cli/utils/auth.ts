import crypto from "crypto";
import http from "http";
import chalk from "chalk";
import open from "open";

import { authStore } from "../stores/auth.js";
import { configStore } from "../stores/config.js";

import {
  CLIENT_VERSION_HEADER_NAME,
  CLIENT_VERSION_HEADER_VALUE,
} from "./constants.js";
import { ResponseError } from "./errors.js";
import { ParamType } from "./types.js";
import { errorUrl, successUrl } from "./urls.js";

const maxRetryCount = 1;

interface waitForAccessToken {
  accessToken: string;
  expiresAt: Date;
}

async function getOAuthServerUrls(apiUrl: string) {
  const { protocol, host } = new URL(apiUrl);
  const wellKnownUrl = `${protocol}//${host}/.well-known/oauth-authorization-server`;

  const response = await fetch(wellKnownUrl, {
    signal: AbortSignal.timeout(5000),
  });

  if (response.ok) {
    const data = (await response.json()) as {
      authorization_endpoint: string;
      token_endpoint: string;
      registration_endpoint: string;
      issuer: string;
    };

    return {
      registrationEndpoint:
        data.registration_endpoint ?? `${data.issuer}/oauth/register`,
      authorizationEndpoint: data.authorization_endpoint,
      tokenEndpoint: data.token_endpoint,
      issuer: data.issuer,
    };
  }

  throw new Error("Failed to fetch OAuth server metadata");
}

export async function waitForAccessToken(baseUrl: string, apiUrl: string) {
  const { authorizationEndpoint, tokenEndpoint, registrationEndpoint } =
    await getOAuthServerUrls(apiUrl);

  let resolve: (args: waitForAccessToken) => void;
  let reject: (arg0: Error) => void;

  const promise = new Promise<waitForAccessToken>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  // PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
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

  const server = http.createServer();

  server.listen();

  const address = server.address();
  if (address == null || typeof address !== "object") {
    throw new Error("Could not start server");
  }

  const redirectUri = `http://localhost:${address.port}/callback`;

  const registrationResponse = await fetch(registrationEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_name: "Bucket CLI",
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      redirect_uris: [redirectUri],
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!registrationResponse.ok) {
    throw new Error(`Could not register client with OAuth server`);
  }

  const registrationData = (await registrationResponse.json()) as {
    client_id: string;
  };

  const clientId = registrationData.client_id;

  const params = {
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state: crypto.randomUUID(),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  };

  const browserUrl = `${authorizationEndpoint}?${new URLSearchParams(params).toString()}`;

  server.on("request", async (req, res) => {
    if (!clientId || !redirectUri) {
      res.writeHead(500).end("Could not authenticate: something went wrong");

      cleanupAndReject(
        new Error("Could not authenticate: something went wrong"),
      );
      return;
    }

    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (url.pathname !== "/callback") {
      res.writeHead(404).end("Invalid path");

      cleanupAndReject(new Error("Could not authenticate: invalid path"));
      return;
    }

    const error = url.searchParams.get("error");
    if (error) {
      res.writeHead(400).end("Could not authenticate");

      const errorDescription = url.searchParams.get("error_description");
      cleanupAndReject(
        new Error(`Could not authenticate: ${errorDescription || error} `),
      );
      return;
    }

    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(400).end("Could not authenticate");

      cleanupAndReject(new Error("Could not authenticate: no code provided"));
      return;
    }

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(5000),
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

      const json = await response.json();
      cleanupAndReject(
        new Error(`Could not authenticate: ${JSON.stringify(json)}`),
      );
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
      accessToken: jsonResponse.access_token,
      expiresAt: new Date(Date.now() + jsonResponse.expires_in * 1000),
    });
  });

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
  const { token, isApiKey } = authStore.getToken(baseUrl);

  if (!token) {
    const accessToken = await waitForAccessToken(baseUrl, apiUrl);

    await authStore.setToken(baseUrl, accessToken.accessToken);
    return authRequest(url, options);
  }

  if (url.startsWith("/")) {
    url = url.slice(1);
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

  let response: Response | undefined;

  try {
    response = await fetch(resolvedUrl, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${token}`,
        [CLIENT_VERSION_HEADER_NAME]: CLIENT_VERSION_HEADER_VALUE(
          configStore.getClientVersion() ?? "unknown",
        ),
      },
    });
  } catch (error: unknown) {
    const message =
      error && typeof error == "object" && "message" in error
        ? error.message
        : "unknown";

    throw new Error(`Failed to connect to "${resolvedUrl}". Error: ${message}`);
  }

  if (!response.ok) {
    if (response.status === 401) {
      if (isApiKey) {
        throw new Error(
          `The provided API key is not valid for "${resolvedUrl}".`,
        );
      }

      await authStore.setToken(baseUrl, null);

      if (retryCount < maxRetryCount) {
        return authRequest(url, options, retryCount + 1);
      }
    }

    const data = await response.json();
    throw new ResponseError(data);
  }

  return response.json();
}
