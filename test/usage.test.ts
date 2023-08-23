import * as bundling from "is-bundling-for-browser-or-node";
import nock from "nock";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import { version } from "../package.json";
import { closeAblyConnection, openAblyConnection } from "../src/ably";
import { TRACKING_HOST } from "../src/config";
import bucket from "../src/main";
import { FeedbackPrompt, FeedbackPromptReplyHandler } from "../src/types";

const KEY = "123";

vi.mock("/src/ably");
vi.mock("is-bundling-for-browser-or-node");

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
      bucketInstance.company("fooCompany")
    ).rejects.toThrowError("No userId provided and persistUser is disabled");
    await bucketInstance.company("fooCompany", null, "fooUser");

    await expect(() => bucketInstance.track("fooEvent")).rejects.toThrowError(
      "No userId provided and persistUser is disabled"
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
      "User is not set, please call user() first"
    );
  });
});

describe("feedback prompting", () => {
  beforeAll(() => {
    vi.mocked(openAblyConnection).mockResolvedValue("fake_client" as any);
    vi.mocked(closeAblyConnection).mockResolvedValue(undefined);
  });

  beforeEach(() => {
    vi.spyOn(bundling, "isForNode", "get").mockReturnValue(false);
  });

  afterEach(() => {
    nock.cleanAll();
    vi.clearAllMocks();
  });

  test("rejects feedback prompting in node environment", async () => {
    vi.spyOn(bundling, "isForNode", "get").mockReturnValue(true);

    const bucketInstance = bucket();
    bucketInstance.init(KEY);

    await expect(
      bucketInstance.initFeedbackPrompting("foo")
    ).rejects.toThrowError(
      "Feedback prompting is not supported in Node.js environment"
    );
  });

  test("initiates and resets feedback prompting", async () => {
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/feedback\/prompting-init/, {
        userId: "foo",
      })
      .reply(200, { success: true, channel: "test-channel" });

    const bucketInstance = bucket();
    bucketInstance.init(KEY, { persistUser: false });

    await bucketInstance.initFeedbackPrompting("foo");

    expect(openAblyConnection).toBeCalledTimes(1);
    expect(openAblyConnection).toBeCalledWith(
      `${TRACKING_HOST}/${KEY}/feedback/prompting-auth`,
      "foo",
      "test-channel",
      expect.anything(),
      expect.anything()
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
    bucketInstance.init(KEY, { persistUser: false });

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
    bucketInstance.init(KEY, { persistUser: false });

    // connects to ably for first time
    await bucketInstance.initFeedbackPrompting("foo");
    expect(openAblyConnection).toBeCalledTimes(1);

    bucketInstance.reset();
    expect(closeAblyConnection).toBeCalledTimes(1);
  });

  test("rejects if feedback prompting already initialized", async () => {
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/feedback\/prompting-init/)
      .reply(200, { success: true, channel: "test-channel" });

    const bucketInstance = bucket();
    bucketInstance.init(KEY, { persistUser: false });

    await bucketInstance.initFeedbackPrompting("foo");
    await expect(() =>
      bucketInstance.initFeedbackPrompting("foo")
    ).rejects.toThrowError(
      "Feedback prompting already initialized. Use reset() first."
    );
  });
});

