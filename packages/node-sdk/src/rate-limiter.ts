import { clearInterval } from "timers";

import { RateLimiter } from "./types";
import { ok } from "./utils";

/**
 * Creates a new rate limiter.
 *
 * @typeparam TKey - The type of the key.
 * @param windowSizeMs - The length of the time window in milliseconds.
 * @param eventLimit - The number of events allowed per time window.
 *
 * @returns The rate limiter.
 **/
export function newRateLimiter(
  windowSizeMs: number,
  eventLimit: number,
): RateLimiter<string> {
  ok(
    typeof windowSizeMs == "number" && windowSizeMs > 0,
    "windowSizeMs must be greater than 0",
  );
  ok(
    typeof eventLimit == "number" && eventLimit > 0,
    "eventLimit must be greater than 0",
  );

  let eventsByKey: { [key: string]: number[] } = {};
  let clearIntervalId: NodeJS.Timeout | undefined;

  function clear(all: boolean): void {
    if (clearIntervalId) {
      clearInterval(clearIntervalId);
      clearIntervalId = undefined;
    }

    if (all) {
      eventsByKey = {};
    } else {
      const expiredAfter = Date.now() - windowSizeMs;

      for (const key in eventsByKey) {
        const events = eventsByKey[key];
        const last = events.length ? events[events.length - 1] : undefined;

        if (last && last < expiredAfter) {
          delete eventsByKey[key];
        }
      }
    }
  }

  function isAllowed(key: string): boolean {
    clearIntervalId =
      clearIntervalId || setInterval(() => clear(false), windowSizeMs);

    const now = Date.now();

    if (!eventsByKey[key]) {
      eventsByKey[key] = [];
    }

    const events = eventsByKey[key];

    while (events.length && now - events[0] > windowSizeMs) {
      events.shift();
    }

    const limitExceeded = events.length >= eventLimit;

    if (!limitExceeded) {
      events.push(now);
    }

    return !limitExceeded;
  }

  return {
    clear,
    isAllowed,
  } satisfies RateLimiter<string>;
}
