import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { newRateLimiter } from "../src/rate-limiter";

describe("rateLimiter", () => {
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const windowSizeMs = 1000;

  describe("isAllowed", () => {
    it("should rate limit", () => {
      const limiter = newRateLimiter(windowSizeMs);

      expect(limiter.isAllowed("key")).toBe(true);
      expect(limiter.isAllowed("key")).toBe(false);
    });

    it("should reset the limit in given time", () => {
      const limiter = newRateLimiter(windowSizeMs);

      limiter.isAllowed("key");

      vi.advanceTimersByTime(windowSizeMs);
      expect(limiter.isAllowed("key")).toBe(false);

      vi.advanceTimersByTime(1);
      expect(limiter.isAllowed("key")).toBe(true);
    });

    it("should measure events separately by key", () => {
      const limiter = newRateLimiter(windowSizeMs);

      expect(limiter.isAllowed("key1")).toBe(true);

      vi.advanceTimersByTime(windowSizeMs);
      expect(limiter.isAllowed("key2")).toBe(true);
      expect(limiter.isAllowed("key1")).toBe(false);

      vi.advanceTimersByTime(1);
      expect(limiter.isAllowed("key1")).toBe(true);

      vi.advanceTimersByTime(windowSizeMs);
      expect(limiter.isAllowed("key2")).toBe(true);
    });
  });

  describe("clear", () => {
    it("should clear all events when 'all' is true", () => {
      const rateLimiter = newRateLimiter(windowSizeMs);

      expect(rateLimiter.isAllowed("key1")).toBe(true);
      expect(rateLimiter.isAllowed("key2")).toBe(true);
      expect(rateLimiter.isAllowed("key1")).toBe(false);
      expect(rateLimiter.isAllowed("key2")).toBe(false);

      rateLimiter.clear(true);

      expect(rateLimiter.isAllowed("key1")).toBe(true);
      expect(rateLimiter.isAllowed("key2")).toBe(true);
    });

    it("should clear expired events when 'all' is false, but keep non-expired", () => {
      const rateLimiter = newRateLimiter(windowSizeMs);
      expect(rateLimiter.isAllowed("key1")).toBe(true);

      vi.setSystemTime(new Date().getTime() + windowSizeMs + 1);
      expect(rateLimiter.isAllowed("key2")).toBe(true);

      rateLimiter.clear(false);

      expect(rateLimiter.isAllowed("key1")).toBe(true);
      expect(rateLimiter.isAllowed("key2")).toBe(false);
    });
  });

  it("should periodically clean up expired keys", () => {
    const rateLimiter = newRateLimiter(windowSizeMs);

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
