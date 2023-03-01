import nock from "nock";
import { describe, expect, test } from "vitest";
import { TRACKING_HOST } from "../src/config";
import bucket from "../src/main";
import { version } from "../package.json";

const KEY = "123";

describe("usage", () => {
  test("golden path - register user, company, send event, send feedback", async () => {
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
    const feedbackMock = nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/feedback/, {
        userId: "foo",
        featureId: "featureId1",
        score: 5,
      })
      .reply(200);

    const bucketInstance = bucket();
    bucketInstance.init(KEY, { persistUser: true });
    await bucketInstance.user("foo", { name: "john doe" });
    userMock.done();

    await bucketInstance.company("bar", { name: "bar corp" });
    companyMock.done();

    await bucketInstance.track("baz", { baz: true });
    eventMock.done();

    await bucketInstance.feedback({
      featureId: "featureId1",
      score: 5,
      userId: "foo",
    });
    feedbackMock.done();
  });

  test("re-register user and send event", async () => {
    const userMock = nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/user/, {
        userId: "foo",
        attributes: {
          name: "john doe",
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

    const userMock2 = nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/user/, {
        userId: "foo2",
        attributes: {
          name: "john doe 2",
        },
      })
      .reply(200);

    const eventMock2 = nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/event/, {
        userId: "foo2",
        event: "baz",
        attributes: {
          baz: true,
        },
      })
      .reply(200);

    const bucketInstance = bucket();
    bucketInstance.init(KEY, { persistUser: true });
    await bucketInstance.user("foo", { name: "john doe" });
    userMock.done();

    await bucketInstance.track("baz", { baz: true });
    eventMock.done();

    await bucketInstance.user("foo2", { name: "john doe 2" });
    userMock2.done();

    // here we ensure that "userId" is updated to "foo2" in the event request
    await bucketInstance.track("baz", { baz: true });
    eventMock2.done();
  });

  test("disable persist user for server-side usage", async () => {
    const userMock = nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/user/, {
        userId: "fooUser",
      })
      .reply(200);

    const companyMock = nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/company/, {
        userId: "fooUser",
        companyId: "fooCompany",
      })
      .reply(200);

    const eventMock = nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/event/, {
        userId: "fooUser",
        event: "fooEvent",
      })
      .reply(200);

    const bucketInstance = bucket();
    bucketInstance.init(KEY, { persistUser: false });

    await bucketInstance.user("fooUser");
    userMock.done();

    await expect(() =>
      bucketInstance.company("fooCompany")
    ).rejects.toThrowError("No userId provided and persistUser is disabled");
    await bucketInstance.company("fooCompany", null, "fooUser");
    companyMock.done();

    await expect(() => bucketInstance.track("fooEvent")).rejects.toThrowError(
      "No userId provided and persistUser is disabled"
    );
    await bucketInstance.track("fooEvent", null, "fooUser");
    eventMock.done();
  });

  test("will send sdk version as header", async () => {
    const userMock = nock(`${TRACKING_HOST}/${KEY}`, {
      reqheaders: {
        "Bucket-Sdk-Version": version,
      },
    })
      .post(/.*\/user/, {
        userId: "foo",
      })
      .reply(200);

    const bucketInstance = bucket();
    bucketInstance.init(KEY);
    await bucketInstance.user("foo");
    userMock.done();
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

    const bucketInstance = bucket();
    bucketInstance.init(KEY, { persistUser: true });
    await bucketInstance.user("foo", { name: "john doe" });
    userMock.done();

    bucketInstance.reset();
    await expect(() => bucketInstance.track("foo")).rejects.toThrowError(
      "User is not set, please call user() first"
    );
  });
});
