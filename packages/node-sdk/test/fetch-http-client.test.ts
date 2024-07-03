import { afterEach, describe, expect, it, vi } from "vitest";

import { API_TIMEOUT_MS } from "../src/config";
import fetchClient from "../src/fetch-http-client";

// mock environment variables
vi.mock("../src/config", () => ({ API_TIMEOUT_MS: 100 }));

describe("fetchClient", () => {
  const url = "https://example.com/api";
  const headers = { "Content-Type": "application/json" };

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should make a POST request and return the response", async () => {
    const body = { key: "value" };
    const response = { success: true };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    } as Response);

    const result = await fetchClient.post<typeof body, typeof response>(
      url,
      headers,
      body,
    );

    expect(result).toEqual(response);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: "post",
        headers,
        body: JSON.stringify(body),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("should make a GET request and return the response", async () => {
    const response = { success: true };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    } as Response);

    const result = await fetchClient.get<typeof response>(url, headers);

    expect(result).toEqual(response);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: "get",
        headers,
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("should timeout a POST request that takes too long", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ ok: true, json: async () => ({}) }),
              API_TIMEOUT_MS + 100,
            ),
          ),
      );

    await fetchClient.post(url, headers, {});
    expect(vi.mocked(global.fetch).mock.calls[0][1]?.signal?.aborted).toBe(
      true,
    );
  });

  it("should timeout a GET request that takes too long", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ ok: true, json: async () => ({}) }),
              API_TIMEOUT_MS + 100,
            ),
          ),
      );

    await fetchClient.get(url, headers);
    expect(vi.mocked(global.fetch).mock.calls[0][1]?.signal?.aborted).toBe(
      true,
    );
  });

  it("should handle POST non-20x responses", async () => {
    const response = { error: "Something went wrong" };

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => response,
    } as Response);

    const result = await fetchClient.post(url, headers, {});

    expect(result).toEqual(response);
  });

  it("should handle GET non-20x responses", async () => {
    const response = { error: "Something went wrong" };

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => response,
    } as Response);

    const result = await fetchClient.get(url, headers);

    expect(result).toEqual(response);
  });

  it("should not handle POST exceptions", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    await expect(fetchClient.post(url, headers, {})).rejects.toThrow(
      "Network error",
    );
  });

  it("should not handle GET exceptions", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    await expect(fetchClient.get(url, headers)).rejects.toThrow(
      "Network error",
    );
  });
});
