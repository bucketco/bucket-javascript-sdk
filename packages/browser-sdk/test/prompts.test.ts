import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  parsePromptMessage,
  processPromptMessage,
} from "../src/feedback/prompts";
import {
  checkPromptMessageCompleted,
  markPromptMessageCompleted,
} from "../src/feedback/promptStorage";

vi.mock("../src/feedback/promptStorage", () => {
  return {
    markPromptMessageCompleted: vi.fn(),
    checkPromptMessageCompleted: vi.fn(),
  };
});

describe("parsePromptMessage", () => {
  test("will not parse invalid messages", () => {
    expect(parsePromptMessage(undefined)).toBeUndefined();
    expect(parsePromptMessage("invalid")).toBeUndefined();
    expect(
      parsePromptMessage({ showAfter: Date.now(), showBefore: Date.now() }),
    ).toBeUndefined();
    expect(
      parsePromptMessage({
        question: "",
        showAfter: Date.now(),
        showBefore: Date.now(),
      }),
    ).toBeUndefined();
    expect(
      parsePromptMessage({
        question: "hello?",
        showBefore: Date.now(),
        promptId: "123",
        featureId: "123",
      }),
    ).toBeUndefined();
    expect(
      parsePromptMessage({
        question: "hello?",
        showAfter: Date.now(),
        promptId: "123",
        featureId: "123",
      }),
    ).toBeUndefined();
    expect(
      parsePromptMessage({
        question: "hello?",
        showAfter: Date.now(),
        showBefore: Date.now(),
      }),
    ).toBeUndefined();
    expect(
      parsePromptMessage({
        question: "hello?",
        showAfter: Date.now(),
        showBefore: Date.now(),
        promptId: "123",
      }),
    ).toBeUndefined();
    expect(
      parsePromptMessage({
        question: "hello?",
        showAfter: Date.now(),
        showBefore: Date.now(),
        featureId: "123",
      }),
    ).toBeUndefined();
  });

  test("will parse valid messages", () => {
    const start = Date.parse("2021-01-01T00:00:00.000Z");
    const end = Date.parse("2021-01-01T10:00:00.000Z");

    expect(
      parsePromptMessage({
        question: "hello?",
        showAfter: start,
        showBefore: end,
        promptId: "123",
        featureId: "456",
      }),
    ).toEqual({
      question: "hello?",
      showAfter: new Date(start),
      showBefore: new Date(end),
      promptId: "123",
      featureId: "456",
    });
  });
});

describe("processPromptMessage", () => {
  const now = Date.now();
  const promptTemplate = {
    question: "hello?",
    promptId: "123",
    featureId: "456",
  };

  beforeEach(() => {
    vi.mocked(checkPromptMessageCompleted).mockReturnValue(false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test("will not process seen prompts", () => {
    vi.mocked(checkPromptMessageCompleted).mockReturnValue(true);

    const prompt = {
      ...promptTemplate,
      showAfter: new Date(now - 10000),
      showBefore: new Date(now + 10000),
    };

    const showCallback = vi.fn();

    expect(processPromptMessage("user", prompt, showCallback)).toBe(false);

    expect(showCallback).not.toHaveBeenCalled();
    expect(markPromptMessageCompleted).not.toHaveBeenCalled();
  });

  test("will not process expired prompts", () => {
    const prompt = {
      ...promptTemplate,
      showAfter: new Date(now - 10000),
      showBefore: new Date(now - 5000),
    };

    const showCallback = vi.fn();

    expect(processPromptMessage("user", prompt, showCallback)).toBe(false);

    expect(showCallback).not.toHaveBeenCalled();

    expect(markPromptMessageCompleted).not.toHaveBeenCalled();
  });

  test("will process prompts that are ready to be shown", () => {
    const prompt = {
      ...promptTemplate,
      showAfter: new Date(now - 10000),
      showBefore: new Date(now + 10000),
    };

    const showCallback = vi
      .fn()
      .mockImplementation((_a, _b, actionedCallback) => {
        actionedCallback();
      });

    expect(processPromptMessage("user", prompt, showCallback)).toBe(true);
    expect(showCallback).toHaveBeenCalledWith(
      "user",
      prompt,
      expect.any(Function),
    );

    expect(markPromptMessageCompleted).toHaveBeenCalledOnce();
    expect(markPromptMessageCompleted).toBeCalledWith(
      "user",
      "123",
      prompt.showBefore,
    );
  });

  test("will process and delay prompts that are not yet ready to be shown", () => {
    const prompt = {
      ...promptTemplate,
      showAfter: new Date(now + 5000),
      showBefore: new Date(now + 10000),
    };

    const showCallback = vi
      .fn()
      .mockImplementation((_a, _b, actionedCallback) => {
        actionedCallback();
      });

    expect(processPromptMessage("user", prompt, showCallback)).toBe(true);
    expect(showCallback).not.toHaveBeenCalled();
    expect(localStorage.getItem("prompt-user")).toBeNull();

    vi.runAllTimers();
    expect(showCallback).toHaveBeenCalledWith(
      "user",
      prompt,
      expect.any(Function),
    );

    expect(markPromptMessageCompleted).toHaveBeenCalledOnce();
    expect(markPromptMessageCompleted).toBeCalledWith(
      "user",
      "123",
      prompt.showBefore,
    );
  });
});
