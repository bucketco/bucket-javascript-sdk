import { describe, expect, it, vi } from "vitest";

import maskedProxy from "../src/flags/maskedProxy";

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
