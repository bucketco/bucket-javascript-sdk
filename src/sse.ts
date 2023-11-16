import fetch from "cross-fetch";

import { SSE_REALTIME_HOST } from "./config";

interface AblyTokenDetails {
  token: string;
}

interface AblyTokenRequest {
  keyName: string;
}

const ABLY_TOKEN_ERROR_MIN = 40140;
const ABLY_TOKEN_ERROR_MAX = 40149;

export class AblySSEChannel {
  private isOpen: boolean = false;
  private eventSource: EventSource | null = null;
  private retryInterval: ReturnType<typeof setInterval> | null = null;
  private debug: boolean;

  constructor(
    private userId: string,
    private channel: string,
    private ablyAuthUrl: string,
    private sseHost: string,
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
      `${this.sseHost}/keys/${encodeURIComponent(
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
      let errorCode: number | undefined;

      try {
        const errorPayload = JSON.parse(e.data);
        errorCode = errorPayload?.code && Number(errorPayload.code);
      } catch (error: any) {
        this.warn("received unparseable error message", error, e);
      }

      if (
        errorCode &&
        errorCode >= ABLY_TOKEN_ERROR_MIN &&
        errorCode <= ABLY_TOKEN_ERROR_MAX
      ) {
        this.log("event source token expired, refresh required");
      }
    } else {
      const connectionState = (e as any)?.target?.readyState;

      if (connectionState === 2) {
        this.log("event source connection closed", e);
      } else if (connectionState === 1) {
        this.warn("event source connection failed to open", e);
      } else {
        this.warn("event source unexpected error occured", e);
      }
    }

    this.disconnect();
  }

  private onMessage(e: MessageEvent) {
    let payload: any;

    try {
      if (e.data) {
        const message = JSON.parse(e.data);
        if (message.data) {
          payload = JSON.parse(message.data);
        }
      }
    } catch (error: any) {
      this.warn("received unparseable message", error, e);
      return;
    }

    if (payload) {
      this.log("received message", payload);

      try {
        this.messageHandler(payload);
      } catch (error: any) {
        this.warn("failed to handle message", error, payload);
      }

      return;
    }

    this.warn("received invalid message", e);
  }

  private onOpen(e: Event) {
    this.log("event source connection opened", e);
  }

  public async connect() {
    if (this.isOpen) {
      this.warn("channel connection already open");
      return;
    }

    this.isOpen = true;
    try {
      const token = await this.refreshToken();

      this.eventSource = new EventSource(
        `${this.sseHost}/sse?v=1.2&accessToken=${encodeURIComponent(
          token.token,
        )}&channels=${encodeURIComponent(this.channel)}&rewind=1`,
      );

      this.eventSource.addEventListener("error", (e) => this.onError(e));
      this.eventSource.addEventListener("open", (e) => this.onOpen(e));
      this.eventSource.addEventListener("message", (m) => this.onMessage(m));

      this.log("channel connection opened");
    } finally {
      this.isOpen = !!this.eventSource;
    }
  }

  public disconnect() {
    if (!this.isOpen) {
      this.warn("channel connection already closed");
      return;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;

      this.log("channel connection closed");
    }

    this.isOpen = false;
  }

  public open(options?: { retryInterval?: number; retryCount?: number }) {
    const retryInterval = options?.retryInterval ?? 1000 * 30;
    const retryCount = options?.retryCount ?? 3;
    let retriesRemaining = retryCount;

    const tryConnect = async () => {
      try {
        await this.connect();
        retriesRemaining = retryCount;
      } catch (e) {
        if (retriesRemaining > 0) {
          this.warn(
            `failed to connect, ${retriesRemaining} retries remaining`,
            e,
          );
        } else {
          this.warn(`failed to connect, no retries remaining`, e);
        }
      }
    };

    void tryConnect();

    this.retryInterval = setInterval(() => {
      if (!this.isOpen && this.retryInterval) {
        if (retriesRemaining <= 0) {
          clearInterval(this.retryInterval);
          this.retryInterval = null;
          return;
        }

        retriesRemaining--;
        void tryConnect();
      }
    }, retryInterval);
  }

  public close() {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }

    this.disconnect();
  }

  public isActive() {
    return !!this.retryInterval;
  }

  public isConnected() {
    return this.isOpen;
  }
}

export function openAblySSEChannel(
  ablyAuthUrl: string,
  userId: string,
  channel: string,
  callback: (req: object) => void,
  options?: {
    debug?: boolean;
    retryInterval?: number;
    retryCount?: number;
    sseHost?: string;
  },
) {
  const sse = new AblySSEChannel(
    userId,
    channel,
    ablyAuthUrl,
    options?.sseHost || SSE_REALTIME_HOST,
    callback,
    { debug: options?.debug },
  );

  sse.open();

  return sse;
}

export function closeAblySSEChannel(channel: AblySSEChannel) {
  channel.close();
}
