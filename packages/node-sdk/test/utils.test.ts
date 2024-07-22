import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  decorateLogger,
  isObject,
  ok,
  rateLimited,
  maskedProxy,
} from "../src/utils";

describe("isObject", () => {
  it("should return true for an object", () => {
    expect(isObject({})).toBe(true);
  });

  it("should return false for an array", () => {
    expect(isObject([])).toBe(false);
  });

  it("should return false for a string", () => {
    expect(isObject("")).toBe(false);
  });

  it("should return false for a number", () => {
    expect(isObject(0)).toBe(false);
  });

  it("should return false for a boolean", () => {
    expect(isObject(true)).toBe(false);
  });

  it("should return false for null", () => {
    expect(isObject(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isObject(undefined)).toBe(false);
  });
});

describe("ok", () => {
  it("should throw an error if the condition is false", () => {
    expect(() => ok(false, "error")).toThrowError("error");
  });

  it("should not throw an error if the condition is true", () => {
    expect(() => ok(true, "error")).not.toThrow();
  });
});

describe("maskedProxy", () => {
  it("should not allow modification of properties", () => {
    const obj = { a: 1, b: 2 };
    const proxy = maskedProxy(obj, (t, k) => t[k]);

    (proxy as any).a = 3;

    expect(proxy.a).toBe(1);
  });

  it("should call the callback for any property", () => {
    const obj = { a: 1, b: 2 };
    const callback = vi.fn().mockImplementation((t, k) => t[k]);
    const proxy = maskedProxy(obj, callback);

    const value = proxy.a;

    expect(callback).toHaveBeenCalledWith(obj, "a");
    expect(value).toBe(1);
  });

  it("should not call the callback when accessing unknown property", () => {
    const obj = { a: 1, b: 2 };
    const callback = vi.fn();
    const proxy = maskedProxy(obj, callback);

    const value = (proxy as any).z;

    expect(callback).not.toHaveBeenCalled();
    expect(value).toBeUndefined();
  });

  it("should mascarade the real object", () => {
    const obj = { a: 1, b: 2, c: { d: 3 } };

    const callback = vi.fn().mockImplementation((_, k) => k);
    const proxy = maskedProxy(obj, callback);

    expect(proxy).toEqual({
      a: "a",
      b: "b",
      c: "c",
    });
  });
});

describe("rateLimited", () => {
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

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

describe("decorateLogger", () => {
  it("should decorate the logger", () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const decorated = decorateLogger("prefix", logger);

    decorated.debug("message");
    decorated.info("message");
    decorated.warn("message");
    decorated.error("message");

    expect(logger.debug).toHaveBeenCalledWith("prefix message");
    expect(logger.info).toHaveBeenCalledWith("prefix message");
    expect(logger.warn).toHaveBeenCalledWith("prefix message");
    expect(logger.error).toHaveBeenCalledWith("prefix message");
  });

  it("should throw an error if the prefix is not a string", () => {
    expect(() => decorateLogger(0 as any, {} as any)).toThrowError(
      "prefix must be a string",
    );
  });

  it("should throw an error if the logger is not an object", () => {
    expect(() => decorateLogger("", 0 as any)).toThrowError(
      "logger must be an object",
    );
  });
});
