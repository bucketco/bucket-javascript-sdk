import { ok } from "assert";
import fetch from "cross-fetch";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import {
  clearCache,
  FeatureFlagsResponse,
  FLAGS_EXPIRE_MS,
  FLAGS_STALE_MS,
  getFlags,
} from "../src/flags-fetch";

vi.mock("cross-fetch", () => {
  return {
    default: vi.fn(),
  };
});

const flagsResponse: FeatureFlagsResponse = {
  success: true,
  flags: {
    featureA: { value: true, version: 1, key: "featureA" },
  },
};

beforeEach(() => {
  clearCache();

  vi.useFakeTimers();
  vi.resetAllMocks();

  vi.mocked(fetch).mockResolvedValue({
    status: 200,
    ok: true,
    json: function () {
      return Promise.resolve(flagsResponse);
    },
  } as Response);
});

afterAll(() => {
  clearCache();
});

const apiBaseUrl = "https://localhost/flags/evaluate?key=pubKey";

describe("getFlags unit tests", () => {
  test("fetches flags", async () => {
    const flags = await getFlags({
      apiBaseUrl,
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    });

    expect(flags).toEqual({
      flags: flagsResponse.flags,
      url: `${apiBaseUrl}&context.user.id=123`,
    });
  });

  test("deduplicates inflight requests", async () => {
    let resolve:
      | ((value: Response | PromiseLike<Response>) => void)
      | undefined;
    const p = new Promise<Response>((r) => (resolve = r));
    vi.mocked(fetch).mockReturnValue(p);

    expect(vi.mocked(fetch).mock.calls.length).toBe(0);
    const a = getFlags({
      apiBaseUrl,
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    }).catch(console.error);

    getFlags({
      apiBaseUrl,
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    }).catch(console.error);

    expect(vi.mocked(fetch).mock.calls.length).toBe(1);

    ok(resolve);
    resolve({
      status: 200,
      ok: true,
      json: function () {
        return Promise.resolve(flagsResponse);
      },
    } as Response);

    await a;
  });

  test("caches response", async () => {
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);

    await getFlags({
      apiBaseUrl,
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    });

    const flags = await getFlags({
      apiBaseUrl,
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    });
    expect(flags).toEqual({
      flags: flagsResponse.flags,
      url: `${apiBaseUrl}&context.user.id=123`,
    });
    expect(vi.mocked(fetch).mock.calls.length).toBe(1);
  });

  test("maintains previously successful flags on negative response", async () => {
    await getFlags({
      apiBaseUrl,
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    });

    vi.mocked(fetch).mockRejectedValue(new Error("Failed to fetch flags"));
    vi.advanceTimersByTime(60000);

    const staleFlags = await getFlags({
      apiBaseUrl,
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    });

    expect(staleFlags).toEqual({
      flags: flagsResponse.flags,
      url: `${apiBaseUrl}&context.user.id=123`,
    });
  });

  test("attempts multiple tries before caching negative response", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Failed to fetch flags"));

    for (let i = 0; i < 3; i++) {
      await getFlags({
        apiBaseUrl,
        context: { user: { id: "123" } },
        timeoutMs: 1000,
      });
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(i + 1);
    }

    await getFlags({
      apiBaseUrl,
      context: { user: { id: "123" } },
      timeoutMs: 1000,
      staleWhileRevalidate: false,
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
  });

  test("disable caching negative response", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Failed to fetch flags"));

    for (let i = 0; i < 5; i++) {
      await getFlags({
        apiBaseUrl,
        context: { user: { id: "123" } },
        timeoutMs: 1000,
        cacheNegativeAttempts: false,
        staleWhileRevalidate: false,
      });
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(i + 1);
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

      expect(vi.mocked(fetch).mock.calls.length).toBe(0);

      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        ok: true,
        json: function () {
          return Promise.resolve(response);
        },
      } as Response);

      const a = await getFlags({
        apiBaseUrl,
        context: { user: { id: "123" } },
        timeoutMs: 1000,
      });

      // change the response so we can validate that we'll serve the stale cache
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        ok: true,
        json: function () {
          return Promise.resolve({
            success: true,
            flags: {
              featureB: { value: true, key: "featureB" },
            },
          });
        },
      } as Response);

      vi.advanceTimersByTime(FLAGS_STALE_MS + 1);

      const b = await getFlags({
        apiBaseUrl,
        context: { user: { id: "123" } },
        timeoutMs: 1000,
        staleWhileRevalidate: true,
      });

      expect(a).toEqual(b);

      // new fetch was fired
      expect(vi.mocked(fetch).mock.calls.length).toBe(2);
    });

    test("when stale cache is failed response", async () => {
      const response = {
        success: false,
      };

      expect(vi.mocked(fetch).mock.calls.length).toBe(0);

      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        ok: true,
        json: function () {
          return Promise.resolve(response);
        },
      } as Response);

      await getFlags({
        apiBaseUrl,
        context: { user: { id: "123" } },
        timeoutMs: 1000,
      });

      // change the response so we can validate that we'll serve the stale cache
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        ok: true,
        json: function () {
          return Promise.resolve({
            success: true,
            flags: {
              featureB: { value: true, key: "featureB" },
            },
          });
        },
      } as Response);

      vi.advanceTimersByTime(FLAGS_STALE_MS + 1);

      const b = await getFlags({
        apiBaseUrl,
        context: { user: { id: "123" } },
        timeoutMs: 1000,
        staleWhileRevalidate: true,
      });

      expect(b.flags).toEqual({
        featureB: { value: true, key: "featureB" },
      });

      // new fetch was fired
      expect(vi.mocked(fetch).mock.calls.length).toBe(2);
    });
  });

  test("expires cache eventually", async () => {
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);

    const a = await getFlags({
      apiBaseUrl,
      context: { user: { id: "123" } },
      timeoutMs: 1000,
    });

    // change the response so we can validate that we'll serve the stale cache
    vi.mocked(fetch).mockResolvedValue({
      status: 200,
      ok: true,
      json: function () {
        return Promise.resolve({
          success: true,
          flags: {
            featureB: { value: true, key: "featureB" },
          },
        });
      },
    } as Response);

    expect(vi.mocked(fetch).mock.calls.length).toBe(1);

    vi.advanceTimersByTime(FLAGS_EXPIRE_MS + 1);

    const b = await getFlags({
      apiBaseUrl,
      context: { user: { id: "123" } },
      timeoutMs: 1000,
      staleWhileRevalidate: true,
    });

    expect(vi.mocked(fetch).mock.calls.length).toBe(2);
    expect(a).not.toEqual(b);
  });
});
