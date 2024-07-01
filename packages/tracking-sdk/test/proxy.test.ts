import { describe, expect, it, vi } from "vitest";

import { readonly } from "../src/proxy";

describe("readonly", () => {
  it("should not allow modification of properties", () => {
    const obj = { a: 1, b: 2 };
    const proxy = readonly(obj);

    proxy.a = 3;

    expect(proxy.a).toBe(1);
  });

  it("should call the callback when any property", () => {
    const obj = { a: 1, b: 2 };
    const callback = vi.fn();
    const proxy = readonly(obj, callback);

    const value = proxy.a;

    expect(callback).toHaveBeenCalledWith("a", 1);
    expect(value).toBe(1);
  });

  it("should not call the callback when accessing unknown property", () => {
    const obj = { a: 1, b: 2 };
    const callback = vi.fn();
    const proxy = readonly(obj, callback);

    const value = (proxy as any).z;

    expect(callback).not.toHaveBeenCalled();
    expect(value).toBeUndefined();
  });
});
