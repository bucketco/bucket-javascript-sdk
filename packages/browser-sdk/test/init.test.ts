import { DefaultBodyType, http, StrictRequest } from "msw";
import { beforeEach, describe, expect, test, vi, vitest } from "vitest";

import { BucketClient } from "../src";

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
        "https://example.com/features/enabled",
        ({ request }: { request: StrictRequest<DefaultBodyType> }) => {
          usedSpecialHost = true;
          return getFeatures({ request });
        },
      ),
    );
    const bucketInstance = new BucketClient({
      publishableKey: KEY,
      user: { id: "foo" },
      host: "https://example.com",
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

  test("can disable user/company tracking", async () => {
    const user = vitest.spyOn(BucketClient.prototype as any, "user");
    const company = vitest.spyOn(BucketClient.prototype as any, "company");

    const bucketInstance = new BucketClient({
      publishableKey: KEY,
      user: { id: "foo" },
      host: "https://example.com",
      trackContext: false,
    });
    await bucketInstance.initialize();

    expect(user).not.toHaveBeenCalled();
    expect(company).not.toHaveBeenCalled();
  });
});
