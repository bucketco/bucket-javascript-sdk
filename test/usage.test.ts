import flushPromises from "flush-promises";
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
import { TRACKING_HOST } from "../src/config";
import bucket from "../src/main";
import {
  checkPromptMessageCompleted,
  markPromptMessageCompleted,
} from "../src/prompt-storage";
import { closeAblySSEChannel, openAblySSEChannel } from "../src/sse";
import {
  FeedbackPrompt,
  FeedbackPromptHandler,
  FeedbackPromptReplyHandler,
} from "../src/types";

const KEY = "123";

vi.mock("../src/sse");
vi.mock("is-bundling-for-browser-or-node");
vi.mock("../src/prompt-storage", () => {
  return {
    markPromptMessageCompleted: vi.fn(),
    checkPromptMessageCompleted: vi.fn(),
  };
});

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

describe("feedback prompting", () => {
  beforeAll(() => {
    vi.mocked(openAblySSEChannel).mockReturnValue("fake_client" as any);
    vi.mocked(closeAblySSEChannel).mockResolvedValue(undefined);
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
      bucketInstance.initFeedbackPrompting("foo"),
    ).rejects.toThrowError(
      "Feedback prompting is not supported in Node.js environment",
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

    expect(openAblySSEChannel).toBeCalledTimes(1);
    expect(openAblySSEChannel).toBeCalledWith(
      `${TRACKING_HOST}/${KEY}/feedback/prompting-auth`,
      "foo",
      "test-channel",
      expect.anything(),
      expect.anything(),
    );

    // call twice, expect only one reset to go through
    bucketInstance.reset();
    bucketInstance.reset();

    expect(closeAblySSEChannel).toBeCalledTimes(1);
    expect(closeAblySSEChannel).toBeCalledWith("fake_client");
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

    expect(openAblySSEChannel).toBeCalledTimes(0);
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
    expect(openAblySSEChannel).toBeCalledTimes(1);

    // automatically resets if another user persisted
    await bucketInstance.user("boo");
    expect(closeAblySSEChannel).toBeCalledTimes(1);
    expect(openAblySSEChannel).toBeCalledTimes(2);
  });

  test("reset closes previously open feedback prompting connection", async () => {
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/feedback\/prompting-init/)
      .reply(200, { success: true, channel: "test-channel" });

    const bucketInstance = bucket();
    bucketInstance.init(KEY, { persistUser: false });

    // connects to ably for first time
    await bucketInstance.initFeedbackPrompting("foo");
    expect(openAblySSEChannel).toBeCalledTimes(1);

    bucketInstance.reset();
    expect(closeAblySSEChannel).toBeCalledTimes(1);
  });

  test("rejects if feedback prompting already initialized", async () => {
    nock(`${TRACKING_HOST}/${KEY}`)
      .post(/.*\/feedback\/prompting-init/)
      .reply(200, { success: true, channel: "test-channel" });

    const bucketInstance = bucket();
    bucketInstance.init(KEY, { persistUser: false });

    await bucketInstance.initFeedbackPrompting("foo");
    await expect(() =>
      bucketInstance.initFeedbackPrompting("foo"),
    ).rejects.toThrowError(
      "Feedback prompting already initialized. Use reset() first.",
    );
  });
});

