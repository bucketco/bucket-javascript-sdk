import { afterAll, beforeEach, describe, expect, it, test, vi } from "vitest";

import { APIFeatureResponse } from "../dist/src/feature/features";
import { version } from "../package.json";
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
        {
          user: { id: "123" },
          company: { id: "456" },
          other: { eventId: "big-conference1" },
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

describe("FeaturesClient unit tests", () => {
  test("fetches features", async () => {
    const { newFeaturesClient, httpClient } = featuresClientFactory();
    const featuresClient = newFeaturesClient();
    await featuresClient.initialize();
    expect(featuresClient.getFeatures()).toEqual(featuresResult);

    expect(httpClient.get).toBeCalledTimes(1);
    const calls = vi.mocked(httpClient.get).mock.calls.at(0);
    const { params, path, timeoutMs } = calls?.[0]!;

    const paramsObj = Object.fromEntries(new URLSearchParams(params));
    expect(paramsObj).toEqual({
      "bucket-sdk-version": "browser-sdk/" + version,
      "context.user.id": "123",
      "context.company.id": "456",
      "context.other.eventId": "big-conference1",
      publishableKey: "pk",
    });

    expect(path).toEqual("/features/enabled");
    expect(timeoutMs).toEqual(5000);
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
        } satisfies APIFeatureResponse,
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
    expect(client.getFeatures()).toEqual({ featureB: true });

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
            } satisfies APIFeatureResponse,
          },
        }),
    } as Response);

    vi.advanceTimersByTime(TEST_STALE_MS + 1);

    await client2.initialize();

    // new fetch was fired in the background
    expect(httpClient.get).toHaveBeenCalledTimes(2);

    await vi.waitFor(() =>
      expect(client2.getFeatures()).toEqual({ featureA: true }),
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
          company: {
            id: "456",
          },
          other: {
            eventId: "big-conference1",
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
          company: {
            id: "456",
          },
          other: {
            eventId: "big-conference1",
          },
        },
        evalResult: false,
        key: "notAvailableFeature",
      },
    });
  });
});
