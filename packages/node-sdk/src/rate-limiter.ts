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

  const eventsByKey: { [key: string]: number[] } = {};

  function clear() {
    for (const key in eventsByKey) {
      delete eventsByKey[key];
    }
  }

  function isAllowed(key: string): boolean {
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
