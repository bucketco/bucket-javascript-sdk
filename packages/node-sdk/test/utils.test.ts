import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  isObject,
  mergeDeep,
  ok,
  rateLimited,
  readNotifyProxy,
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

describe("mergeDeep", () => {
  it("should merge two objects", () => {
    const obj1 = { a: 1, b: { c: 2, d: 3 } };
    const obj2 = { b: { c: 4, e: 5 }, f: 6 };
    const result = mergeDeep(obj1, obj2);

    expect(result).toEqual({ a: 1, b: { c: 4, d: 3, e: 5 }, f: 6 });
  });

  it("should merge three objects", () => {
    const obj1 = { a: 1, b: { c: 2, d: 3 } };
    const obj2 = { b: { c: 4, e: 5 }, f: 6 };
    const obj3 = { a: 7, b: { d: 8, e: 9 }, g: 10 };
    const result = mergeDeep(obj1, obj2, obj3);

    expect(result).toEqual({ a: 7, b: { c: 4, d: 8, e: 9 }, f: 6, g: 10 });
  });

  it("should merge four objects", () => {
    const obj1 = { a: 1, b: { c: 2, d: 3 } };
    const obj2 = { b: { c: 4, e: 5 }, f: 6 };
    const obj3 = { a: 7, b: { d: 8, e: 9 }, g: 10 };
    const obj4 = { a: 11, b: { c: 12, e: 13 }, g: 14, h: 15 };
    const result = mergeDeep(obj1, obj2, obj3, obj4);

    expect(result).toEqual({
      a: 11,
      b: { c: 12, d: 8, e: 13 },
      f: 6,
      g: 14,
      h: 15,
    });
  });

  it("should merge arrays", () => {
    const obj1 = { a: [1, 2, 3] };
    const obj2 = { a: [4, 5, 6] };
    const result = mergeDeep(obj1, obj2);

    expect(result).toEqual({ a: [4, 5, 6] });
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

describe("readNotifyProxy", () => {
  it("should notify the callback when a property is accessed", () => {
    const target = { a: 1, b: 2 };
    const callback = vi.fn();
    const proxy = readNotifyProxy(target, callback);
    const a = proxy.a;
    const b = proxy.b;

    expect(a).toBe(1);
    expect(b).toBe(2);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith("a", 1);
    expect(callback).toHaveBeenCalledWith("b", 2);
  });

  it("should throw an error when a property is set", () => {
    const target = { a: 1, b: 2 };
    const callback = vi.fn();
    const proxy = readNotifyProxy(target, callback);

    expect(() => {
      proxy.a = 3;
    }).toThrowError("Cannot modify property 'a' of the object.");
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
