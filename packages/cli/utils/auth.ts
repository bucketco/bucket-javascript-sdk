import http from "http";
import axios, { AxiosError, AxiosRequestConfig } from "axios";
import open from "open";

import { getConfig, writeConfigFile } from "./config.js";
import { API_BASE_URL, loginUrl } from "./constants.js";

/**
 * @return {Promise<string>}
 */
export async function authenticateUser() {
  return new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (url.pathname !== "/cli-login") {
        res.writeHead(404).end("Invalid path");
        server.close();
        reject(new Error("Could not authenticate: Invalid path"));
        return;
      }

      // Handle preflight request
      if (req.method === "OPTIONS") {
        res.writeHead(200, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Authorization",
        });
        res.end();
        return;
      }

      if (!req.headers.authorization?.startsWith("Bearer ")) {
        res.writeHead(400).end("Could not authenticate");
        server.close();
        reject(new Error("Could not authenticate"));
        return;
      }

      const token = req.headers.authorization.slice("Bearer ".length);

      res.end("You can now close this tab.");
      server.close();
      writeConfigFile("token", token);
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
