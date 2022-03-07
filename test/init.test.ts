import nock from "nock";
import { describe, expect, spyOn, test } from "vitest";
import { TRACKING_HOST } from "../src/config";
import lib from "../src/main";

const KEY = "123";

describe("init", () => {
  test("will accept setup with key", async () => {
    const mock = { lib };
    const spy = spyOn(mock, "lib");
    const bucket = mock.lib("123");
    expect(spy).toHaveBeenCalled();
    expect(bucket.trackingKey).toBe("123");
  });

  test("will reject setup without key", async () => {
    expect(() => lib("")).toThrowError("Tracking key is not provided");
  });

  test("can reset user", async () => {
    const userMock = nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/user/, {
        userId: "foo",
        attributes: {
          name: "john doe",
        },
      })
      .reply(200);

    const bucket = lib(KEY);
    await bucket.user("foo", { name: "john doe" });
    userMock.done();

    bucket.reset();
    expect(() => bucket.event("foo")).toThrowError("No userId provided");
  });
});
