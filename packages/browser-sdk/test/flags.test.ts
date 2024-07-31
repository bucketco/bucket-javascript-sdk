import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import { FLAGS_EXPIRE_MS, FlagsClient, FlagsOptions } from "../src/flags/flags";
import { HttpClient } from "../src/httpClient";

import { flagsResult } from "./mocks/handlers";
import { newCache, TEST_STALE_MS } from "./flagsCache.test";
import { testLogger } from "./testLogger";

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
});

afterAll(() => {
  vi.useRealTimers();
});

function flagsClientFactory() {
  const { cache } = newCache();
  const httpClient = new HttpClient("pk", "https://front.bucket.co");
  vi.spyOn(httpClient, "get");
  vi.spyOn(httpClient, "post");
  return {
    cache,
    httpClient,
    newFlagsClient: function newFlagsClient(options?: FlagsOptions) {
      return new FlagsClient(httpClient, { user: { id: "123" } }, testLogger, {
        cache,
        ...options,
      });
    },
  };
}

describe("FlagsClient unit tests", () => {
  test("fetches flags", async () => {
    const flagsClient = flagsClientFactory().newFlagsClient();

    await flagsClient.initialize();
    expect(flagsClient.getFlags()).toEqual(flagsResult);
  });

  test("return fallback flags on failure", async () => {
    const { newFlagsClient, httpClient } = flagsClientFactory();

    vi.mocked(httpClient.get).mockRejectedValue(
      new Error("Failed to fetch flags"),
    );
    const flagsClient = newFlagsClient({
      fallbackFlags: ["huddle"],
    });
    await flagsClient.initialize();
    expect(flagsClient.getFlags()).toEqual({ huddle: true });
  });

  test("caches response", async () => {
    const { newFlagsClient, httpClient } = flagsClientFactory();

    const flagsClient = newFlagsClient();
    await flagsClient.initialize();

    expect(httpClient.get).toBeCalledTimes(1);

    const flagsClient2 = newFlagsClient();
    await flagsClient2.initialize();
    const flags = flagsClient2.getFlags();

    expect(flags).toEqual(flagsResult);
    expect(httpClient.get).toBeCalledTimes(1);
  });

  test("maintains previously successful flags on negative response", async () => {
    const { newFlagsClient, httpClient } = flagsClientFactory();
    const flagsClient = newFlagsClient();
    await flagsClient.initialize();

    vi.mocked(httpClient.get).mockRejectedValue(
      new Error("Failed to fetch flags"),
    );
    // expect(httpClientGetSpy).toBeCalledTimes(0);

    // vi.mocked(fetch).mockRejectedValue(new Error("Failed to fetch flags"));
    vi.advanceTimersByTime(60000);

    await flagsClient.fetchFlags();

    const staleFlags = flagsClient.getFlags();
    expect(staleFlags).toEqual(flagsResult);
  });

  test("attempts multiple tries before caching negative response", async () => {
    const { newFlagsClient, httpClient } = flagsClientFactory();

    vi.mocked(httpClient.get).mockRejectedValue(
      new Error("Failed to fetch flags"),
    );

    for (let i = 0; i < 3; i++) {
      const flagsClient = newFlagsClient({
        staleWhileRevalidate: false,
        failureRetryAttempts: 3,
      });
      await flagsClient.initialize();

      expect(httpClient.get).toHaveBeenCalledTimes(i + 1);
    }

    const flagsClient = newFlagsClient({ failureRetryAttempts: 3 });
    await flagsClient.initialize();
    expect(httpClient.get).toHaveBeenCalledTimes(3);
  });

  test("disable caching negative response", async () => {
    const { newFlagsClient, httpClient } = flagsClientFactory();

    vi.mocked(httpClient.get).mockRejectedValue(
      new Error("Failed to fetch flags"),
    );

    for (let i = 0; i < 5; i++) {
      const flagsClient = newFlagsClient({ failureRetryAttempts: false });
      await flagsClient.initialize();

      expect(httpClient.get).toHaveBeenCalledTimes(i + 1);
    }
  });

  describe("stale cache while reevaluating", async () => {
    test("when stale cache is success response", async () => {
      const response = {
        success: true,
        flags: {
          featureB: { value: true, key: "featureB" },
        },
      };

      const { newFlagsClient, httpClient } = flagsClientFactory();

      vi.mocked(httpClient.get).mockResolvedValue({
        status: 200,
        ok: true,
        json: function () {
          return Promise.resolve(response);
        },
      } as Response);

      const client = newFlagsClient({
        failureRetryAttempts: false,
        staleWhileRevalidate: true,
      });
      expect(httpClient.get).toHaveBeenCalledTimes(0);

      await client.initialize();

      expect(httpClient.get).toHaveBeenCalledTimes(1);
      const client2 = newFlagsClient({
        failureRetryAttempts: false,
        staleWhileRevalidate: true,
      });

      // change the response so we can validate that we'll serve the stale cache
      vi.mocked(httpClient.get).mockResolvedValue({
        status: 200,
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            flags: {
              featureA: { value: true, key: "featureA" },
            },
          }),
      } as Response);

      vi.advanceTimersByTime(TEST_STALE_MS + 1);

      await client2.initialize();
      expect(client.getFlags()).toEqual(client2.getFlags());

      // new fetch was fired in the background
      expect(httpClient.get).toHaveBeenCalledTimes(2);
    });

    test("when stale cache is failed response", async () => {
      const { newFlagsClient, httpClient } = flagsClientFactory();
      // when cached response is failure, we should not serve the stale cache
      const response = {
        success: false,
      };

      expect(httpClient.get).toHaveBeenCalledTimes(0);

      vi.mocked(httpClient.get).mockResolvedValue({
        status: 200,
        ok: true,
        json: function () {
          return Promise.resolve(response);
        },
      } as Response);

      const client = newFlagsClient({
        staleWhileRevalidate: true,
        failureRetryAttempts: 0,
      });
      await client.initialize();

      expect(httpClient.get).toHaveBeenCalledTimes(1);

      // change the response so we can validate that we'll not serve the stale cache
      vi.mocked(httpClient.get).mockResolvedValue({
        status: 200,
        ok: true,
        json: function () {
          return Promise.resolve({
            success: true,
            flags: {
              featureB: { value: true, key: "featureB", version: 1 },
            },
          });
        },
      } as Response);

      vi.advanceTimersByTime(TEST_STALE_MS + 1);
      const client2 = newFlagsClient();
      await client2.initialize();

      expect(client2.getFlags()).toEqual({ featureB: true });

      // new fetch was fired
      // stale while validate in the background
      expect(httpClient.get).toHaveBeenCalledTimes(2);
    });
  });

  test("expires cache eventually", async () => {
    // change the response so we can validate that we'll serve the stale cache
    const { newFlagsClient, httpClient } = flagsClientFactory();
    const client = newFlagsClient();
    await client.initialize();
    const a = client.getFlags();

    vi.advanceTimersByTime(FLAGS_EXPIRE_MS + 1);
    vi.mocked(httpClient.get).mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          flags: {
            featureB: { value: true, key: "featureB" },
          },
        }),
    } as Response);
    const client2 = newFlagsClient();
    await client2.initialize();

    const b = client2.getFlags();

    expect(httpClient.get).toHaveBeenCalledTimes(2);
    expect(a).not.toEqual(b);
  });
});

describe(`sends "check" events`, () => {
  it("sends check event", async () => {
    const { newFlagsClient, httpClient } = flagsClientFactory();
    const client = newFlagsClient();
    await client.initialize();

    const _ = client.getFlags()?.featureA;
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith({
      path: "flags/events",
      body: {
        action: "check",
        evalContext: {
          user: {
            id: "123",
          },
        },
        evalResult: true,
        flagKey: "featureA",
        flagVersion: 1,
      },
    });
  });
});
