import { API_TIMEOUT_MS } from "./config";
import { HttpClient } from "./types";
import { ok } from "./utils";

/**
 * The default HTTP client implementation.
 *
 * @remarks
 * This implementation uses the `fetch` API to send HTTP requests.
 **/
const fetchClient: HttpClient = {
  post: async <TBody, TResponse>(
    url: string,
    headers: Record<string, string>,
    body: TBody,
  ) => {
    ok(typeof url === "string" && url.length > 0, "URL must be a string");
    ok(typeof headers === "object", "Headers must be an object");

    const response = await fetch(url, {
      method: "post",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    const json = await response.json();
    return { status: response.status, body: json as TResponse };
  },

  get: async <TResponse>(url: string, headers: Record<string, string>) => {
    ok(typeof url === "string" && url.length > 0, "URL must be a string");
    ok(typeof headers === "object", "Headers must be an object");

    const response = await fetch(url, {
      method: "get",
      headers,
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    const json = await response.json();
    return { status: response.status, body: json as TResponse };
  },
};

export default fetchClient;
