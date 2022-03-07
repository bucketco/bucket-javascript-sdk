import { describe, test } from "vitest";
import nock from "nock";
import lib from "../src/main";
import { TRACKING_HOST } from "../src/config";

const KEY = "123";

describe("usage", () => {
  test("golden path - register user, company, send event", async () => {
    const userMock = nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/user/, {
        userId: "foo",
        attributes: {
          name: "john doe",
        },
      })
      .reply(200);
    const companyMock = nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/company/, {
        userId: "foo",
        companyId: "bar",
        attributes: {
          name: "bar corp",
        },
      })
      .reply(200);
    const eventMock = nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/event/, {
        userId: "foo",
        event: "baz",
        attributes: {
          baz: true,
        },
      })
      .reply(200);

    const bucket = lib(KEY);
    await bucket.user("foo", { name: "john doe" });
    userMock.done();

    await bucket.company("bar", { name: "bar corp" });
    companyMock.done();

    await bucket.event("baz", { baz: true });
    eventMock.done();
  });
});
