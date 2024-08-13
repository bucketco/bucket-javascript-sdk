import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import {
  FEATURES_EXPIRE_MS,
  FeaturesClient,
  FeaturesOptions,
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
    newFeaturesClient: function newFeaturesClient(options?: FeaturesOptions) {
      return new FeaturesClient(
        httpClient,
        { user: { id: "123" } },
        testLogger,
        {
          cache,
          ...options,
        },
      );
    },
  };
}

describe("FeaturesClient unit tests", () => {
  test("fetches features", async () => {
    const featuresClient = featuresClientFactory().newFeaturesClient();

    await featuresClient.initialize();
    expect(featuresClient.getFeatures()).toEqual(featuresResult);
  });

  test("return fallback features on failure", async () => {
    const { newFeaturesClient, httpClient } = featuresClientFactory();

    vi.mocked(httpClient.get).mockRejectedValue(
      new Error("Failed to fetch features"),
    );
    const featuresClient = newFeaturesClient({
      fallbackFeatures: ["huddle"],
    });
    await featuresClient.initialize();
    expect(featuresClient.getFeatures()).toEqual({ huddle: true });
  });

  test("caches response", async () => {
    const { newFeaturesClient, httpClient } = featuresClientFactory();

    const featuresClient = newFeaturesClient();
    await featuresClient.initialize();

    expect(httpClient.get).toBeCalledTimes(1);

    const featuresClient2 = newFeaturesClient();
    await featuresClient2.initialize();
    const features = featuresClient2.getFeatures();

    expect(features).toEqual(featuresResult);
    expect(httpClient.get).toBeCalledTimes(1);
  });

  test("maintains previously successful features on negative response", async () => {
    const { newFeaturesClient, httpClient } = featuresClientFactory();
    const featuresClient = newFeaturesClient();
    await featuresClient.initialize();

    vi.mocked(httpClient.get).mockRejectedValue(
      new Error("Failed to fetch features"),
    );
    // expect(httpClientGetSpy).toBeCalledTimes(0);

    // vi.mocked(fetch).mockRejectedValue(new Error("Failed to fetch features"));
    vi.advanceTimersByTime(60000);

    await featuresClient.fetchFeatures();

    const staleFeatures = featuresClient.getFeatures();
    expect(staleFeatures).toEqual(featuresResult);
  });

  test("disable caching negative response", async () => {
    const { newFeaturesClient, httpClient } = featuresClientFactory();

    vi.mocked(httpClient.get).mockRejectedValue(
      new Error("Failed to fetch features"),
    );

    for (let i = 0; i < 5; i++) {
      const featuresClient = newFeaturesClient({ failureRetryAttempts: false });
      await featuresClient.initialize();

      expect(httpClient.get).toHaveBeenCalledTimes(i + 1);
    }
  });

  describe("stale cache while reevaluating", async () => {
    test("when stale cache is success response", async () => {
      const response = {
        success: true,
        features: {
          featureB: { isEnabled: true, key: "featureB" },
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
        failureRetryAttempts: false,
        staleWhileRevalidate: true,
      });
      expect(httpClient.get).toHaveBeenCalledTimes(0);

      await client.initialize();

      expect(httpClient.get).toHaveBeenCalledTimes(1);
      const client2 = newFeaturesClient({
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
            features: {
              featureA: { isEnabled: true, key: "featureA" },
            },
          }),
      } as Response);

      vi.advanceTimersByTime(TEST_STALE_MS + 1);

      await client2.initialize();
      expect(client.getFeatures()).toEqual(client2.getFeatures());

      // new fetch was fired in the background
      expect(httpClient.get).toHaveBeenCalledTimes(2);
    });

    test("when stale cache is failed response", async () => {
      const { newFeaturesClient, httpClient } = featuresClientFactory();
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

      const client = newFeaturesClient({
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
            features: {
              featureB: {
                isEnabled: true,
                key: "featureB",
                targetingVersion: 1,
              },
            },
          });
        },
      } as Response);

      vi.advanceTimersByTime(TEST_STALE_MS + 1);
      const client2 = newFeaturesClient();
      await client2.initialize();

      expect(client2.getFeatures()).toEqual({ featureB: true });

      // new fetch was fired
      // stale while validate in the background
      expect(httpClient.get).toHaveBeenCalledTimes(2);
    });
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
});

describe(`sends "check" events`, () => {
  it("sends check event", async () => {
    const { newFeaturesClient, httpClient } = featuresClientFactory();
    const client = newFeaturesClient();
    await client.initialize();

    const _ = client.getFeatures()?.featureA;
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith({
      path: "features/events",
      body: {
        action: "check",
        evalContext: {
          user: {
            id: "123",
          },
        },
        evalResult: true,
        key: "featureA",
        targetingVersion: 1,
      },
    });
  });

  it("sends check event for not-enabled features", async () => {
    // disabled features don't appear in the API response
    const { newFeaturesClient, httpClient } = featuresClientFactory();
    const client = newFeaturesClient();
    await client.initialize();

    const _ = client.getFeatures()?.notAvailableFeature;
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith({
      path: "features/events",
      body: {
        action: "check",
        evalContext: {
          user: {
            id: "123",
          },
        },
        evalResult: false,
        key: "notAvailableFeature",
      },
    });
  });
});
