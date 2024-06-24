import { describe, expect, it, vi } from "vitest";

import rateLimited from "../src/rate-limiter";

vi.useFakeTimers({ shouldAdvanceTime: true });

describe("rateLimit", () => {
  it("should not call the callback when the limit is exceeded", () => {
    const callback = vi.fn();
    const limited = rateLimited(5, callback);

    for (let i = 0; i < 10; i++) {
      limited();
    }

    expect(callback).toHaveBeenCalledTimes(5);
  });

  it("should call the callback when the limit is not exceeded", () => {
    const callback = vi.fn();
    const limited = rateLimited(5, callback);

    for (let i = 0; i < 5; i++) {
      limited();
    }

    expect(callback).toHaveBeenCalledTimes(5);
  });

  it("should reset the limit after a minute", () => {
    const callback = vi.fn();
    const limited = rateLimited(5, callback);

    for (let i = 0; i < 12; i++) {
      limited();
      vi.advanceTimersByTime(6000); // Advance time by 6 seconds
    }

    expect(callback).toHaveBeenCalledTimes(6);
  });
});

vi.runAllTimers();
