import Cookies from "js-cookie";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  checkPromptMessageCompleted,
  markPromptMessageCompleted,
} from "../src/prompt-storage";

vi.mock("js-cookie");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2020-01-01"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("prompt-storage", () => {
  test("markPromptMessageCompleted", async () => {
    const spy = vi.spyOn(Cookies, "set");

    markPromptMessageCompleted("user", "prompt");

    expect(spy).toHaveBeenCalledWith("bucket-prompt-user", "prompt", {
      expires: new Date("2030-01-01"),
    });
  });

  test("checkPromptMessageCompleted with positive result", async () => {
    const spy = vi.spyOn(Cookies, "get").mockReturnValue("prompt" as any);

    expect(checkPromptMessageCompleted("user", "prompt")).toBe(true);

    expect(spy).toHaveBeenCalledWith("bucket-prompt-user");
  });

  test("checkPromptMessageCompleted with negative result", async () => {
    const spy = vi.spyOn(Cookies, "get").mockReturnValue("other" as any);

    expect(checkPromptMessageCompleted("user", "prompt")).toBe(false);

    expect(spy).toHaveBeenCalledWith("bucket-prompt-user");
  });
});
