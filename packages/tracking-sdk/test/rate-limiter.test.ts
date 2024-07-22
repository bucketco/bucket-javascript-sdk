import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import rateLimited from "../src/rate-limiter";

describe("rateLimit", () => {
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  beforeEach(() => {
    vi.advanceTimersByTime(600000); // Advance time by 10 minutes
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should call the key generator", () => {
    const callback = vi.fn();
    const keyFunc = vi
      .fn()
      .mockReturnValue("key1")
      .mockReturnValueOnce("key2")
      .mockReturnValueOnce("key3")
      .mockReturnValueOnce("key4")
      .mockReturnValueOnce("key5");

    const limited = rateLimited(1, keyFunc, callback);

    for (let i = 0; i < 5; i++) {
      limited();
    }

    expect(keyFunc).toHaveBeenCalledTimes(5);
    expect(callback).toHaveBeenCalledTimes(5);
  });

  it("should call the callback when the limit is exceeded with appropriate boolean value", () => {
    const callback = vi.fn();
    const limited = rateLimited(5, () => "key", callback);

    for (let i = 0; i < 10; i++) {
      limited();
    }

    expect(callback).toHaveBeenCalledTimes(10);
    for (let i = 0; i < 10; i++) {
      expect(callback).toHaveBeenNthCalledWith(i + 1, i > 4);
    }
  });

  it("should call the callback when the limit is not exceeded", () => {
    const callback = vi.fn();
    const limited = rateLimited(5, () => "key", callback);

    for (let i = 0; i < 5; i++) {
      limited();
    }

    expect(callback).toHaveBeenCalledTimes(5);
    for (let i = 0; i < 5; i++) {
      expect(callback).toHaveBeenNthCalledWith(i + 1, false);
    }
  });

  it("should reset the limit after a minute", () => {
    const callback = vi.fn();
    const limited = rateLimited(5, () => "key", callback);

    for (let i = 0; i < 12; i++) {
      limited();
      vi.advanceTimersByTime(6000); // Advance time by 6 seconds
    }

    expect(callback).toHaveBeenCalledTimes(12);
    for (let i = 0; i < 12; i++) {
      expect(callback).toHaveBeenNthCalledWith(i + 1, i > 4 && i < 11);
    }
  });

  it("should measure events separately by key", () => {
    const callback = vi.fn();
    const limited1 = rateLimited(5, () => "key1", callback);
    const limited2 = rateLimited(5, () => "key2", callback);

    for (let i = 0; i < 10; i++) {
      limited1();
      limited2();
    }

    expect(callback).toHaveBeenCalledTimes(20);
  });

  it("should return the value of the callback always", () => {
    const callback = vi.fn();
    const limited = rateLimited(5, () => "key", callback);

    for (let i = 0; i < 10; i++) {
      callback.mockReturnValue(i);
      const res = limited();

      expect(res).toBe(i);
    }
  });
});
