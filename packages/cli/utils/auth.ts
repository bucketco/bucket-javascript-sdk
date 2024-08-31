import http from "http";
import axios, { AxiosError, AxiosRequestConfig } from "axios";
import open from "open";

import { getConfig, writeConfigFile } from "./config.js";
import { API_BASE_URL } from "./constants.js";

/**
 * @return {Promise<string>}
 */
export async function authenticateUser() {
  return new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (url.pathname !== "/") {
        res.writeHead(404).end("Invalid path");
        server.close();
        reject(new Error("Could not authenticate: Invalid path"));
        return;
      }

      if (!req.headers.cookie?.includes("session.sig")) {
        res.writeHead(400).end("Could not authenticate");
        server.close();
        reject(new Error("Could not authenticate"));
        return;
      }

      res.end("You can now close this tab.");
      server.close();
      writeConfigFile("sessionCookies", req.headers.cookie);
      resolve(req.headers.cookie);
    });

    server.listen();
    const address = server.address();
    if (address && typeof address === "object") {
      const port = address.port;
      const redirect = `http://localhost:${port}`;
      open(`${API_BASE_URL}/auth/google?redirect=${redirect}`, {
        newInstance: true,
      });
    }
  });
}

export function checkAuth() {
  if (!getConfig("sessionCookies")) {
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
        Cookie: getConfig("sessionCookies"),
      },
    });
    return response.data;
  } catch (error) {
    if (
      error instanceof AxiosError &&
      error.response &&
      error.response.status === 401
    ) {
      writeConfigFile("sessionCookies", undefined);
      error.message = "Your session has expired. Please login again.";
      throw error;
    }
    throw error;
  }
}
