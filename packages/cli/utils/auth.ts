import http from "http";
import axios, { AxiosError, AxiosRequestConfig } from "axios";
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

// function readBody(req: IncomingMessage) {
//   return new Promise<string>((resolve) => {
//     let bodyChunks: any = [];

//     req.on("data", (chunk) => {
//       bodyChunks.push(chunk);
//     });
//     req.on("end", () => {
//       resolve(Buffer.concat(bodyChunks).toString());
//     });
//   });
// }

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Authorization",
  };
}

/**
 * @return {Promise<string>}
 */
export async function authenticateUser() {
  return new Promise<string>((resolve, reject) => {
    const { baseUrl } = program.opts();

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const headers = corsHeaders(baseUrl);

      if (url.pathname !== "/cli-login") {
        res.writeHead(404).end("Invalid path");
        server.close();
        reject(new Error("Could not authenticate: Invalid path"));
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
        server.close();
        reject(new Error("Could not authenticate"));
        return;
      }

      const token = req.headers.authorization.slice("Bearer ".length);

      //const body = JSON.parse(await readBody(req));

      headers["Content-Type"] = "application/json";

      res.writeHead(200, headers);
      res.end(JSON.stringify({ result: "success" }));
      server.close();

      await storeToken(token);
      resolve(token);
    });

    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Authentication timed out after 30 seconds"));
    }, 30000);

    server.listen();
    const address = server.address();
    if (address && typeof address === "object") {
      const port = address.port;
      open(loginUrl(baseUrl, port), {
        newInstance: true,
      });
    }

    // Cleanup timeout when server closes
    server.on("close", () => {
      clearTimeout(timeout);
    });
  });
}

export async function authRequest<T = Record<string, unknown>>(
  url: string,
  options?: AxiosRequestConfig,
  retryCount = 0,
): Promise<T> {
  const token = await getToken();
  const { apiUrl } = program.opts();
  try {
    const response = await axios({
      ...options,
      url: `${apiUrl}${url}`,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    if (
      error instanceof AxiosError &&
      error.response &&
      error.response.status === 401
    ) {
      await storeToken("");
      if (retryCount < 1) {
        await authenticateUser();
        return authRequest(url, options, retryCount + 1);
      }
    }
    throw error;
  }
}
