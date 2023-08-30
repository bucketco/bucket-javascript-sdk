import nock from "nock";
import ReconnectingEventSource from "reconnecting-eventsource";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  vitest,
} from "vitest";

import {
  ABLY_REALTIME_HOST,
  ABLY_REST_HOST,
  TRACKING_HOST,
} from "../src/config";
import { AblySSEChannel, closeSSEChannel, openSSEChannel } from "../src/sse";
import flushPromises from "flush-promises";

const trackingKey = "123";
const tokenRequest = {
  keyName: "key-name",
  other: "other",
};
const tokenDetails = {
  token: "token",
};

const userId = "foo";
const channel = "channel";

vitest.mock("reconnecting-eventsource", () => {
  return {
    default: vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
    }),
  };
});

function setupAuthNock(
  success: boolean | number,
  host: string = TRACKING_HOST,
) {
  const n = nock(`${host}/${trackingKey}`).get(
    /.*\/feedback\/prompting-auth&userId=foo/,
  );

  if (success === true) {
    return n.reply(200, { success: true, ...tokenRequest });
  } else if (success === false) {
    return n.reply(200, { success: false });
  } else {
    return n.reply(success);
  }
}

function setupTokenNock(success: boolean, host: string = ABLY_REST_HOST) {
  const n = nock(`${host}/keys/${tokenRequest.keyName}`).post(
    /.*\/requestToken/,
    {
      ...tokenRequest,
    },
  );

  if (success) {
    return n.reply(200, tokenDetails);
  } else {
    return n.reply(401);
  }
}

describe("initialization", () => {
  afterEach(() => {
    expect(nock.isDone()).toBe(true);

    vi.clearAllMocks();
    nock.cleanAll();
  });

  test("uses custom hosts", async () => {
    const sse = new AblySSEChannel(userId, channel, trackingKey, vi.fn(), {
      trackingHost: "https://tracking.example.com",
      ablyRestHost: "https://rest.example.com",
      ablyRealtimeHost: "https://realtime.example.com",
    });

    setupAuthNock(true, "https://tracking.example.com");
    setupTokenNock(true, "https://rest.example.com");

    await sse.connect();
    expect(vi.mocked(ReconnectingEventSource)).toHaveBeenCalledWith(
      `https://realtime.example.com/sse?v=1.2&accessToken=${tokenDetails.token}&channels=${channel}&rewind=1`,
    );
  });

  test("uses default hosts", async () => {
    const sse = new AblySSEChannel(userId, channel, trackingKey, vi.fn());

    setupAuthNock(true);
    setupTokenNock(true);

    await sse.connect();

    expect(vi.mocked(ReconnectingEventSource)).toHaveBeenCalledWith(
      `${ABLY_REALTIME_HOST}/sse?v=1.2&accessToken=${tokenDetails.token}&channels=${channel}&rewind=1`,
    );
  });
});

describe("connection handling", () => {
  afterEach(() => {
    expect(nock.isDone()).toBe(true);

    vi.clearAllMocks();
    nock.cleanAll();
  });

  test("rejects if auth endpoint is not success", async () => {
    const sse = new AblySSEChannel(userId, channel, trackingKey, vi.fn());

    setupAuthNock(false);

    await expect(sse.connect()).rejects.toThrowError();

    expect(vi.mocked(ReconnectingEventSource)).not.toHaveBeenCalled();
  });

  test("rejects if auth endpoint is not 200", async () => {
    const sse = new AblySSEChannel(userId, channel, trackingKey, vi.fn());

    setupAuthNock(403);

    await expect(sse.connect()).rejects.toThrowError();

    expect(vi.mocked(ReconnectingEventSource)).not.toHaveBeenCalled();
  });

  test("rejects if token endpoint rejects", async () => {
    const sse = new AblySSEChannel(userId, channel, trackingKey, vi.fn());

    setupAuthNock(true);
    setupTokenNock(false);

    await expect(sse.connect()).rejects.toThrowError();

    expect(vi.mocked(ReconnectingEventSource)).not.toHaveBeenCalled();
  });

  test("obtains token, connects and subscribes, then closes", async () => {
    const sse = new AblySSEChannel(userId, channel, trackingKey, vi.fn());

    const addEventListener = vi.fn();
    const close = vi.fn();

    vi.mocked(ReconnectingEventSource).mockReturnValue({
      addEventListener,
      close,
    } as any);

    setupAuthNock(true);
    setupTokenNock(true);

    await sse.connect();

    expect(vi.mocked(ReconnectingEventSource)).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledTimes(2);
    expect(addEventListener).toHaveBeenCalledWith(
      "error",
      expect.any(Function),
    );
    expect(addEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );

    expect(sse.isConnected()).toBe(true);

    sse.disconnect();

    expect(close).toHaveBeenCalledTimes(1);
    expect(sse.isConnected()).toBe(false);
  });

  test("disconnects and re-requests token on re-connect", async () => {
    const sse = new AblySSEChannel(userId, channel, trackingKey, vi.fn());

    const close = vi.fn();
    vi.mocked(ReconnectingEventSource).mockReturnValue({
      addEventListener: vi.fn(),
      close,
    } as any);

    setupAuthNock(true);
    setupTokenNock(true);

    await sse.connect();

    setupTokenNock(true);

    await sse.connect();

    expect(close).toHaveBeenCalledTimes(1);
    expect(vi.mocked(ReconnectingEventSource)).toHaveBeenCalledTimes(2);
  });

  test("disconnects only if connected", async () => {
    const sse = new AblySSEChannel(userId, channel, trackingKey, vi.fn());

    const close = vi.fn();
    vi.mocked(ReconnectingEventSource).mockReturnValue({
      close,
    } as any);

    sse.disconnect();

    expect(close).not.toHaveBeenCalled();
  });
});

