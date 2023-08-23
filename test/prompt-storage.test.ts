import Cookies from "js-cookie";
import { describe, expect, test, vi } from "vitest";

import {
  checkPromptMessageCompleted,
  markPromptMessageCompleted,
} from "../src/prompt-storage";

vi.mock("js-cookie");

describe("prompt-storage", () => {
  test("markPromptMessageCompleted", async () => {
    const spy = vi.spyOn(Cookies, "set");

    markPromptMessageCompleted("user", "prompt", new Date("2021-01-01"));

    expect(spy).toHaveBeenCalledWith("prompt-user", "prompt", {
      expires: new Date("2021-01-01"),
    });
  });

  test("checkPromptMessageCompleted with positive result", async () => {
    const spy = vi.spyOn(Cookies, "get").mockReturnValue("prompt" as any);

    expect(checkPromptMessageCompleted("user", "prompt")).toBe(true);

    expect(spy).toHaveBeenCalledWith("prompt-user");
  });

  test("checkPromptMessageCompleted with negative result", async () => {
    const spy = vi.spyOn(Cookies, "get").mockReturnValue("other" as any);

    expect(checkPromptMessageCompleted("user", "prompt")).toBe(false);

    expect(spy).toHaveBeenCalledWith("prompt-user");
  });
});
