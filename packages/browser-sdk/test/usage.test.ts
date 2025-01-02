import { http, HttpResponse } from "msw";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  test,
  vi,
} from "vitest";

import { BucketClient } from "../src";
import { API_BASE_URL } from "../src/config";
import { FeaturesClient } from "../src/feature/features";
import { FeedbackPromptHandler } from "../src/feedback/feedback";
import {
  checkPromptMessageCompleted,
  getAuthToken,
  markPromptMessageCompleted,
} from "../src/feedback/promptStorage";
import { HttpClient } from "../src/httpClient";
import {
  AblySSEChannel,
  closeAblySSEChannel,
  openAblySSEChannel,
} from "../src/sse";

import { featuresResult } from "./mocks/handlers";
import { server } from "./mocks/server";

const KEY = "123";

vi.mock("../src/sse");
vi.mock("../src/feedback/promptStorage", () => {
  return {
    markPromptMessageCompleted: vi.fn(),
    checkPromptMessageCompleted: vi.fn(),
    rememberAuthToken: vi.fn(),
    getAuthToken: vi.fn(),
  };
});

// Treat test environment as desktop
window.innerWidth = 1024;

afterEach(() => {
  server.resetHandlers();
});

describe("usage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("golden path - register `user`, `company`, send `event`, send `feedback`, get `features`", async () => {
    const bucketInstance = new BucketClient({
      publishableKey: KEY,
      user: { id: "foo " },
      company: { id: "bar", name: "bar corp" },
    });
    await bucketInstance.initialize();

    await bucketInstance.track("baz", { baz: true });

    await bucketInstance.feedback({
      featureId: "featureId1",
      score: 5,
      comment: "Sunt bine!",
      question: "Cum esti?",
      promptedQuestion: "How are you?",
    });

    const features = bucketInstance.getFeatures();
    expect(features).toEqual(featuresResult);

    const featureId1 = bucketInstance.getFeature("featureId1");
    expect(featureId1).toEqual({
      isEnabled: false,
      track: expect.any(Function),
      requestFeedback: expect.any(Function),
    });
  });

  test("accepts `featureKey` instead of `featureId` for manual feedback", async () => {
    const bucketInstance = new BucketClient({
      publishableKey: KEY,
      user: { id: "foo" },
      company: { id: "bar" },
    });

    await bucketInstance.initialize();

    await bucketInstance.feedback({
      featureKey: "feature-key",
      score: 5,
      question: "What's up?",
      promptedQuestion: "How are you?",
    });
  });
});

// TODO:
// Since we now have AutoFeedback as it's own class, we should rewrite these tests
// to test that class instead of the BucketClient class.
// Same for feedback state management below

describe("feedback prompting", () => {
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
    const bucketInstance = new BucketClient({
      publishableKey: KEY,
      user: { id: "foo" },
    });
    await bucketInstance.initialize();

    expect(openAblySSEChannel).toBeCalledTimes(1);

    // call twice, expect only one reset to go through
    await bucketInstance.stop();
    await bucketInstance.stop();

    expect(closeChannel).toBeCalledTimes(1);
  });

  test("does not call tracking endpoints if token cached", async () => {
    const specialChannel = "special-channel";
    vi.mocked(getAuthToken).mockReturnValue({
      channel: specialChannel,
      token: "something",
    });

    server.use(
      http.post(`${API_BASE_URL}/feedback/prompting-init`, () => {
        throw new Error("should not be called");
      }),
    );

    const bucketInstance = new BucketClient({
      publishableKey: KEY,
      user: { id: "foo" },
    });
    await bucketInstance.initialize();

    expect(openAblySSEChannel).toBeCalledTimes(1);
    const args = vi.mocked(openAblySSEChannel).mock.calls[0][0];
    expect(args.channel).toBe(specialChannel);
    expect(args.userId).toBe("foo");
  });

  test("does not initiate feedback prompting if server does not agree", async () => {
    server.use(
      http.post(`${API_BASE_URL}/feedback/prompting-init`, () => {
        return HttpResponse.json({ success: false });
      }),
    );

    const bucketInstance = new BucketClient({
      publishableKey: KEY,
      user: { id: "foo" },
    });
    await bucketInstance.initialize();

    expect(openAblySSEChannel).toBeCalledTimes(0);
  });

  test("skip feedback prompting if no user id configured", async () => {
    const bucketInstance = new BucketClient({ publishableKey: KEY });
    await bucketInstance.initialize();

    expect(openAblySSEChannel).toBeCalledTimes(0);
  });

  test("skip feedback prompting if automated feedback surveys are disabled", async () => {
    const bucketInstance = new BucketClient({
      publishableKey: KEY,
      user: { id: "foo" },
      feedback: { enableAutoFeedback: false },
    });
    await bucketInstance.initialize();

    expect(openAblySSEChannel).toBeCalledTimes(0);
  });
});

