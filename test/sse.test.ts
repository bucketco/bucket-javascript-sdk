import flushPromises from "flush-promises";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ABLY_REST_HOST } from "../src/config";
import {
  AblySSEChannel,
  closeAblySSEChannel,
  openAblySSEChannel,
} from "../src/sse";

const ablyAuthUrl = "https://example.com/123/feedback/prompting-auth";
const tokenRequest = {
  keyName: "key-name",
  other: "other",
};
const tokenDetails = {
  token: "token",
};

const userId = "foo";
const channel = "channel";

Object.defineProperty(window, "EventSource", {
  value: vi.fn(),
});

function setupAuthNock(success: boolean | number) {
  const n = nock(`${ablyAuthUrl}`).get(/.*?userId=foo/);

  if (success === true) {
    return n.reply(200, { success: true, ...tokenRequest });
  } else if (success === false) {
    return n.reply(200, { success: false });
  } else {
    return n.reply(success);
  }
}

function setupTokenNock(success: boolean) {
  const n = nock(`${ABLY_REST_HOST}/keys/${tokenRequest.keyName}`).post(
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

describe("connection handling", () => {
  afterEach(() => {
    expect(nock.isDone()).toBe(true);

    vi.clearAllMocks();
    nock.cleanAll();
  });

  test("rejects if auth endpoint is not success", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    setupAuthNock(false);

    await expect(sse.connect()).rejects.toThrowError();

    expect(vi.mocked(window.EventSource)).not.toHaveBeenCalled();
  });

  test("rejects if auth endpoint is not 200", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    setupAuthNock(403);

    await expect(sse.connect()).rejects.toThrowError();

    expect(vi.mocked(window.EventSource)).not.toHaveBeenCalled();
  });

  test("rejects if token endpoint rejects", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    setupAuthNock(true);
    setupTokenNock(false);

    await expect(sse.connect()).rejects.toThrowError();

    expect(vi.mocked(window.EventSource)).not.toHaveBeenCalled();
  });

  test("obtains token, connects and subscribes, then closes", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    const addEventListener = vi.fn();
    const close = vi.fn();

    vi.mocked(window.EventSource).mockReturnValue({
      addEventListener,
      close,
    } as any);

    setupAuthNock(true);
    setupTokenNock(true);

    await sse.connect();

    expect(vi.mocked(window.EventSource)).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledTimes(3);
    expect(addEventListener).toHaveBeenCalledWith(
      "error",
      expect.any(Function),
    );
    expect(addEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
    expect(addEventListener).toHaveBeenCalledWith("open", expect.any(Function));

    expect(sse.isConnected()).toBe(true);

    sse.disconnect();

    expect(close).toHaveBeenCalledTimes(1);
    expect(sse.isConnected()).toBe(false);
  });

  test("does not try to re-connect if already connecting", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    const close = vi.fn();
    vi.mocked(window.EventSource).mockReturnValue({
      addEventListener: vi.fn(),
      close,
    } as any);

    setupAuthNock(true);
    setupTokenNock(true);

    const c1 = sse.connect();
    const c2 = sse.connect();

    await c1;
    await c2;

    expect(close).toHaveBeenCalledTimes(0);
    expect(vi.mocked(window.EventSource)).toHaveBeenCalledTimes(1);
  });

  test("does not re-connect if already connected", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    const close = vi.fn();
    vi.mocked(window.EventSource).mockReturnValue({
      addEventListener: vi.fn(),
      close,
    } as any);

    setupAuthNock(true);
    setupTokenNock(true);

    await sse.connect();
    await sse.connect();

    expect(close).toHaveBeenCalledTimes(0);
    expect(vi.mocked(window.EventSource)).toHaveBeenCalledTimes(1);
  });

  test("disconnects only if connected", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    const close = vi.fn();
    vi.mocked(window.EventSource).mockReturnValue({
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
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, callback);

    let messageCallback: ((e: Event) => void) | undefined = undefined;
    const addEventListener = (event: string, cb: (e: Event) => void) => {
      if (event === "message") {
        messageCallback = cb;
      }
    };

    vi.mocked(window.EventSource).mockReturnValue({
      addEventListener,
    } as any);

    await sse.connect();

    expect(messageCallback).toBeDefined();

    messageCallback!({
      data: JSON.stringify({ data: JSON.stringify("foo") }),
    } as any);
    expect(callback).toHaveBeenCalledWith("foo");

    messageCallback!({
      data: null,
    } as any);

    messageCallback!({
      data: JSON.stringify({}),
    } as any);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("disconnects on unknown event source errors without data", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    let errorCallback: ((e: Event) => Promise<void>) | undefined = undefined;
    const addEventListener = (event: string, cb: (e: Event) => void) => {
      if (event === "error") {
        errorCallback = cb as typeof errorCallback;
      }
    };

    const close = vi.fn();
    vi.mocked(window.EventSource).mockReturnValue({
      addEventListener,
      close,
    } as any);

    await sse.connect();

    expect(errorCallback).toBeDefined();

    await errorCallback!({} as any);
    expect(close).toHaveBeenCalledTimes(1);
  });

  test("disconnects on unknown event source errors with data", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    let errorCallback: ((e: Event) => Promise<void>) | undefined = undefined;
    const addEventListener = (event: string, cb: (e: Event) => void) => {
      if (event === "error") {
        errorCallback = cb as typeof errorCallback;
      }
    };

    const close = vi.fn();
    vi.mocked(window.EventSource).mockReturnValue({
      addEventListener,
      close,
    } as any);

    await sse.connect();

    expect(errorCallback).toBeDefined();

    await errorCallback!(
      new MessageEvent("error", {
        data: JSON.stringify({ code: 400 }),
      }),
    );

    expect(close).toHaveBeenCalledTimes(1);
  });

  test("disconnects when ably reports token is expired", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    let errorCallback: ((e: Event) => Promise<void>) | undefined = undefined;
    const addEventListener = (event: string, cb: (e: Event) => void) => {
      if (event === "error") {
        errorCallback = cb as typeof errorCallback;
      }
    };

    const close = vi.fn();
    vi.mocked(window.EventSource).mockReturnValue({
      addEventListener,
      close,
    } as any);

    await sse.connect();

    await errorCallback!(
      new MessageEvent("error", {
        data: JSON.stringify({ code: 40140 }),
      }),
    );

    expect(close).toHaveBeenCalled();
  });
});

