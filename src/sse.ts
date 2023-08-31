import fetch from "cross-fetch";
import ReconnectingEventSource from "reconnecting-eventsource";

import { ABLY_REALTIME_HOST, ABLY_REST_HOST } from "./config";

interface AblyTokenDetails {
  token: string;
}

interface AblyTokenRequest {
  keyName: string;
}

export class AblySSEChannel {
  private eventSource: ReconnectingEventSource | null = null;
  private retryInterval: ReturnType<typeof setInterval> | null = null;
  private debug: boolean;

  constructor(
    private userId: string,
    private channel: string,
    private ablyAuthUrl: string,
    private messageHandler: (message: any) => void,
    options?: {
      debug?: boolean;
    },
  ) {
    this.debug = options?.debug ?? false;
  }

  private log(message: string, ...args: any[]) {
    if (this.debug) {
      console.log("[SSE]", message, ...args);
    }
  }

  private warn(message: string, ...args: any[]) {
    console.warn("[SSE]", message, ...args);
  }

  private err(message: string, ...args: any[]): never {
    if (this.debug) {
      console.error("[SSE]", message, ...args);
    }
    throw new Error(message);
  }

  private async refreshTokenRequest() {
    const res = await fetch(
      `${this.ablyAuthUrl}?userId=${encodeURIComponent(this.userId)}`,
      {
        method: "get",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (res.ok) {
      const body = await res.json();
      if (body.success) {
        delete body.success;
        const tokenRequest: AblyTokenRequest = body;

        this.log("obtained new token request", tokenRequest);
        return tokenRequest;
      }
    }

    this.err("server did not release a token request", res);
  }

  private async refreshToken() {
    const tokenRequest = await this.refreshTokenRequest();

    const res = await fetch(
      `${ABLY_REST_HOST}/keys/${encodeURIComponent(
        tokenRequest.keyName,
      )}/requestToken`,
      {
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tokenRequest),
      },
    );

    if (res.ok) {
      const token: AblyTokenDetails = await res.json();
      this.log("obtained new token", token);
      return token;
    }

    this.err("server did not release a token", res);
  }

  private async onError(e: Event) {
    if (e instanceof MessageEvent) {
      const errorPayload = JSON.parse(e.data);
      const errorCode = Number(errorPayload?.code);

      if (errorCode >= 40140 && errorCode < 40150) {
        this.log("token expired, refreshing");
        await this.connect().catch((x) =>
          this.warn("failed to refresh token", x),
        );
      }
      return;
    }

    if ((e as any)?.target?.readyState === 2) {
      this.log("event source connection closed");
    } else {
      this.warn("unexpected error occured", e);
    }
  }

  private onMessage(e: MessageEvent) {
    if (e.data) {
      const message = JSON.parse(e.data);
      if (message.data) {
        const payload = JSON.parse(message.data);

        this.log("received message", payload);
        this.messageHandler(payload);

        return;
      }
    }

    this.warn("received invalid message", e);
  }

  private onOpen(e: Event) {
    this.log("event source connection opened", e);
  }

  public async connect() {
    this.disconnect();
    const token = await this.refreshToken();

    this.eventSource = new ReconnectingEventSource(
      `${ABLY_REALTIME_HOST}/sse?v=1.2&accessToken=${encodeURIComponent(
        token.token,
      )}&channels=${encodeURIComponent(this.channel)}&rewind=1`,
    );

    this.eventSource.addEventListener("error", (e) => this.onError(e));
    this.eventSource.addEventListener("open", (e) => this.onOpen(e));
    this.eventSource.addEventListener("message", (m) => this.onMessage(m));

    this.log("channel connection opened");
  }

  public disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;

      this.log("channel connection closed");
    }
  }

  public open(options?: { retryInterval?: number; retryCount?: number }) {
    const retryInterval = options?.retryInterval ?? 1000 * 30;
    let retryCount = options?.retryCount ?? 3;

    const tryConnect = async () => {
      await this.connect().catch((e) =>
        this.warn(`failed to connect. ${retryCount} retries remaining`, e),
      );
    };

    void tryConnect();

    this.retryInterval = setInterval(() => {
      if (!this.eventSource && this.retryInterval) {
        if (retryCount <= 0) {
          clearInterval(this.retryInterval);
          this.retryInterval = null;
          return;
        }

        retryCount--;
        void tryConnect();
      }
    }, retryInterval);
  }

  public close() {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
      this.disconnect();
    }
  }

  public isOpen() {
    return this.retryInterval !== null;
  }

  public isConnected() {
    return this.eventSource !== null;
  }
}

export function openAblySSEChannel(
  ablyAuthUrl: string,
  userId: string,
  channel: string,
  callback: (req: object) => void,
  options?: { debug?: boolean; retryInterval?: number; retryCount?: number },
) {
  const sse = new AblySSEChannel(userId, channel, ablyAuthUrl, callback, {
    debug: options?.debug,
  });

  sse.open();

  return sse;
}

export function closeAblySSEChannel(channel: AblySSEChannel) {
  channel.close();
}
