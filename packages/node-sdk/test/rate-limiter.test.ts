import {
  afterAll,
  afterEach,
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
    vi.advanceTimersByTime(10 * 60 * 1000); // Advance time by 10 minutes
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

  describe("clear", () => {
    let rateLimiter: ReturnType<typeof newRateLimiter>;
    const windowSizeMs = 1000;

    beforeEach(() => {
      rateLimiter = newRateLimiter(windowSizeMs, 1);
    });

    afterEach(() => {
      rateLimiter.clear(true);
    });

    it("should clear all events when 'all' is true", () => {
      expect(rateLimiter.isAllowed("key1")).toBe(true);
      expect(rateLimiter.isAllowed("key2")).toBe(true);
      expect(rateLimiter.isAllowed("key1")).toBe(false);
      expect(rateLimiter.isAllowed("key2")).toBe(false);

      rateLimiter.clear(true);

      expect(rateLimiter.isAllowed("key1")).toBe(true);
      expect(rateLimiter.isAllowed("key2")).toBe(true);
    });

    it("should clear expired events when 'all' is false, but keep non-expired", () => {
      expect(rateLimiter.isAllowed("key1")).toBe(true);

      vi.setSystemTime(new Date().getTime() + windowSizeMs + 1);
      expect(rateLimiter.isAllowed("key2")).toBe(true);

      rateLimiter.clear(false);

      expect(rateLimiter.isAllowed("key1")).toBe(true);
      expect(rateLimiter.isAllowed("key2")).toBe(false);
    });
  });

  it("should periodically clean up expired keys", () => {
    const windowSizeMs = 1000;

    const rateLimiter = newRateLimiter(windowSizeMs, 1);

    rateLimiter.isAllowed("key1");
    vi.advanceTimersByTime(windowSizeMs);
    expect(rateLimiter.isAllowed("key1")).toBe(false);

    vi.advanceTimersByTime(windowSizeMs + 1);
    expect(rateLimiter.isAllowed("key1")).toBe(true);

    rateLimiter.isAllowed("key2");

    vi.advanceTimersByTime(windowSizeMs + 1);

    expect(rateLimiter.isAllowed("key1")).toBe(true);
    expect(rateLimiter.isAllowed("key2")).toBe(true);
  });
});
