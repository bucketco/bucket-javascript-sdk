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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "post",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(2000),
      });

      const json = await response.json();
      return json as TResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  get: async <TResponse>(url: string, headers: Record<string, string>) => {
    ok(typeof url === "string" && url.length > 0, "URL must be a string");
    ok(typeof headers === "object", "Headers must be an object");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "get",
        headers,
        signal: controller.signal,
      });

      const json = await response.json();
      return json as TResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  },
};

export default fetchClient;
