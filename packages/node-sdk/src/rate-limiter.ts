import { clearInterval } from "timers";

import { ok } from "./utils";

/**
 * Creates a new rate limiter.
 *
 * @typeparam TKey - The type of the key.
 * @param windowSizeMs - The length of the time window in milliseconds.
 *
 * @returns The rate limiter.
 **/
export function newRateLimiter(windowSizeMs: number) {
  ok(
    typeof windowSizeMs == "number" && windowSizeMs > 0,
    "windowSizeMs must be greater than 0",
  );

  let lastAllowedTimestampsByKey: { [key: string]: number } = {};
  let clearIntervalId: NodeJS.Timeout | undefined;

  function clear(all: boolean): void {
    if (clearIntervalId) {
      clearInterval(clearIntervalId);
      clearIntervalId = undefined;
    }

    if (all) {
      lastAllowedTimestampsByKey = {};
    } else {
      const expiredAfter = Date.now() - windowSizeMs;
      const keys = Object.keys(lastAllowedTimestampsByKey);

      for (const key in keys) {
        const lastAllowedTimestamp = lastAllowedTimestampsByKey[key];

        if (lastAllowedTimestamp < expiredAfter) {
          delete lastAllowedTimestampsByKey[key];
        }
      }
    }
  }

  function isAllowed(key: string): boolean {
    clearIntervalId =
      clearIntervalId || setInterval(() => clear(false), windowSizeMs);

    const now = Date.now();

    const lastAllowedTimestamp = lastAllowedTimestampsByKey[key];
    if (lastAllowedTimestamp && lastAllowedTimestamp >= now - windowSizeMs) {
      return false;
    }

    lastAllowedTimestampsByKey[key] = now;
    return true;
  }

  return {
    clear,
    isAllowed,
  };
}
