import { http, HttpResponse } from "msw";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import { BucketClient } from "../src";
import { API_HOST } from "../src/config";
import { FeedbackPromptHandler } from "../src/feedback/feedback";
import {
  checkPromptMessageCompleted,
  getAuthToken,
  markPromptMessageCompleted,
} from "../src/feedback/prompt-storage";
import {
  AblySSEChannel,
  closeAblySSEChannel,
  openAblySSEChannel,
} from "../src/sse";

import { flagsResult } from "./mocks/handlers";
import { server } from "./mocks/server";

const KEY = "123";

vi.mock("../src/sse");
vi.mock("../src/feedback/prompt-storage", () => {
  return {
    markPromptMessageCompleted: vi.fn(),
    checkPromptMessageCompleted: vi.fn(),
    rememberAuthToken: vi.fn(),
    getAuthToken: vi.fn(),
  };
});

// Treat test environment as desktop
window.innerWidth = 1024;

describe("usage", () => {
  afterEach(() => {
    // nock.cleanAll();
    vi.clearAllMocks();
  });

  test("golden path - register user, company, send event, send feedback, get feature flags", async () => {
    const bucketInstance = new BucketClient(KEY, { user: { id: "foo " } });
    await bucketInstance.initialize();

    await bucketInstance.user({ name: "john doe" });
    await bucketInstance.company({ name: "bar corp" });

    await bucketInstance.track("baz", { baz: true });

    await bucketInstance.feedback({
      featureId: "featureId1",
      score: 5,
      comment: "Sunt bine!",
      question: "Cum esti?",
      promptedQuestion: "How are you?",
    });

    const flags = bucketInstance.getFlags();
    expect(flags).toEqual(flagsResult);
  });
});

// TODO:
// Since we now have LiveSatisfaction as it's own class, we should rewrite these tests
// to test that class instead of the BucketClient class.
// Same for feedback state management below

describe("feedback prompting", () => {
  const events = [];
  const closeChannel = vi.fn();
  beforeAll(() => {
    vi.mocked(openAblySSEChannel).mockReturnValue({
      close: closeChannel,
    } as unknown as AblySSEChannel);
    vi.mocked(closeAblySSEChannel).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthToken).mockReturnValue(undefined);
  });

  test("initiates and stops feedback prompting", async () => {
    const bucketInstance = new BucketClient(KEY, { user: { id: "foo" } });
    await bucketInstance.initialize();

    expect(openAblySSEChannel).toBeCalledTimes(1);

    // call twice, expect only one reset to go through
    bucketInstance.stop();
    bucketInstance.stop();

    expect(closeChannel).toBeCalledTimes(1);
  });

  test("does not call tracking endpoints if token cached", async () => {
    const specialChannel = "special-channel";
    vi.mocked(getAuthToken).mockReturnValue({
      channel: specialChannel,
      token: "something",
    });

    server.use(
      http.post(`${API_HOST}/feedback/prompting-init`, () => {
        throw new Error("should not be called");
      }),
    );

    const bucketInstance = new BucketClient(KEY, { user: { id: "foo" } });
    await bucketInstance.initialize();

    expect(openAblySSEChannel).toBeCalledTimes(1);
    const args = vi.mocked(openAblySSEChannel).mock.calls[0][0];
    expect(args.channel).toBe(specialChannel);
    expect(args.userId).toBe("foo");
  });

  test("does not initiate feedback prompting if server does not agree", async () => {
    server.use(
      http.post(`${API_HOST}/feedback/prompting-init`, () => {
        return HttpResponse.json({ success: false });
      }),
    );

    const bucketInstance = new BucketClient(KEY, { user: { id: "foo" } });
    await bucketInstance.initialize();

    expect(openAblySSEChannel).toBeCalledTimes(0);
  });

  test("skip feedback prompting if no user id configured", async () => {
    const bucketInstance = new BucketClient(KEY);
    await bucketInstance.initialize();

    expect(openAblySSEChannel).toBeCalledTimes(0);
  });

  test("skip feedback prompting if live satisfaction is disabled", async () => {
    const bucketInstance = new BucketClient(
      KEY,
      { user: { id: "foo" } },
      {
        feedback: { enableLiveSatisfaction: false },
      },
    );
    await bucketInstance.initialize();

    expect(openAblySSEChannel).toBeCalledTimes(0);
  });
});

