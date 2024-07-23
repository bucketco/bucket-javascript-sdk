import { SDK_VERSION, SDK_VERSION_HEADER_NAME } from "./config";

export class HttpClient {
  constructor(
    public publishableKey: string,
    private baseUrl: string,
  ) {}

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
    params.append(SDK_VERSION_HEADER_NAME, SDK_VERSION);
    params.append("publishableKey", this.publishableKey);

    const url = new URL(path, this.baseUrl);
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
    const url = new URL(path, this.baseUrl);
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [SDK_VERSION_HEADER_NAME]: SDK_VERSION,
      },
      body: JSON.stringify(body),
    });
  }
}
