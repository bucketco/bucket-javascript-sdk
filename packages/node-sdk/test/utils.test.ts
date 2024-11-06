import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { decorateLogger, isObject, mergeSkipUndefined, ok } from "../src/utils";

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

describe("mergeSkipUndefined", () => {
  it("merges two objects with no undefined values", () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    const result = mergeSkipUndefined(target, source);
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("merges two objects where the source has undefined values", () => {
    const target = { a: 1, b: 2 };
    const source = { b: undefined, c: 4 };
    const result = mergeSkipUndefined(target, source);
    expect(result).toEqual({ a: 1, b: 2, c: 4 });
  });

  it("merges two objects where the target has undefined values", () => {
    const target = { a: 1, b: undefined };
    const source = { b: 3, c: 4 };
    const result = mergeSkipUndefined(target, source);
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("merges two objects where both have undefined values", () => {
    const target = { a: 1, b: undefined };
    const source = { b: undefined, c: 4 };
    const result = mergeSkipUndefined(target, source);
    expect(result).toEqual({ a: 1, c: 4 });
  });

  it("merges two empty objects", () => {
    const target = {};
    const source = {};
    const result = mergeSkipUndefined(target, source);
    expect(result).toEqual({});
  });
});
