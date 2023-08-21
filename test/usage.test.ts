import nock from "nock";
import {
  describe,
  expect,
  vi,
  test,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import { TRACKING_HOST } from "../src/config";
import bucket from "../src/main";
import { version } from "../package.json";
import { closeAblyConnection, openAblyConnection } from "../src/ably";

const KEY = "123";

describe("usage", () => {
  afterEach(() => {
    nock.cleanAll();
    vi.clearAllMocks();
  });

  test("golden path - register user, company, send event, send feedback", async () => {
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/user/, {
        userId: "foo",
        attributes: {
          name: "john doe",
        },
      })
      .reply(200);
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/company/, {
        userId: "foo",
        companyId: "bar",
        attributes: {
          name: "bar corp",
        },
      })
      .reply(200);
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/event/, {
        userId: "foo",
        event: "baz",
        attributes: {
          baz: true,
        },
      })
      .reply(200);
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/feedback/, {
        userId: "foo",
        featureId: "featureId1",
        score: 5,
      })
      .reply(200);

    const bucketInstance = bucket();
    bucketInstance.init(KEY, { persistUser: true });
    await bucketInstance.user("foo", { name: "john doe" });

    await bucketInstance.company("bar", { name: "bar corp" });

    await bucketInstance.track("baz", { baz: true });

    await bucketInstance.feedback({
      featureId: "featureId1",
      score: 5,
      userId: "foo",
    });
  });

  test("re-register user and send event", async () => {
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/user/, {
        userId: "foo",
        attributes: {
          name: "john doe",
        },
      })
      .reply(200);

    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/event/, {
        userId: "foo",
        event: "baz",
        attributes: {
          baz: true,
        },
      })
      .reply(200);

    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/user/, {
        userId: "foo2",
        attributes: {
          name: "john doe 2",
        },
      })
      .reply(200);

    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/event/, {
        userId: "foo2",
        event: "baz",
        attributes: {
          baz: true,
        },
      })
      .reply(200);

    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/event/, {
        userId: "foo2",
        event: "baz",
        companyId: "company1",
        attributes: {
          baz: true,
        },
      })
      .reply(200);

    const bucketInstance = bucket();
    bucketInstance.init(KEY, { persistUser: true });
    await bucketInstance.user("foo", { name: "john doe" });

    await bucketInstance.track("baz", { baz: true });

    await bucketInstance.user("foo2", { name: "john doe 2" });

    // here we ensure that "userId" is updated to "foo2" in the event request
    await bucketInstance.track("baz", { baz: true });

    await bucketInstance.track("baz", { baz: true }, "foo2", "company1");
  });

  test("disable persist user for server-side usage", async () => {
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/user/, {
        userId: "fooUser",
      })
      .reply(200);

    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/company/, {
        userId: "fooUser",
        companyId: "fooCompany",
      })
      .reply(200);

    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/event/, {
        userId: "fooUser",
        event: "fooEvent",
      })
      .reply(200);

    const bucketInstance = bucket();
    bucketInstance.init(KEY, { persistUser: false });

    await bucketInstance.user("fooUser");

    await expect(() =>
      bucketInstance.company("fooCompany"),
    ).rejects.toThrowError("No userId provided and persistUser is disabled");
    await bucketInstance.company("fooCompany", null, "fooUser");

    await expect(() => bucketInstance.track("fooEvent")).rejects.toThrowError(
      "No userId provided and persistUser is disabled",
    );
    await bucketInstance.track("fooEvent", null, "fooUser");
  });

  test("will send sdk version as header", async () => {
    nock(`${TRACKING_HOST}/${KEY}`, {
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
  });

  test("can reset user", async () => {
    nock(`${TRACKING_HOST}/${KEY}`)
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

    bucketInstance.reset();
    await expect(() => bucketInstance.track("foo")).rejects.toThrowError(
      "User is not set, please call user() first",
    );
  });
});

const message = {
  question: "How are you",
  showAfter: new Date().valueOf(),
  showBefore: new Date().valueOf(),
};

