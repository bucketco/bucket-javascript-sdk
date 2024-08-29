import http from "http";
import axios, { AxiosError, AxiosRequestConfig } from "axios";
import chalk from "chalk";
import open from "open";

import { readConfig, writeConfig } from "./config.js";
import { API_BASE_URL } from "./constants.js";

/**
 * @return {Promise<string>}
 */
export async function authenticateUser() {
  return new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (url.pathname !== "/") {
        res.writeHead(404).end("Not Found");
        server.close();
        reject(new Error("Authentication failed"));
        return;
      }

      if (!req.headers.cookie?.includes("session.sig")) {
        res.writeHead(400).end("No session cookie found");
        server.close();
        reject(new Error("Authentication failed: No session cookie"));
        return;
      }

      res.end("OK");
      server.close();
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

let sessionCookies = "";

export function checkAuth() {
  if (!sessionCookies) {
    console.log(
      chalk.red(
        'You are not authenticated. Please run "bucket auth login" first.',
      ),
    );
    process.exit(1);
  }
}

export async function saveSessionCookie(cookies: string) {
  await writeConfig("sessionCookies", cookies);
  sessionCookies = cookies;
}

export async function loadSessionCookie() {
  sessionCookies = await readConfig("sessionCookies");
}

export function removeSessionCookie() {
  saveSessionCookie("");
  sessionCookies = "";
}

export function getSessionCookie() {
  return sessionCookies;
}

export async function authRequest(url: string, options?: AxiosRequestConfig) {
  checkAuth();
  try {
    const response = await axios({
      ...options,
      url: `${API_BASE_URL}${url}`,
      headers: {
        ...options?.headers,
        Cookie: sessionCookies,
      },
    });
    return response.data;
  } catch (error) {
    if (
      error instanceof AxiosError &&
      error.response &&
      error.response.status === 401
    ) {
      console.log(chalk.red("Your session has expired. Please login again."));
      removeSessionCookie();
      process.exit(1);
    }
    throw error;
  }
}
