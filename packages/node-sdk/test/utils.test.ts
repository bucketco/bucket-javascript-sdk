import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  checkWithinAllottedTimeWindow,
  decorateLogger,
  isObject,
  maskedProxy,
  ok,
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

describe("checkWithinAllottedTimeWindow", () => {
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  beforeEach(() => {
    vi.advanceTimersByTime(600000); // Advance time by 10 minutes
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should rate limit and report expected results", () => {
    for (let i = 0; i < 5; i++) {
      const res = checkWithinAllottedTimeWindow(5, "key");
      expect(res).toBe(true);
    }
    for (let i = 0; i < 5; i++) {
      const res = checkWithinAllottedTimeWindow(5, "key");
      expect(res).toBe(false);
    }
  });

  it("should reset the limit after a minute", () => {
    for (let i = 0; i < 12; i++) {
      const res = checkWithinAllottedTimeWindow(5, "key");
      expect(res).toBe(i <= 4 || i >= 11);

      vi.advanceTimersByTime(6000); // Advance time by 6 seconds
    }
  });

  it("should measure events separately by key", () => {
    expect(checkWithinAllottedTimeWindow(1, "key1")).toBe(true);
    expect(checkWithinAllottedTimeWindow(1, "key2")).toBe(true);

    vi.advanceTimersByTime(10000);

    expect(checkWithinAllottedTimeWindow(1, "key1")).toBe(false);
    expect(checkWithinAllottedTimeWindow(1, "key1")).toBe(false);
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
