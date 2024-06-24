import { describe, expect, it, vi } from "vitest";

import { readonly } from "../src/proxy";

describe("readonly", () => {
  it("should not allow modification of properties", () => {
    const obj = { a: 1, b: 2 };
    const proxy = readonly(obj);

    expect(() => {
      proxy.a = 3;
    }).toThrow(new Error("Cannot modify property 'a' of the object."));
  });

  it("should call the callback when accessing specified properties", () => {
    const obj = { a: 1, b: 2 };
    const callback = vi.fn();
    const proxy = readonly(obj, ["a"], callback);

    const value = proxy.a;

    expect(callback).toHaveBeenCalledWith(obj, "a");
    expect(value).toBe(1);
  });

  it("should not call the callback when accessing unspecified properties", () => {
    const obj = { a: 1, b: 2 };
    const callback = vi.fn();
    const proxy = readonly(obj, ["a"], callback);

    const value = proxy.b;

    expect(callback).not.toHaveBeenCalled();
    expect(value).toBe(2);
  });
});
