import nock from "nock";
import { describe, expect, test, vi } from "vitest";

import * as bundling from "is-bundling-for-browser-or-node";
import bucket from "../src/main";

const KEY = "123";
const CUSTOM_HOST = "https://example.com";

vi.mock("is-bundling-for-browser-or-node");

describe("init", () => {
  test("will accept setup with key and debug flag", () => {
    const bucketInstance = bucket();
    const spyInit = vi.spyOn(bucketInstance, "init");
    const spyLog = vi.spyOn(console, "log");
    spyLog.mockImplementationOnce(() => null);
    bucketInstance.init(KEY, { debug: true });
    expect(spyInit).toHaveBeenCalled();
    expect(spyLog).toHaveBeenCalled();
  });

  test("will accept setup with custom host", async () => {
    const userMock = nock(`${CUSTOM_HOST}/${KEY}`)
      .post(/.*\/user/, {
        userId: "foo",
      })
      .reply(200);
    const bucketInstance = bucket();
    bucketInstance.init(KEY, { host: CUSTOM_HOST });
    await bucketInstance.user("foo");
    userMock.done();
  });

  test("will reject setup without key", async () => {
    expect(() => bucket().init("")).toThrowError(
      "Tracking key was not provided"
    );
  });

  test("will reject user call without key", async () => {
    const bucketInstance = bucket();
    await expect(() => bucketInstance.user("foo")).rejects.toThrowError(
      "Tracking key is not set, please call init() first"
    );
  });

  test("will reject automatic feedback prompting if not persisting user", async () => {
    vi.spyOn(bundling, "isForNode", "get").mockReturnValue(false);

    const bucketInstance = bucket();
    expect(() =>
      bucketInstance.init(KEY, {
        automaticFeedbackPrompting: true,
        persistUser: false,
      })
    ).toThrowError(
      "Feedback prompting is not supported when persistUser is disabled"
    );
  });

  test("will reject automatic feedback prompting if in node environment", async () => {
    vi.spyOn(bundling, "isForNode", "get").mockReturnValue(true);

    const bucketInstance = bucket();
    expect(() =>
      bucketInstance.init(KEY, {
        automaticFeedbackPrompting: true,
        persistUser: false,
      })
    ).toThrowError(
      "Feedback prompting is not supported in Node.js environment"
    );
  });
});