describe("automatic retries", () => {
  const nockWait = (n: nock.Scope) => {
    return new Promise((resolve) => {
      n.on("replied", () => {
        resolve(undefined);
      });
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    nock.cleanAll();
  });

  afterEach(() => {
    expect(nock.isDone()).toBe(true);
  });

  test("opens and connects to a channel", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    const n1 = setupAuthNock(true);
    const n2 = setupTokenNock(true);

    sse.open();

    await nockWait(n1);
    await nockWait(n2);

    await flushPromises();

    expect(sse.isConnected()).toBe(true);
  });

  test("opens and connects later to a failed channel", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    const n1 = setupAuthNock(false);

    vi.useFakeTimers();
    sse.open({ retryInterval: 100 });

    await nockWait(n1);

    const n2 = setupAuthNock(true);
    const n3 = setupTokenNock(true);
    await flushPromises();

    expect(sse.isConnected()).toBe(false);

    vi.advanceTimersByTime(100);

    await nockWait(n2);
    await nockWait(n3);

    vi.useRealTimers();

    await flushPromises();
    expect(sse.isConnected()).toBe(true);
    expect(sse.isActive()).toBe(true);
  });

  test("only, ever, allow one connection to SSE", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    const n1 = setupAuthNock(true);
    const n2 = setupTokenNock(true);

    vi.useFakeTimers();
    sse.open({ retryInterval: 1, retryCount: 100 });

    for (let i = 0; i < 10; i++) {
      await flushPromises();
      vi.advanceTimersByTime(1);
    }

    await nockWait(n1);
    await nockWait(n2);

    await flushPromises();

    expect(sse.isConnected()).toBe(true);
    expect(sse.isActive()).toBe(true);

    expect(vi.mocked(window.EventSource)).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  test("resets retry count on successfull connect", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    // mock event source
    let errorCallback: ((e: Event) => Promise<void>) | undefined = undefined;
    const addEventListener = (event: string, cb: (e: Event) => void) => {
      if (event === "error") {
        errorCallback = cb as typeof errorCallback;
      }
    };

    const close = vi.fn();
    vi.mocked(window.EventSource).mockReturnValue({
      addEventListener,
      close,
    } as any);

    // make initial failed attempt
    vi.useFakeTimers();
    const n = setupAuthNock(false);

    sse.open({ retryInterval: 100, retryCount: 1 });

    await nockWait(n);
    await flushPromises();

    const attempt = async () => {
      const n1 = setupAuthNock(true);
      const n2 = setupTokenNock(true);

      vi.advanceTimersByTime(100);

      await nockWait(n1);
      await nockWait(n2);

      await flushPromises();
      vi.advanceTimersByTime(100);

      expect(sse.isConnected()).toBe(true);

      // simulate an error
      vi.advanceTimersByTime(100);

      await errorCallback!({} as any);
      await flushPromises();

      expect(sse.isConnected()).toBe(false);
    };

    await attempt();
    await attempt();
    await attempt();

    vi.useRealTimers();
  });

  test("reconnects if manually disconnected", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    vi.mocked(window.EventSource).mockReturnValue({
      addEventListener: vi.fn(),
      close: vi.fn(),
    } as any);

    const n1 = setupAuthNock(true);
    const n2 = setupTokenNock(true);

    vi.useFakeTimers();
    sse.open({ retryInterval: 100 });

    await nockWait(n1);
    await nockWait(n2);

    await flushPromises();

    sse.disconnect();

    const n3 = setupAuthNock(true);
    const n4 = setupTokenNock(true);

    vi.advanceTimersByTime(100);

    await nockWait(n3);
    await nockWait(n4);

    vi.useRealTimers();

    await flushPromises();

    expect(sse.isConnected()).toBe(true);
    expect(sse.isActive()).toBe(true);
  });

  test("opens and does not connect later to a failed channel if no retries", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    const n1 = setupAuthNock(false);

    vi.useFakeTimers();
    sse.open({
      retryCount: 0,
      retryInterval: 100,
    });

    await nockWait(n1);
    await flushPromises();

    vi.advanceTimersByTime(100);
    vi.useRealTimers();

    await flushPromises();

    expect(sse.isActive()).toBe(false);
  });

  test("closes an open channel", async () => {
    const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, vi.fn());

    const n1 = setupAuthNock(true);
    const n2 = setupTokenNock(true);

    const close = vi.fn();
    vi.mocked(window.EventSource).mockReturnValue({
      addEventListener: vi.fn(),
      close,
    } as any);

    sse.open();

    await nockWait(n1);
    await nockWait(n2);
    await flushPromises();

    sse.close();

    await flushPromises();

    expect(sse.isConnected()).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
    expect(sse.isActive()).toBe(false);
  });
});

describe("helper open and close functions", () => {
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

  test("opens and closes channel", async () => {
    const n1 = setupAuthNock(true);
    const n2 = setupTokenNock(true);

    const sse = openAblySSEChannel(ablyAuthUrl, userId, channel, vi.fn());

    expect(sse.isActive()).toBe(true);

    await nockWait(n1);
    await nockWait(n2);
    await flushPromises();

    closeAblySSEChannel(sse);

    expect(sse.isConnected()).toBe(false);
    expect(sse.isActive()).toBe(false);
  });
});
