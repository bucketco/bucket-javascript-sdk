import { DefaultBodyType, http, StrictRequest } from "msw";
import { beforeEach, describe, expect, test, vi, vitest } from "vitest";

import { BucketClient } from "../src";
import { HttpClient } from "../src/httpClient";

import { getFeatures } from "./mocks/handlers";
import { server } from "./mocks/server";

const KEY = "123";

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("init", () => {
  test("will accept setup with key and debug logger", async () => {
    const bucketInstance = new BucketClient({
      publishableKey: KEY,
      user: { id: 42 },
      company: { id: 42 },
      logger,
    });
    const spyInit = vi.spyOn(bucketInstance, "initialize");

    await bucketInstance.initialize();
    expect(spyInit).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  test("will accept setup with custom host", async () => {
    let usedSpecialHost = false;

    server.use(
      http.get(
        "https://example.com/features/evaluated",
        ({ request }: { request: StrictRequest<DefaultBodyType> }) => {
          usedSpecialHost = true;
          return getFeatures({ request });
        },
      ),
    );
    const bucketInstance = new BucketClient({
      publishableKey: KEY,
      user: { id: "foo" },
      apiBaseUrl: "https://example.com",
    });
    await bucketInstance.initialize();

    expect(usedSpecialHost).toBe(true);
  });

  test("automatically does user/company tracking", async () => {
    const user = vitest.spyOn(BucketClient.prototype as any, "user");
    const company = vitest.spyOn(BucketClient.prototype as any, "company");

    const bucketInstance = new BucketClient({
      publishableKey: KEY,
      user: { id: "foo" },
      company: { id: "bar" },
    });
    await bucketInstance.initialize();

    expect(user).toHaveBeenCalled();
    expect(company).toHaveBeenCalled();
  });

  test("can disable tracking and auto. feedback surveys", async () => {
    const post = vitest.spyOn(HttpClient.prototype as any, "post");

    const bucketInstance = new BucketClient({
      publishableKey: KEY,
      user: { id: "foo" },
      apiBaseUrl: "https://example.com",
      enableTracking: false,
      feedback: {
        enableAutoFeedback: false,
      },
    });
    await bucketInstance.initialize();
    await bucketInstance.track("test");

    expect(post).not.toHaveBeenCalled();
  });
});
