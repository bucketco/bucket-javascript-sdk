import { SDK_VERSION, SDK_VERSION_HEADER_NAME } from "./config";

export class HttpClient {
  constructor(
    public publishableKey: string,
    private baseUrl: string,
  ) {
    // Ensure baseUrl ends with a trailing slash so subsequent
    // path concatenation works as expected
    if (!this.baseUrl.endsWith("/")) {
      this.baseUrl += "/";
    }
  }

  getUrl(path: string): URL {
    return new URL(path, this.baseUrl);
  }

  async get({
    path,
    params,
    timeoutMs,
  }: {
    path: string;
    params?: URLSearchParams;
    timeoutMs?: number;
  }): ReturnType<typeof fetch> {
    if (!params) {
      params = new URLSearchParams();
    }
    params.set(SDK_VERSION_HEADER_NAME, SDK_VERSION);
    params.set("publishableKey", this.publishableKey);

    const url = this.getUrl(path);
    url.search = params.toString();

    if (timeoutMs === undefined) {
      return fetch(url);
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(id);

    return res;
  }

  async post({
    path,
    body,
  }: {
    host?: string;
    path: string;
    body: any;
  }): ReturnType<typeof fetch> {
    return fetch(this.getUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [SDK_VERSION_HEADER_NAME]: SDK_VERSION,
        Authorization: `Bearer ${this.publishableKey}`,
      },
      body: JSON.stringify(body),
    });
  }
}