describe("feedback state management", () => {
  const bucketInstance = bucket();
  bucketInstance.init(KEY, { persistUser: false });

  const goodMessage = {
    question: "How are you",
    showAfter: new Date(Date.now() - 1000).valueOf(),
    showBefore: new Date(Date.now() + 1000).valueOf(),
    promptId: "123",
    featureId: "456",
  };
  const badMessage = {
    foo: "bar",
  };

  beforeEach((tc) => {
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/feedback\/prompting-init/)
      .reply(200, { success: true, channel: "test-channel" });

    if (
      tc.meta.name.includes("propagates") ||
      tc.meta.name.includes("ignores")
    ) {
      vi.mocked(openAblyConnection).mockImplementation(
        (_a, _b_, _c, callback, _d) => {
          callback(goodMessage);
          return Promise.resolve("fake_client" as any);
        }
      );
    } else if (tc.meta.name.includes("blocks")) {
      vi.mocked(openAblyConnection).mockImplementation(
        (_a, _b_, _c, callback, _d) => {
          callback(badMessage);
          return Promise.resolve("fake_client" as any);
        }
      );
    }

    bucketInstance.reset();
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    nock.cleanAll();
  });

  const expectAsyncNockDone = async (nk: nock.Scope) => {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < 10; i++) {
      if (nk.isDone()) {
        expect(nk.isDone()).toBe(true);
      }
      await delay(100);
    }

    expect(nk.isDone()).toBe(true);
  };

  const setupFeedbackPromptEventNock = (event: string) => {
    return nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/feedback\/prompt-events/, {
        userId: "foo",
        promptId: "123",
        action: event,
      })
      .reply(200, { success: true });
  };

  test("ignores prompt if expired", async () => {
    const n1 = setupFeedbackPromptEventNock("received");

    vi.useFakeTimers();
    vi.setSystemTime(goodMessage.showAfter - 1000);

    const callback = vi.fn();

    await bucketInstance.initFeedbackPrompting("foo", callback);

    expect(callback).not.toBeCalled;

    expectAsyncNockDone(n1);

    expect(localStorage.getItem("prompt-foo")).toBeNull();

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("ignores prompt if timed but feedback prompting disabled/user changed", async () => {
    const n1 = setupFeedbackPromptEventNock("received");

    vi.useFakeTimers();
    vi.setSystemTime(goodMessage.showAfter - 500);

    const callback = vi.fn();

    await bucketInstance.initFeedbackPrompting("foo", callback);
    bucketInstance.reset();

    vi.runAllTimers();
    expect(callback).not.toBeCalled;

    expectAsyncNockDone(n1);

    expect(localStorage.getItem("prompt-foo")).toBeNull();

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("ignores prompt if already seen", async () => {
    const n1 = setupFeedbackPromptEventNock("received");

    localStorage.setItem("prompt-foo", "123");

    const callback = vi.fn();

    await bucketInstance.initFeedbackPrompting("foo", callback);

    expect(callback).not.toBeCalled;

    expectAsyncNockDone(n1);
  });

  test("propagates prompt to the callback", async () => {
    const n1 = setupFeedbackPromptEventNock("received");
    const n2 = setupFeedbackPromptEventNock("shown");

    const callback = vi.fn();

    await bucketInstance.initFeedbackPrompting("foo", callback);

    expect(callback).toBeCalledTimes(1);
    expect(callback).toBeCalledWith(
      {
        question: "How are you",
        showAfter: new Date(goodMessage.showAfter),
        showBefore: new Date(goodMessage.showBefore),
        promptId: "123",
        featureId: "456",
      },
      expect.anything()
    );

    expectAsyncNockDone(n1);
    expectAsyncNockDone(n2);

    expect(localStorage.getItem("prompt-foo")).toBeNull();
  });

  test("propagates prompt to the init-supplied callback", async () => {
    setupFeedbackPromptEventNock("received");
    setupFeedbackPromptEventNock("shown");

    const callback = vi.fn();

    const bi = bucket();
    bi.init(KEY, { persistUser: false, feedbackPromptHandler: callback });

    await bi.initFeedbackPrompting("foo", callback);

    expect(callback).toBeCalledTimes(1);
  });

  test("propagates timed prompt to the callback", async () => {
    const n1 = setupFeedbackPromptEventNock("received");
    const n2 = setupFeedbackPromptEventNock("shown");

    const callback = vi.fn();

    vi.useFakeTimers();
    vi.setSystemTime(goodMessage.showAfter - 500);

    await bucketInstance.initFeedbackPrompting("foo", callback);

    expect(callback).not.toBeCalled();

    vi.runAllTimers();

    expect(callback).toBeCalledTimes(1);

    expectAsyncNockDone(n1);
    expectAsyncNockDone(n2);

    expect(localStorage.getItem("prompt-foo")).toBeNull();

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("propagates prompt to the callback and reacts to dismissal", async () => {
    const n1 = setupFeedbackPromptEventNock("received");
    const n2 = setupFeedbackPromptEventNock("shown");
    const n3 = setupFeedbackPromptEventNock("dismissed");

    const callback = (_: FeedbackPrompt, cb: FeedbackPromptReplyHandler) => {
      cb(null);
    };

    await bucketInstance.initFeedbackPrompting("foo", callback);

    expectAsyncNockDone(n1);
    expectAsyncNockDone(n2);
    expectAsyncNockDone(n3);

    expect(localStorage.getItem("prompt-foo")).toBe("123");
  });

  test("propagates prompt to the callback and reacts to feedback", async () => {
    const n1 = setupFeedbackPromptEventNock("received");
    const n2 = setupFeedbackPromptEventNock("shown");

    const n3 = nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/feedback/, {
        userId: "foo",
        featureId: "456",
        promptId: "123",
        companyId: "bar",
        comment: "hello",
        score: 5,
      })
      .reply(200);

    const callback = (_: FeedbackPrompt, cb: FeedbackPromptReplyHandler) => {
      cb({
        companyId: "bar",
        score: 5,
        comment: "hello",
      });
    };

    await bucketInstance.initFeedbackPrompting("foo", callback);

    expectAsyncNockDone(n1);
    expectAsyncNockDone(n2);
    expectAsyncNockDone(n3);

    expect(localStorage.getItem("prompt-foo")).toBe("123");
  });

  test("blocks invalid messages", async () => {
    const callback = vi.fn();

    await expect(
      bucketInstance.initFeedbackPrompting("foo", callback)
    ).rejects.toThrowError();

    expect(callback).not.toBeCalled;
  });
});
