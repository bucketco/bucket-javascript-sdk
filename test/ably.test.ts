import { Realtime } from "ably/promises";
import { describe, expect, test, vi } from "vitest";

import { closeAblyConnection, openAblyConnection } from "../src/ably";

vi.mock("ably/promises");

describe("ably", () => {
  test("calls the ably constructor with expected arguments", async () => {
    const channelFn = vi.fn();
    const client = {
      channels: {
        get: vi.fn().mockReturnValue({ subscribe: channelFn }),
      },
    };
    const spy = vi.spyOn(Realtime, "Promise").mockReturnValue(client as any);

    const callback = vi.fn();
    const expClient = await openAblyConnection(
      "https://example.com",
      "user",
      "channel",
      callback,
    );

    expect(expClient).toBe(client);
    expect(spy).toHaveBeenCalledWith({
      authUrl: "https://example.com",
      log: { level: 1 },
      authParams: {
        userId: "user",
      },
    });

    expect(client.channels.get).toHaveBeenCalledWith("channel", {
      params: {
        rewind: "1",
      },
    });

    expect(channelFn).toHaveBeenCalledWith(expect.any(Function));
  });

  test("calls the ably close function", async () => {
    const client = {
      close: vi.fn(),
    };

    closeAblyConnection(client as any);
    expect(client.close).toHaveBeenCalled();
  });
});
