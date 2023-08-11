import { describe, expect, test } from "vitest";
import { parsePromptMessage } from "../src/prompts";

describe("parsePromptMessage", () => {
  test("will not parse invalid messages", () => {
    expect(parsePromptMessage(undefined)).toBeUndefined();
    expect(parsePromptMessage("invalid")).toBeUndefined();
    expect(parsePromptMessage({ showAfter: Date.now(), showBefore: Date.now() })).toBeUndefined();
    expect(parsePromptMessage({ question: "", showAfter: Date.now(), showBefore: Date.now() })).toBeUndefined();
    expect(parsePromptMessage({ question: "hello?", showBefore: Date.now() })).toBeUndefined();
    expect(parsePromptMessage({ question: "hello?", showAfter: Date.now() })).toBeUndefined();
  });

  test("will parse valid messages", () => {
    const start = Date.parse("2021-01-01T00:00:00.000Z");
    const end = Date.parse("2021-01-01T10:00:00.000Z");

    expect(parsePromptMessage({
      question: "hello?",
      showAfter: start,
      showBefore: end,
    })).toEqual({
      question: "hello?",
      showAfter: new Date(start),
      showBefore: new Date(end),
    });
  });
});
