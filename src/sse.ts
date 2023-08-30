import fetch from "cross-fetch";
import ReconnectingEventSource from "reconnecting-eventsource";

import { ABLY_REALTIME_HOST, ABLY_REST_HOST, TRACKING_HOST } from "./config";

type Options = {
  trackingHost?: string;
  ablyRestHost?: string;
  ablyRealtimeHost?: string;
  debug?: boolean;
};

interface AblyTokenDetails {
  token: string;
}

interface AblyTokenRequest {
  keyName: string;
}

export class AblySSEChannel {
  private eventSource: ReconnectingEventSource | null = null;
  private tokenRequest: AblyTokenRequest | null = null;
  private token: AblyTokenDetails | null = null;
  private trackingHost: string;
  private ablyRestHost: string;
  private ablyRealtimeHost: string;
  private debug: boolean;

  constructor(
    private userId: string,
    private channel: string,
    private trackingKey: string,
    private messageHandler: (message: any) => void,
    options?: Options,
  ) {
    this.trackingHost = options?.trackingHost ?? TRACKING_HOST;
    this.ablyRestHost = options?.ablyRestHost ?? ABLY_REST_HOST;
    this.ablyRealtimeHost = options?.ablyRealtimeHost ?? ABLY_REALTIME_HOST;
    this.debug = options?.debug ?? false;
  }

  private log(message: string, ...args: any[]) {
    if (this.debug) {
      console.log("[SSE]", message, ...args);
    }
  }

  private err(message: string, ...args: any[]): never {
    if (this.debug) {
      console.error("[SSE]", message, ...args);
    }
    throw new Error(message);
  }

  private async refreshTokenRequest() {
    this.tokenRequest = null;
    this.token = null;

    const res = await fetch(
      `${this.trackingHost}/${encodeURIComponent(
        this.trackingKey,
      )}/feedback/prompting-auth&userId=${encodeURIComponent(this.userId)}`,
      {
        method: "get",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (res.status == 200) {
      const body = await res.json();
      if (body.success) {
        delete body.success;
        this.tokenRequest = body;

        this.log("obtained new token request", this.tokenRequest);
        return;
      }
    }

    this.err("server did not release a token request", res);
  }

  private async refreshToken() {
    this.token = null;

    if (!this.tokenRequest) {
      await this.refreshTokenRequest();
    }

    const res = await fetch(
      `${this.ablyRestHost}/keys/${encodeURIComponent(
        this.tokenRequest!.keyName,
      )}/requestToken`,
      {
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(this.tokenRequest),
      },
    );

    if (res.status == 200) {
      this.token = await res.json();
      this.log("obtained new token", this.token);
      return;
    }

    this.err("server did not release a token", res);
  }

  private async onError(e: Event) {
    if (e instanceof MessageEvent) {
      const errorPayload = JSON.parse(e.data);
      const errorCode = Number(errorPayload?.code);

      if (errorCode >= 40140 && errorCode < 40150) {
        this.log("token expired, refreshing");
        await this.connect();
      }
      return;
    }

    this.err("unexpected error occured", e);
  }

  private onMessage(e: MessageEvent) {
    const message = JSON.parse(e.data);
    this.log("received message", e);

    if (message?.data) {
      this.messageHandler(message?.data);
    }
  }

  public async connect() {
    this.disconnect();
    await this.refreshToken();

    this.eventSource = new ReconnectingEventSource(
      `${this.ablyRealtimeHost}/sse?v=1.2&accessToken=${encodeURIComponent(
        this.token!.token,
      )}&channels=${encodeURIComponent(this.channel)}&rewind=1`,
    );

    this.eventSource.addEventListener("error", (e) => this.onError(e));
    this.eventSource.addEventListener("message", (m) => this.onMessage(m));

    this.log("opened connection");
  }

  public disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;

      this.log("closed connection");
    }
  }
}