describe("feedback state management", () => {
  const message = {
    question: "How are you?",
    showAfter: new Date(Date.now() - 1000).valueOf(),
    showBefore: new Date(Date.now() + 1000).valueOf(),
    promptId: "123",
    featureId: "456",
  };

  let events: string[] = [];
  beforeEach(() => {
    vi.mocked(openAblySSEChannel).mockImplementation(({ callback }) => {
      callback(message);
      return {} as AblySSEChannel;
    });
    events = [];
    server.use(
      http.post(`${API_HOST}/feedback/prompt-events`, async ({ request }) => {
        const body = await request.json();
        if (body) events.push(String(body["action"]));
        return HttpResponse.json({ success: true });
      }),
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const createBucketInstance = async (callback: FeedbackPromptHandler) => {
    const bucketInstance = new BucketClient(
      KEY,
      { user: { id: "foo" } },
      {
        feedback: {
          liveSatisfactionHandler: callback,
        },
      },
    );
    await bucketInstance.initialize();
    return bucketInstance;
  };

  test("ignores prompt if expired", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(message.showAfter - 1000);

    const callback = vi.fn();

    await createBucketInstance(callback);

    expect(callback).not.toBeCalled;

    expect(markPromptMessageCompleted).not.toHaveBeenCalledOnce();

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("ignores prompt if already seen", async () => {
    vi.mocked(checkPromptMessageCompleted).mockReturnValue(true);

    const callback = vi.fn();

    await createBucketInstance(callback);

    expect(callback).not.toBeCalled;

    expect(checkPromptMessageCompleted).toHaveBeenCalledOnce();
    expect(checkPromptMessageCompleted).toHaveBeenCalledWith("foo", "123");
  });

  test("propagates prompt to the callback", async () => {
    const callback = vi.fn();

    await createBucketInstance(callback);
    await vi.waitUntil(() => callback.mock.calls.length > 0);

    await vi.waitUntil(() => events.length > 1);

    expect(events).toEqual(["received", "shown"]);

    expect(callback).toBeCalledTimes(1);
    expect(callback).toBeCalledWith(
      {
        question: "How are you?",
        showAfter: new Date(message.showAfter),
        showBefore: new Date(message.showBefore),
        promptId: "123",
        featureId: "456",
      },
      expect.anything(),
    );

    expect(markPromptMessageCompleted).not.toHaveBeenCalled();
  });

  test("propagates timed prompt to the callback", async () => {
    const callback = vi.fn();

    vi.useFakeTimers();
    vi.setSystemTime(message.showAfter - 500);

    await createBucketInstance(callback);

    expect(callback).not.toBeCalled();

    vi.runAllTimers();
    await vi.waitUntil(() => callback.mock.calls.length > 0);

    await vi.waitUntil(() => events.length > 1);

    expect(events).toEqual(["received", "shown"]);

    expect(callback).toBeCalledTimes(1);

    expect(markPromptMessageCompleted).not.toHaveBeenCalled();

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("propagates prompt to the callback and reacts to dismissal", async () => {
    const callback: FeedbackPromptHandler = async (_, handlers) => {
      await handlers.reply(null);
    };

    await createBucketInstance(callback);

    await vi.waitUntil(() => events.length > 2);

    expect(events).toEqual(["received", "shown", "dismissed"]);

    expect(markPromptMessageCompleted).toHaveBeenCalledOnce();
    expect(markPromptMessageCompleted).toHaveBeenCalledWith(
      "foo",
      "123",
      new Date(message.showBefore),
    );
  });

  test("propagates prompt to the callback and reacts to feedback", async () => {
    const callback: FeedbackPromptHandler = async (_, handlers) => {
      await handlers.reply({
        companyId: "bar",
        score: 5,
        comment: "hello",
        question: "Cum esti?",
      });
    };

    await createBucketInstance(callback);

    await vi.waitUntil(() => events.length > 1);

    expect(events).toEqual(["received", "shown"]);
    expect(markPromptMessageCompleted).toHaveBeenCalledOnce();
    expect(markPromptMessageCompleted).toHaveBeenCalledWith(
      "foo",
      "123",
      new Date(message.showBefore),
    );
  });
});