describe("feedback state management", () => {
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
      tc.task.name.includes("propagates") ||
      tc.task.name.includes("ignores")
    ) {
      vi.mocked(openAblySSEChannel).mockImplementation(
        (_a, _b_, _c, callback, _d) => {
          callback(goodMessage);
          return "fake_client" as any;
        },
      );
    } else if (tc.task.name.includes("blocks")) {
      vi.mocked(openAblySSEChannel).mockImplementation(
        (_a, _b_, _c, callback, _d) => {
          callback(badMessage);
          return "fake_client" as any;
        },
      );
    }
  });

  afterEach(() => {
    vi.resetAllMocks();
    nock.cleanAll();
  });

  const nockWait = (n: nock.Scope) => {
    return new Promise((resolve) => {
      n.on("replied", () => {
        resolve(undefined);
      });
    });
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

  const createBucketInstance = (callback: FeedbackPromptHandler) => {
    const bucketInstance = bucket();
    bucketInstance.init(KEY, {
      persistUser: false,
      feedbackPromptHandler: callback,
    });
    return bucketInstance;
  };

  test("ignores prompt if expired", async () => {
    const n1 = setupFeedbackPromptEventNock("received");

    vi.useFakeTimers();
    vi.setSystemTime(goodMessage.showAfter - 1000);

    const callback = vi.fn();

    const bucketInstance = createBucketInstance(callback);
    await bucketInstance.initFeedbackPrompting("foo");

    await flushPromises();

    expect(callback).not.toBeCalled;

    expect(n1.isDone()).toBe(false);

    expect(markPromptMessageCompleted).not.toHaveBeenCalledOnce();

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("ignores prompt if timed but feedback prompting disabled/user changed", async () => {
    const n1 = setupFeedbackPromptEventNock("received");

    vi.useFakeTimers();
    vi.setSystemTime(goodMessage.showAfter - 500);

    const callback = vi.fn();

    const bucketInstance = createBucketInstance(callback);
    await bucketInstance.initFeedbackPrompting("foo");

    bucketInstance.reset();

    vi.runAllTimers();

    await nockWait(n1);
    await flushPromises();

    expect(callback).not.toBeCalled;

    expect(markPromptMessageCompleted).not.toHaveBeenCalledOnce();

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("ignores prompt if already seen", async () => {
    vi.mocked(checkPromptMessageCompleted).mockReturnValue(true);

    const callback = vi.fn();

    const bucketInstance = createBucketInstance(callback);
    await bucketInstance.initFeedbackPrompting("foo");

    await flushPromises();
    expect(callback).not.toBeCalled;

    expect(checkPromptMessageCompleted).toHaveBeenCalledOnce();
    expect(checkPromptMessageCompleted).toHaveBeenCalledWith("foo", "123");
  });

  test("propagates prompt to the callback", async () => {
    const n1 = setupFeedbackPromptEventNock("received");
    const n2 = setupFeedbackPromptEventNock("shown");

    const callback = vi.fn();
    const bucketInstance = createBucketInstance(callback);
    await bucketInstance.initFeedbackPrompting("foo");

    await nockWait(n1);
    await nockWait(n2);
    await flushPromises();

    expect(callback).toBeCalledTimes(1);
    expect(callback).toBeCalledWith(
      {
        question: "How are you",
        showAfter: new Date(goodMessage.showAfter),
        showBefore: new Date(goodMessage.showBefore),
        promptId: "123",
        featureId: "456",
      },
      expect.anything(),
    );

    expect(n1.isDone()).toBe(true);
    expect(n2.isDone()).toBe(true);

    expect(markPromptMessageCompleted).not.toHaveBeenCalled();
  });

  test("propagates timed prompt to the callback", async () => {
    const n1 = setupFeedbackPromptEventNock("received");
    const n2 = setupFeedbackPromptEventNock("shown");

    const callback = vi.fn();

    vi.useFakeTimers();
    vi.setSystemTime(goodMessage.showAfter - 500);

    const bucketInstance = createBucketInstance(callback);
    await bucketInstance.initFeedbackPrompting("foo");

    await flushPromises();

    expect(callback).not.toBeCalled();

    vi.runAllTimers();

    await nockWait(n1);
    await nockWait(n2);
    await flushPromises();

    expect(callback).toBeCalledTimes(1);

    expect(markPromptMessageCompleted).not.toHaveBeenCalled();

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("propagates prompt to the callback and reacts to dismissal", async () => {
    const n1 = setupFeedbackPromptEventNock("received");
    const n2 = setupFeedbackPromptEventNock("shown");
    const n3 = setupFeedbackPromptEventNock("dismissed");

    const callback = async (
      _: FeedbackPrompt,
      cb: FeedbackPromptReplyHandler,
    ) => {
      await cb(null);
    };

    const bucketInstance = createBucketInstance(callback);
    await bucketInstance.initFeedbackPrompting("foo");

    await nockWait(n1);
    await nockWait(n2);
    await nockWait(n3);
    await flushPromises();

    expect(markPromptMessageCompleted).toHaveBeenCalledOnce();
    expect(markPromptMessageCompleted).toHaveBeenCalledWith(
      "foo",
      "123",
      new Date(goodMessage.showBefore),
    );
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

    const callback = async (
      _: FeedbackPrompt,
      cb: FeedbackPromptReplyHandler,
    ) => {
      await cb({
        companyId: "bar",
        score: 5,
        comment: "hello",
      });
    };

    const bucketInstance = createBucketInstance(callback);
    await bucketInstance.initFeedbackPrompting("foo");

    await nockWait(n1);
    await nockWait(n2);
    await nockWait(n3);
    await flushPromises();

    expect(markPromptMessageCompleted).toHaveBeenCalledOnce();
    expect(markPromptMessageCompleted).toHaveBeenCalledWith(
      "foo",
      "123",
      new Date(goodMessage.showBefore),
    );
  });

  test("blocks invalid messages", async () => {
    const callback = vi.fn();

    const bucketInstance = createBucketInstance(callback);

    await expect(
      bucketInstance.initFeedbackPrompting("foo"),
    ).rejects.toThrowError();

    expect(callback).not.toBeCalled;
  });
});