describe("message handling", () => {
  beforeEach(() => {
    setupAuthNock(true);
    setupTokenNock(true);
  });

  afterEach(() => {
    expect(nock.isDone()).toBe(true);

    vi.clearAllMocks();
    nock.cleanAll();
  });

  test("passes message to callback", async () => {
    const callback = vi.fn();
    const sse = new AblySSEChannel(userId, channel, trackingKey, callback);

    let messageCallback: ((e: Event) => void) | undefined = undefined;
    const addEventListener = (event: string, cb: (e: Event) => void) => {
      if (event === "message") {
        messageCallback = cb;
      }
    };

    vi.mocked(ReconnectingEventSource).mockReturnValue({
      addEventListener,
    } as any);

    await sse.connect();

    expect(messageCallback).toBeDefined();

    messageCallback!({
      data: JSON.stringify({ data: "foo" }),
    } as any);
    expect(callback).toHaveBeenCalledWith("foo");

    messageCallback!({
      data: null,
    } as any);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("does not respond to unknown errors", async () => {
    const sse = new AblySSEChannel(userId, channel, trackingKey, vi.fn());

    let errorCallback: ((e: Event) => Promise<void>) | undefined = undefined;
    const addEventListener = (event: string, cb: (e: Event) => void) => {
      if (event === "error") {
        errorCallback = cb as typeof errorCallback;
      }
    };

    const close = vi.fn();
    vi.mocked(ReconnectingEventSource).mockReturnValue({
      addEventListener,
      close,
    } as any);

    await sse.connect();

    expect(errorCallback).toBeDefined();

    await expect(errorCallback!({} as any)).rejects.toThrowError();
    expect(close).not.toHaveBeenCalled();

    await errorCallback!(
      new MessageEvent("error", {
        data: JSON.stringify({ code: 400 }),
      }),
    );

    expect(close).not.toHaveBeenCalled();
  });

  test("resets the connection and refreshes token for ably expiry errors", async () => {
    const sse = new AblySSEChannel(userId, channel, trackingKey, vi.fn());

    let errorCallback: ((e: Event) => Promise<void>) | undefined = undefined;
    const addEventListener = (event: string, cb: (e: Event) => void) => {
      if (event === "error") {
        errorCallback = cb as typeof errorCallback;
      }
    };

    const close = vi.fn();
    vi.mocked(ReconnectingEventSource).mockReturnValue({
      addEventListener,
      close,
    } as any);

    await sse.connect();

    setupTokenNock(true);

    await errorCallback!(
      new MessageEvent("error", {
        data: JSON.stringify({ code: 40140 }),
      }),
    );

    expect(close).toHaveBeenCalled();
    expect(vi.mocked(ReconnectingEventSource)).toHaveBeenCalledTimes(2);
  });
});

describe("open and close SSE channel", () => {
  const nockWait = (n: nock.Scope) => {
    return new Promise((resolve) => {
      n.on("replied", () => {
        resolve(undefined);
      });
    });
  };

  afterEach(() => {
    expect(nock.isDone()).toBe(true);

    vi.clearAllMocks();
    nock.cleanAll();
  });

  test("opens and connects to a channel", async () => {
    const n1 = setupAuthNock(true);
    const n2 = setupTokenNock(true);

    const ch = openSSEChannel(trackingKey, userId, channel, vi.fn());

    await nockWait(n1);
    await nockWait(n2);

    await flushPromises();
    expect(ch.sse.isConnected()).toBe(true);
  });

  test("opens and connects later to a failed channel", async () => {
    const n1 = setupAuthNock(false);

    vi.useFakeTimers();
    const ch = openSSEChannel(trackingKey, userId, channel, vi.fn(), {
      retryInterval: 100,
    });

    await nockWait(n1);

    const n2 = setupAuthNock(true);
    const n3 = setupTokenNock(true);

    expect(ch.sse.isConnected()).toBe(false);

    vi.advanceTimersByTime(100);

    await nockWait(n2);
    await nockWait(n3);

    vi.useRealTimers();

    await flushPromises();
    expect(ch.sse.isConnected()).toBe(true);
  });

  test("opens and does not connect later to a failed channel if no retries", async () => {
    const n1 = setupAuthNock(false);

    vi.useFakeTimers();
    const ch = openSSEChannel(trackingKey, userId, channel, vi.fn(), {
      retryCount: 0,
      retryInterval: 100,
    });

    await nockWait(n1);

    vi.advanceTimersByTime(100);
    vi.useRealTimers();

    await flushPromises();

    expect(ch.interval).toBe(undefined);
  });

  test("closes an open channel", async () => {
    const n1 = setupAuthNock(true);
    const n2 = setupTokenNock(true);

    const close = vi.fn();
    vi.mocked(ReconnectingEventSource).mockReturnValue({
      addEventListener: vi.fn(),
      close,
    } as any);

    const ch = openSSEChannel(trackingKey, userId, channel, vi.fn());

    await nockWait(n1);
    await nockWait(n2);
    await flushPromises();

    closeSSEChannel(ch);

    await flushPromises();

    expect(ch.sse.isConnected()).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
    expect(ch.interval).toBe(undefined);
  });
});