describe("feedback prompting", () => {
  beforeAll(() => {
    vi.mock("/src/ably", () => {
      return {
        openAblyConnection: vi
          .fn()
          .mockImplementation(
            (
              _a: string,
              _b: string,
              _c: string,
              callback: (data: any) => void,
            ) => {
              callback(message);
              return Promise.resolve("fake_client");
            },
          ),
        closeAblyConnection: vi.fn(),
      };
    });
  });

  afterAll(() => {
    vi.unmock("/src/ably");
  });

  afterEach(() => {
    nock.cleanAll();
    vi.clearAllMocks();
  });

  test("initiates and resets feedback prompting", async () => {
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/feedback\/prompting-init/, {
        userId: "foo",
      })
      .reply(200, { success: true, channel: "test-channel" });

    const bucketInstance = bucket();
    bucketInstance.init(KEY);

    await bucketInstance.initFeedbackPrompting("foo");

    expect(openAblyConnection).toBeCalledTimes(1);
    expect(openAblyConnection).toBeCalledWith(
      `${TRACKING_HOST}/${KEY}/feedback/prompting-auth`,
      "foo",
      "test-channel",
      expect.anything(),
      expect.anything(),
    );

    // call twice, expect only one reset to go through
    bucketInstance.reset();
    bucketInstance.reset();

    expect(closeAblyConnection).toBeCalledTimes(1);
    expect(closeAblyConnection).toBeCalledWith("fake_client");
  });

  test("does not initiate feedback prompting if server does not agree", async () => {
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/feedback\/prompting-init/, {
        userId: "foo",
      })
      .reply(200, { success: false });

    const bucketInstance = bucket();
    bucketInstance.init(KEY);

    await bucketInstance.initFeedbackPrompting("foo");

    expect(openAblyConnection).toBeCalledTimes(0);
  });

  test("initiates feedback prompting automatically on user call if configured", async () => {
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/feedback\/prompting-init/)
      .times(2)
      .reply(200, { success: true, channel: "test-channel" });
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/user/)
      .times(2)
      .reply(200);

    const bucketInstance = bucket();
    bucketInstance.init(KEY, {
      automaticFeedbackPrompting: true,
      persistUser: true,
    });

    // connects to ably for first time
    await bucketInstance.user("foo");
    expect(openAblyConnection).toBeCalledTimes(1);

    // automatically resets if another user persisted
    await bucketInstance.user("boo");
    expect(closeAblyConnection).toBeCalledTimes(1);
    expect(openAblyConnection).toBeCalledTimes(2);
  });

  test("reset closes previously open feedback prompting connection", async () => {
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/feedback\/prompting-init/)
      .reply(200, { success: true, channel: "test-channel" });

    const bucketInstance = bucket();
    bucketInstance.init(KEY);

    // connects to ably for first time
    await bucketInstance.initFeedbackPrompting("foo");
    expect(openAblyConnection).toBeCalledTimes(1);

    bucketInstance.reset();
    expect(closeAblyConnection).toBeCalledTimes(1);
  });

  test("propagates the callback to the proper method", async () => {
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/feedback\/prompting-init/)
      .reply(200, { success: true, channel: "test-channel" });

    const bucketInstance = bucket();
    bucketInstance.init(KEY);

    // connects to ably for first time
    const callback = vi.fn();

    await bucketInstance.initFeedbackPrompting("foo", callback);

    expect(callback).toBeCalledTimes(1);
    expect(callback).toBeCalledWith({
      question: "How are you",
      showAfter: new Date(message.showAfter),
      showBefore: new Date(message.showBefore),
    });
  });

  test("rejects if feedback prompting already initialized", async () => {
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/feedback\/prompting-init/)
      .reply(200, { success: true, channel: "test-channel" });

    const bucketInstance = bucket();
    bucketInstance.init(KEY);

    await bucketInstance.initFeedbackPrompting("foo");
    await expect(() =>
      bucketInstance.initFeedbackPrompting("foo"),
    ).rejects.toThrowError(
      "Feedback prompting already initialized. Use reset() first.",
    );
  });
});
