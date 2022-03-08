import nock from "nock";
import { describe, expect, spyOn, test } from "vitest";
import bucket from "../src/main";

const KEY = "123";
const CUSTOM_HOST = "http://example.com";

describe("init", () => {
  test("will accept setup with key and debug flag", () => {
    const bucketInstance = bucket();
    const spyInit = spyOn(bucketInstance, "init");
    const spyLog = spyOn(console, "log");
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
});
