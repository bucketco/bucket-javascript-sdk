import http, { IncomingMessage } from "http";
import axios, { AxiosError, AxiosRequestConfig } from "axios";
import open from "open";

import { getConfig, writeConfigFile } from "./config.js";
import { API_BASE_URL, loginUrl } from "./constants.js";

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve) => {
    let bodyChunks: any = [];

    req.on("data", (chunk) => {
      bodyChunks.push(chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(bodyChunks).toString());
    });
  });
}

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
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const origin = new URL(loginUrl(0)).origin;
      const headers = corsHeaders(origin);

      if (url.pathname !== "/cli-login") {
        res.writeHead(404).end("Invalid path");
        server.close();
        reject(new Error("Could not authenticate: Invalid path"));
        return;
      }

      // Handle preflight request
      if (req.method === "OPTIONS") {
        res.writeHead(200, corsHeaders(origin));
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

      const body = JSON.parse(await readBody(req));

      if (body.defaultAppId !== undefined && getConfig("appId") === undefined) {
        await writeConfigFile("appId", body.defaultAppId);
      }

      headers["Content-Type"] = "application/json";

      res.writeHead(200, headers);
      res.end(JSON.stringify({ result: "success" }));
      server.close();

      await writeConfigFile("token", token);
      resolve(token);
    });

    server.listen();
    const address = server.address();
    if (address && typeof address === "object") {
      const port = address.port;
      open(loginUrl(port), {
        newInstance: true,
      });
    }
  });
}

export function checkAuth() {
  if (!getConfig("token")) {
    throw new Error(
      'You are not authenticated. Please run "bucket auth login" first.',
    );
  }
}

export async function authRequest<T = Record<string, unknown>>(
  url: string,
  options?: AxiosRequestConfig,
): Promise<T> {
  checkAuth();
  try {
    const response = await axios({
      ...options,
      url: `${API_BASE_URL}${url}`,
      headers: {
        ...options?.headers,
        Authorization: "Bearer " + getConfig("token"),
      },
    });
    return response.data;
  } catch (error) {
    if (
      error instanceof AxiosError &&
      error.response &&
      error.response.status === 401
    ) {
      writeConfigFile("token", undefined);
      error.message = "Your session has expired. Please login again.";
      throw error;
    }
    throw error;
  }
}
