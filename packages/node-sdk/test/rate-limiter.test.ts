import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { newRateLimiter } from "../src/rate-limiter";

describe("rateLimiter", () => {
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  beforeEach(() => {
    vi.advanceTimersByTime(600000); // Advance time by 10 minutes
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe("isAllowed", () => {
    it("should rate limit and report expected results", () => {
      const limiter = newRateLimiter(10, 5);
      for (let i = 0; i < 5; i++) {
        const res = limiter.isAllowed("key");
        expect(res).toBe(true);
      }
      for (let i = 0; i < 5; i++) {
        const res = limiter.isAllowed("key");
        expect(res).toBe(false);
      }
    });

    it("should reset the limit after a minute", () => {
      const limiter = newRateLimiter(60 * 1000, 5);

      for (let i = 0; i < 12; i++) {
        const res = limiter.isAllowed("key");
        expect(res).toBe(i <= 4 || i >= 11);

        vi.advanceTimersByTime(6000); // Advance time by 6 seconds
      }
    });

    it("should measure events separately by key", () => {
      const limiter = newRateLimiter(60 * 1000, 1);

      expect(limiter.isAllowed("key1")).toBe(true);
      expect(limiter.isAllowed("key2")).toBe(true);

      vi.advanceTimersByTime(10000);

      expect(limiter.isAllowed("key1")).toBe(false);
      expect(limiter.isAllowed("key1")).toBe(false);
    });
  });
});
