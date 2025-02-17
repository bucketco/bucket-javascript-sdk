import { afterAll, beforeEach, describe, expect, it, test, vi } from "vitest";

import { version } from "../package.json";
import {
  FEATURES_EXPIRE_MS,
  FeaturesClient,
  FetchedFeature,
  RawFeature,
} from "../src/feature/features";
import { HttpClient } from "../src/httpClient";

import { featuresResult } from "./mocks/handlers";
import { newCache, TEST_STALE_MS } from "./featureCache.test";
import { testLogger } from "./testLogger";

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
});

afterAll(() => {
  vi.useRealTimers();
});

function featuresClientFactory() {
  const { cache } = newCache();
  const httpClient = new HttpClient("pk", {
    baseUrl: "https://front.bucket.co",
  });

  vi.spyOn(httpClient, "get");
  vi.spyOn(httpClient, "post");

  return {
    cache,
    httpClient,
    newFeaturesClient: function newFeaturesClient(
      context?: Record<string, any>,
      options?: { staleWhileRevalidate?: boolean; fallbackFeatures?: any },
    ) {
      return new FeaturesClient(
        httpClient,
        {
          user: { id: "123" },
          company: { id: "456" },
          other: { eventId: "big-conference1" },
          ...context,
        },
        testLogger,
        {
          cache,
          ...options,
        },
      );
    },
  };
}