describe("feedback state management", () => {
  const message = {
    question: "How are you?",
    showAfter: new Date(Date.now() - 10000).valueOf(),
    showBefore: new Date(Date.now() + 10000).valueOf(),
    promptId: "123",
    featureId: "456",
  };

  let events: string[] = [];
  let bucketInstance: BucketClient | null = null;
  beforeEach(() => {
    vi.mocked(openAblySSEChannel).mockImplementation(({ callback }) => {
      callback(message);
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return { close: () => {} } as AblySSEChannel;
    });
    events = [];
    server.use(
      http.post(
        `${API_BASE_URL}/feedback/prompt-events`,
        async ({ request }) => {
          const body = await request.json();
          if (!(body && typeof body === "object" && "action" in body)) {
            throw new Error("invalid request");
          }
          events.push(String(body["action"]));
          return HttpResponse.json({ success: true });
        },
      ),
    );
  });

  afterEach(async () => {
    if (bucketInstance) await bucketInstance.stop();

    vi.resetAllMocks();
  });

  const createBucketInstance = async (callback: FeedbackPromptHandler) => {
    bucketInstance = new BucketClient({
      publishableKey: KEY,
      user: { id: "foo" },
      feedback: {
        autoFeedbackHandler: callback,
      },
    });
    await bucketInstance.initialize();
    return bucketInstance;
  };

  test("ignores prompt if expired", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(message.showAfter - 10000);

    const callback = vi.fn();

    await createBucketInstance(callback);

    expect(callback).not.toBeCalled;

    expect(markPromptMessageCompleted).not.toHaveBeenCalledOnce();

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("ignores prompt if already seen", async () => {
    vi.mocked(checkPromptMessageCompleted).mockReturnValue(true);
    expect(checkPromptMessageCompleted).not.toHaveBeenCalled();

    const callback = vi.fn();

    await createBucketInstance(callback);

    expect(callback).not.toBeCalled;
    await vi.waitFor(() =>
      expect(checkPromptMessageCompleted).toHaveBeenCalledOnce(),
    );

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

describe(`sends "check" events `, () => {
  test("getFeatures() does not send `check` events", async () => {
    vi.spyOn(FeaturesClient.prototype, "sendCheckEvent");

    const client = new BucketClient({
      publishableKey: KEY,
      user: { id: "123" },
    });
    await client.initialize();

    expect(
      vi.mocked(FeaturesClient.prototype.sendCheckEvent),
    ).toHaveBeenCalledTimes(0);

    const featureA = client.getFeatures()?.featureA;

    expect(featureA?.isEnabled).toBe(true);
    expect(
      vi.mocked(FeaturesClient.prototype.sendCheckEvent),
    ).toHaveBeenCalledTimes(0);
  });

  it(`getFeature() sends check event when accessing "isEnabled"`, async () => {
    vi.spyOn(FeaturesClient.prototype, "sendCheckEvent");
    vi.spyOn(HttpClient.prototype, "post");

    const client = new BucketClient({
      publishableKey: KEY,
      user: { id: "uid" },
      company: { id: "cid" },
    });
    await client.initialize();

    const featureA = client.getFeature("featureA");

    expect(
      vi.mocked(FeaturesClient.prototype.sendCheckEvent),
    ).toHaveBeenCalledTimes(0);
    expect(featureA.isEnabled).toBe(true);

    expect(
      vi.mocked(FeaturesClient.prototype.sendCheckEvent),
    ).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(FeaturesClient.prototype.sendCheckEvent),
    ).toHaveBeenCalledWith({
      key: "featureA",
      value: true,
      version: 1,
    });

    expect(vi.mocked(HttpClient.prototype.post)).toHaveBeenCalledWith({
      body: {
        action: "check",
        evalContext: {
          company: {
            id: "cid",
          },
          other: undefined,
          user: {
            id: "uid",
          },
        },
        evalResult: true,
        key: "featureA",
        targetingVersion: 1,
      },
      path: "features/events",
    });
  });

  it("sends check event for not-enabled features", async () => {
    // disabled features don't appear in the API response
    vi.spyOn(FeaturesClient.prototype, "sendCheckEvent");

    const client = new BucketClient({ publishableKey: KEY });
    await client.initialize();

    const nonExistentFeature = client.getFeature("non-existent");

    expect(
      vi.mocked(FeaturesClient.prototype.sendCheckEvent),
    ).toHaveBeenCalledTimes(0);
    expect(nonExistentFeature.isEnabled).toBe(false);

    expect(
      vi.mocked(FeaturesClient.prototype.sendCheckEvent),
    ).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(FeaturesClient.prototype.sendCheckEvent),
    ).toHaveBeenCalledWith({
      value: false,
      key: "non-existent",
      version: undefined,
    });
  });

  describe("getFeature", async () => {
    it("calls client.track with the featureId", async () => {
      const client = new BucketClient({ publishableKey: KEY });
      await client.initialize();

      const featureId1 = client.getFeature("featureId1");
      expect(featureId1).toEqual({
        isEnabled: false,
        track: expect.any(Function),
        requestFeedback: expect.any(Function),
      });

      vi.spyOn(client, "track");

      await featureId1.track();

      expect(client.track).toHaveBeenCalledWith("featureId1");
    });

    it("calls client.requestFeedback with the featureId", async () => {
      const client = new BucketClient({ publishableKey: KEY });
      await client.initialize();

      const featureId1 = client.getFeature("featureId1");
      expect(featureId1).toEqual({
        isEnabled: false,
        track: expect.any(Function),
        requestFeedback: expect.any(Function),
      });

      vi.spyOn(client, "requestFeedback");

      featureId1.requestFeedback({
        title: "Feedback",
      });

      expect(client.requestFeedback).toHaveBeenCalledWith({
        featureKey: "featureId1",
        title: "Feedback",
      });
    });
  });
});
