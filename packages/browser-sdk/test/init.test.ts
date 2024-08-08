import { DefaultBodyType, http, StrictRequest } from "msw";
import { beforeEach, describe, expect, test, vi } from "vitest";

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
  test("will accept setup with key and debug flag", async () => {
    const bucketInstance = new BucketClient(
      KEY,
      { user: { id: 42 } },
      { logger },
    );
    const spyInit = vi.spyOn(bucketInstance, "initialize");
    // const spyLog = vi.spyOn(console, "log");
    // spyLog.mockImplementationOnce(() => null);
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
    const bucketInstance = new BucketClient(
      KEY,
      { user: { id: "foo" } },
      { host: "https://example.com" },
    );
    await bucketInstance.initialize();

    expect(usedSpecialHost).toBe(true);
  });
});