describe("FeaturesClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("fetches features", async () => {
    const { newFeaturesClient, httpClient } = featuresClientFactory();
    const featuresClient = newFeaturesClient();

    let updated = false;
    featuresClient.onUpdated(() => {
      updated = true;
    });

    await featuresClient.initialize();
    expect(featuresClient.getFeatures()).toEqual(featuresResult);

    expect(updated).toBe(true);
    expect(httpClient.get).toBeCalledTimes(1);

    const calls = vi.mocked(httpClient.get).mock.calls.at(0)!;
    const { params, path, timeoutMs } = calls[0];

    const paramsObj = Object.fromEntries(new URLSearchParams(params));
    expect(paramsObj).toEqual({
      "bucket-sdk-version": "browser-sdk/" + version,
      "context.user.id": "123",
      "context.company.id": "456",
      "context.other.eventId": "big-conference1",
      publishableKey: "pk",
    });

    expect(path).toEqual("/features/evaluated");
    expect(timeoutMs).toEqual(5000);
  });

  test("warns about missing context fields", async () => {
    const { newFeaturesClient } = featuresClientFactory();
    const featuresClient = newFeaturesClient();

    await featuresClient.initialize();

    expect(testLogger.warn).toHaveBeenCalledTimes(1);
    expect(testLogger.warn).toHaveBeenCalledWith(
      "[Features] feature/remote config targeting rules might not be correctly evaluated due to missing context fields.",
      {
        featureA: ["field1", "field2"],
        "featureB.config": ["field3"],
      },
    );

    vi.advanceTimersByTime(TEST_STALE_MS + 1);

    expect(testLogger.warn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60 * 1000);
    await featuresClient.initialize();
    expect(testLogger.warn).toHaveBeenCalledTimes(2);
  });

  test("ignores undefined context", async () => {
    const { newFeaturesClient, httpClient } = featuresClientFactory();
    const featuresClient = newFeaturesClient({
      user: undefined,
      company: undefined,
      other: undefined,
    });
    await featuresClient.initialize();
    expect(featuresClient.getFeatures()).toEqual(featuresResult);

    expect(httpClient.get).toBeCalledTimes(1);
    const calls = vi.mocked(httpClient.get).mock.calls.at(0);
    const { params, path, timeoutMs } = calls![0];

    const paramsObj = Object.fromEntries(new URLSearchParams(params));
    expect(paramsObj).toEqual({
      "bucket-sdk-version": "browser-sdk/" + version,
      publishableKey: "pk",
    });

    expect(path).toEqual("/features/evaluated");
    expect(timeoutMs).toEqual(5000);
  });

  test("return fallback features on failure (string list)", async () => {
    const { newFeaturesClient, httpClient } = featuresClientFactory();

    vi.mocked(httpClient.get).mockRejectedValue(
      new Error("Failed to fetch features"),
    );

    const featuresClient = newFeaturesClient(undefined, {
      fallbackFeatures: ["huddle"],
    });

    await featuresClient.initialize();
    expect(featuresClient.getFeatures()).toStrictEqual({
      huddle: {
        isEnabled: true,
        config: undefined,
        key: "huddle",
        isEnabledOverride: null,
      },
    });
  });

  test("return fallback features on failure (record)", async () => {
    const { newFeaturesClient, httpClient } = featuresClientFactory();

    vi.mocked(httpClient.get).mockRejectedValue(
      new Error("Failed to fetch features"),
    );
    const featuresClient = newFeaturesClient(undefined, {
      fallbackFeatures: {
        huddle: {
          key: "john",
          payload: { something: "else" },
        },
        zoom: true,
      },
    });

    await featuresClient.initialize();
    expect(featuresClient.getFeatures()).toStrictEqual({
      huddle: {
        isEnabled: true,
        config: { key: "john", payload: { something: "else" } },
        key: "huddle",
        isEnabledOverride: null,
      },
      zoom: {
        isEnabled: true,
        config: undefined,
        key: "zoom",
        isEnabledOverride: null,
      },
    });
  });

  test("caches response", async () => {
    const { newFeaturesClient, httpClient } = featuresClientFactory();

    const featuresClient1 = newFeaturesClient();
    await featuresClient1.initialize();

    expect(httpClient.get).toBeCalledTimes(1);

    const featuresClient2 = newFeaturesClient();
    await featuresClient2.initialize();

    const features = featuresClient2.getFeatures();

    expect(features).toEqual(featuresResult);
    expect(httpClient.get).toBeCalledTimes(1);
  });

  test("use cache when unable to fetch features", async () => {
    const { newFeaturesClient, httpClient } = featuresClientFactory();
    const featuresClient = newFeaturesClient({ staleWhileRevalidate: false });
    await featuresClient.initialize(); // cache them initially

    vi.mocked(httpClient.get).mockRejectedValue(
      new Error("Failed to fetch features"),
    );
    expect(httpClient.get).toBeCalledTimes(1);

    vi.advanceTimersByTime(TEST_STALE_MS + 1);

    // fail this time
    await featuresClient.fetchFeatures();
    expect(httpClient.get).toBeCalledTimes(2);

    const staleFeatures = featuresClient.getFeatures();
    expect(staleFeatures).toEqual(featuresResult);
  });

  test("stale-while-revalidate should cache but start new fetch", async () => {
    const response = {
      success: true,
      features: {
        featureB: {
          isEnabled: true,
          key: "featureB",
          targetingVersion: 1,
        } satisfies FetchedFeature,
      },
    };

    const { newFeaturesClient, httpClient } = featuresClientFactory();

    vi.mocked(httpClient.get).mockResolvedValue({
      status: 200,
      ok: true,
      json: function () {
        return Promise.resolve(response);
      },
    } as Response);

    const client = newFeaturesClient({
      staleWhileRevalidate: true,
    });
    expect(httpClient.get).toHaveBeenCalledTimes(0);

    await client.initialize();
    expect(client.getFeatures()).toEqual({
      featureB: {
        isEnabled: true,
        key: "featureB",
        targetingVersion: 1,
        isEnabledOverride: null,
        inUse: false,
      } satisfies RawFeature,
    });

    expect(httpClient.get).toHaveBeenCalledTimes(1);
    const client2 = newFeaturesClient({
      staleWhileRevalidate: true,
    });

    // change the response so we can validate that we'll serve the stale cache
    vi.mocked(httpClient.get).mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          features: {
            featureA: {
              isEnabled: true,
              key: "featureA",
              targetingVersion: 1,
            },
          },
        }),
    } as Response);

    vi.advanceTimersByTime(TEST_STALE_MS + 1);

    await client2.initialize();

    // new fetch was fired in the background
    expect(httpClient.get).toHaveBeenCalledTimes(2);

    await vi.waitFor(() =>
      expect(client2.getFeatures()).toEqual({
        featureA: {
          isEnabled: true,
          targetingVersion: 1,
          key: "featureA",
          isEnabledOverride: null,
          inUse: false,
        } satisfies RawFeature,
      }),
    );
  });

  test("expires cache eventually", async () => {
    // change the response so we can validate that we'll serve the stale cache
    const { newFeaturesClient, httpClient } = featuresClientFactory();
    const client = newFeaturesClient();
    await client.initialize();
    const a = client.getFeatures();

    vi.advanceTimersByTime(FEATURES_EXPIRE_MS + 1);
    vi.mocked(httpClient.get).mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          features: {
            featureB: { isEnabled: true, key: "featureB" },
          },
        }),
    } as Response);
    const client2 = newFeaturesClient();
    await client2.initialize();

    const b = client2.getFeatures();

    expect(httpClient.get).toHaveBeenCalledTimes(2);
    expect(a).not.toEqual(b);
  });

  test("handled overrides", async () => {
    // change the response so we can validate that we'll serve the stale cache
    const { newFeaturesClient } = featuresClientFactory();
    // localStorage.clear();
    const client = newFeaturesClient();
    await client.initialize();

    let updated = false;
    client.onUpdated(() => {
      updated = true;
    });

    expect(client.getFeatures().featureA.isEnabled).toBe(true);
    expect(client.getFeatures().featureA.isEnabledOverride).toBe(null);

    expect(updated).toBe(false);

    client.setFeatureOverride("featureA", false);

    expect(updated).toBe(true);
    expect(client.getFeatures().featureA.isEnabled).toBe(true);
    expect(client.getFeatures().featureA.isEnabledOverride).toBe(false);
  });

  test("handled overrides for features not returned by API", async () => {
    // change the response so we can validate that we'll serve the stale cache
    const { newFeaturesClient } = featuresClientFactory();

    // localStorage.clear();
    const client = newFeaturesClient(undefined);
    await client.initialize();

    let updated = false;
    client.onUpdated(() => {
      updated = true;
    });

    expect(client.getFeatures().featureB.isEnabled).toBe(true);
    expect(client.getFeatures().featureB.isEnabledOverride).toBe(null);

    client.setFeatureOverride("featureC", true);

    expect(updated).toBe(true);
    expect(client.getFeatures().featureC).toBeUndefined();
  });

  describe("in use", () => {
    it("handled in use", async () => {
      // change the response so we can validate that we'll serve the stale cache
      const { newFeaturesClient } = featuresClientFactory();

      // localStorage.clear();
      const client = newFeaturesClient(undefined);
      await client.initialize();

      client.setInUse("featureC", true);
      expect(client.getFeatures().featureC.isEnabled).toBe(false);
      expect(client.getFeatures().featureC.isEnabledOverride).toBe(null);

      client.setFeatureOverride("featureC", true);

      expect(client.getFeatures().featureC.isEnabled).toBe(false);
      expect(client.getFeatures().featureC.isEnabledOverride).toBe(true);
    });
  });
});
