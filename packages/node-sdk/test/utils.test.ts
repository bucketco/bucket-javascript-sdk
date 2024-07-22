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
  decorateLogger,
  isObject,
  maskedProxy,
  ok,
  rateLimited,
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
