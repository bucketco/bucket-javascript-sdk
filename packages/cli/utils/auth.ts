import http from "http";
import open from "open";

import { AUTH_FILE, loginUrl } from "./constants.js";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";
import { program } from "commander";

export async function getToken() {
  return readFile(AUTH_FILE, "utf-8");
}

export async function storeToken(newToken: string) {
  await mkdir(dirname(AUTH_FILE), { recursive: true });
  await writeFile(AUTH_FILE, newToken);
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Authorization",
  };
}

export async function authenticateUser() {
  return new Promise<string>((resolve, reject) => {
    const { baseUrl } = program.opts();
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
        await storeToken(token);
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
      open(loginUrl(baseUrl, port), {
        newInstance: true,
      });
    }
  });
}

export async function authRequest<T = Record<string, unknown>>(
  url: string,
  options?: RequestInit,
  retryCount = 0,
): Promise<T> {
  const token = await getToken();
  let { baseUrl, apiUrl } = program.opts();
  apiUrl = apiUrl ?? `${baseUrl}/api`;

  const response = await fetch(`${apiUrl}${url}`, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      await storeToken("");
      if (retryCount < 1) {
        await authenticateUser();
        return authRequest(url, options, retryCount + 1);
      }
    }
    throw response;
  }

  return response.json();
}
