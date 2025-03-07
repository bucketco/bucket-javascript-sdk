import http from "http";
import open from "open";

import { authStore } from "../stores/auth.js";
import { configStore } from "../stores/config.js";

import { loginUrl } from "./constants.js";

function corsHeaders(baseUrl: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": baseUrl,
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Authorization",
  };
}

export async function authenticateUser(baseUrl: string) {
  return new Promise<string>((resolve, reject) => {
    let isResolved = false;

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const headers = corsHeaders(baseUrl);

      // Ensure we don't process requests after resolution
      if (isResolved) {
        res.writeHead(503, headers).end();
        return;
      }

      if (url.pathname !== "/cli-login") {
        res.writeHead(404).end("Invalid path");
        cleanupAndReject(new Error("Could not authenticate: Invalid path"));
        return;
      }

      // Handle preflight request
      if (req.method === "OPTIONS") {
        res.writeHead(200, headers);
        res.end();
        return;
      }

      if (!req.headers.authorization?.startsWith("Bearer ")) {
        res.writeHead(400, headers).end("Could not authenticate");
        cleanupAndReject(new Error("Could not authenticate"));
        return;
      }

      const token = req.headers.authorization.slice("Bearer ".length);
      headers["Content-Type"] = "application/json";
      res.writeHead(200, headers);
      res.end(JSON.stringify({ result: "success" }));

      try {
        await authStore.setToken(baseUrl, token);
        cleanupAndResolve(token);
      } catch (error) {
        cleanupAndReject(
          error instanceof Error ? error : new Error("Failed to store token"),
        );
      }
    });

    const timeout = setTimeout(() => {
      cleanupAndReject(new Error("Authentication timed out after 30 seconds"));
    }, 30000);

    function cleanupAndResolve(token: string) {
      if (isResolved) return;
      isResolved = true;
      cleanup();
      resolve(token);
    }

    function cleanupAndReject(error: Error) {
      if (isResolved) return;
      isResolved = true;
      cleanup();
      reject(error);
    }

    function cleanup() {
      clearTimeout(timeout);
      server.close();
      // Force-close any remaining connections
      server.getConnections((err, count) => {
        if (err || count === 0) return;
        server.closeAllConnections();
      });
    }

    server.listen();
    const address = server.address();
    if (address && typeof address === "object") {
      const port = address.port;
      void open(loginUrl(baseUrl, port), {
        newInstance: true,
      });
    }
  });
}

export async function authRequest<T = Record<string, unknown>>(
  url: string,
  options?: RequestInit & {
    params?: Record<string, string>;
  },
  retryCount = 0,
): Promise<T> {
  const { baseUrl, apiUrl } = configStore.getConfig();
  const token = authStore.getToken(baseUrl);

  if (!token) {
    await authenticateUser(baseUrl);
    return authRequest(url, options);
  }

  const resolvedUrl = new URL(`${apiUrl}/${url}`);
  if (options?.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      resolvedUrl.searchParams.append(key, value);
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
        await authenticateUser(baseUrl);
        return authRequest(url, options, retryCount + 1);
      }
    }
    throw response;
  }

  return response.json();
}
