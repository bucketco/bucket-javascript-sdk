import Cookies from "js-cookie";
import { describe, expect, test, vi } from "vitest";

import {
  checkPromptMessageCompleted,
  forgetAuthToken,
  getAuthToken,
  markPromptMessageCompleted,
  rememberAuthToken,
} from "../src/prompt-storage";

vi.mock("js-cookie");

describe("prompt-storage", () => {
  test("markPromptMessageCompleted", async () => {
    const spy = vi.spyOn(Cookies, "set");

    markPromptMessageCompleted("user", "prompt", new Date("2021-01-01"));

    expect(spy).toHaveBeenCalledWith("bucket-prompt-user", "prompt", {
      expires: new Date("2021-01-01"),
      sameSite: "strict",
      secure: true,
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

  test("rememberAuthToken", async () => {
    const spy = vi.spyOn(Cookies, "set");

    rememberAuthToken(
      "user",
      "channel:suffix",
      "secret$%",
      new Date("2021-01-01"),
    );

    expect(spy).toHaveBeenCalledWith(
      "bucket-token-user",
      '{"channel":"channel:suffix","token":"secret$%"}',
      {
        expires: new Date("2021-01-01"),
        sameSite: "strict",
        secure: true,
      },
    );
  });

  test("forgetAuthToken", async () => {
    const spy = vi.spyOn(Cookies, "remove");

    forgetAuthToken("user");

    expect(spy).toHaveBeenCalledWith("bucket-token-user");
  });

  test("getAuthToken with positive result", async () => {
    const spy = vi
      .spyOn(Cookies, "get")
      .mockReturnValue(
        '{"channel":"channel:suffix","token":"secret%$"}' as any,
      );

    expect(getAuthToken("user")).toStrictEqual({
      channel: "channel:suffix",
      token: "secret%$",
    });

    expect(spy).toHaveBeenCalledWith("bucket-token-user");
  });

  test("getAuthToken with error", async () => {
    const spy = vi.spyOn(Cookies, "get").mockReturnValue("token" as any);

    expect(getAuthToken("user")).toBeUndefined();

    expect(spy).toHaveBeenCalledWith("bucket-token-user");
  });

  test("getAuthToken with empty field", async () => {
    const spy = vi
      .spyOn(Cookies, "get")
      .mockReturnValue('{"channel":"","token":"secret%$"}' as any);

    expect(getAuthToken("user")).toBeUndefined();

    expect(spy).toHaveBeenCalledWith("bucket-token-user");
  });

  test("getAuthToken with negative result", async () => {
    const spy = vi.spyOn(Cookies, "get").mockReturnValue(undefined as any);

    expect(getAuthToken("user")).toBeUndefined();

    expect(spy).toHaveBeenCalledWith("bucket-token-user");
  });
});
