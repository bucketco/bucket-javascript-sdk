import { describe, expect, test, vi, afterEach } from "vitest";
import { render, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import Bucket, {
  BucketInstance,
  useBucket,
  useFeatureFlag,
  useFeatureFlags,
} from "../src";

const originalConsoleError = console.error.bind(console);
afterEach(() => {
  console.error = originalConsoleError;
});

describe("<Bucket />", () => {
  test("calls init and getFeatureFlags", () => {
    const sdk = createSpySDK();
    const publishableKey = Math.random().toString();
    const flagOptions = { context: {} };

    render(
      <Bucket sdk={sdk} publishableKey={publishableKey} flags={flagOptions} />,
    );

    expect(sdk.init).toHaveBeenCalledOnce();
    expect(sdk.init).toHaveBeenCalledWith(publishableKey, {});
    expect(sdk.getFeatureFlags).toHaveBeenCalledOnce();
    expect(sdk.getFeatureFlags).toHaveBeenCalledWith(flagOptions);
  });

  test("only calls init once with the same args", () => {
    const sdk = createSpySDK();
    const publishableKey = Math.random().toString();
    const flagOptions = { context: {} };

    const node = (
      <Bucket sdk={sdk} publishableKey={publishableKey} flags={flagOptions} />
    );

    const x = render(node);
    x.rerender(node);
    x.rerender(node);
    x.rerender(node);

    expect(sdk.init).toHaveBeenCalledOnce();
    expect(sdk.getFeatureFlags).toHaveBeenCalledOnce();
  });
});

describe("useBucket", () => {
  test("returns the bucket instance", () => {
    const sdk = createSpySDK();
    const publishableKey = Math.random().toString();
    const flagOptions = { context: {} };

    const { result } = renderHook(() => useBucket(), {
      wrapper: ({ children }) => (
        <Bucket
          sdk={sdk}
          publishableKey={publishableKey}
          flags={flagOptions}
          children={children}
        />
      ),
    });

    expect(result.current).toEqual(sdk);
  });
});

describe("useFeatureFlags", () => {
  test("returns a loading state initially", async () => {
    const sdk = createSpySDK();
    sdk.getFeatureFlags = vi.fn(async () => ({}) as any);

    const publishableKey = Math.random().toString();
    const flagOptions = { context: {} };

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: ({ children }) => (
        <Bucket
          sdk={sdk}
          publishableKey={publishableKey}
          flags={flagOptions}
          children={children}
        />
      ),
    });

    expect(result.current).toMatchObject({ flags: {}, isLoading: true });
  });

  test("returns the feature flags in context", async () => {
    const flags = {
      abc: { value: true, key: "abc" },
      def: { value: false, key: "abc" },
    };

    const sdk = createSpySDK();
    sdk.getFeatureFlags = vi.fn(async () => flags);

    const publishableKey = Math.random().toString();
    const flagOptions = { context: {} };

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: ({ children }) => (
        <Bucket
          sdk={sdk}
          publishableKey={publishableKey}
          flags={flagOptions}
          children={children}
        />
      ),
    });

    await waitFor(() => result.current.isLoading === false);
    expect(result.current).toMatchObject({ flags, isLoading: false });
  });
});

describe("useFeatureFlag", () => {
  test("returns a loading state initially", async () => {
    console.error = vi.fn();

    const sdk = createSpySDK();
    sdk.getFeatureFlags = vi.fn(async () => ({}));

    const publishableKey = Math.random().toString();
    const flagOptions = { context: {} };

    const { result } = renderHook(() => useFeatureFlag("test-flag"), {
      wrapper: ({ children }) => (
        <Bucket
          sdk={sdk}
          publishableKey={publishableKey}
          flags={flagOptions}
          children={children}
        />
      ),
    });

    expect(result.current).toEqual({ isLoading: true, value: null });
    expect(console.error).not.toHaveBeenCalled();
  });

  test.each([
    { key: "abc", value: true },
    { key: "def", value: false },
  ])("returns the feature flag from context", async ({ key, value }) => {
    console.error = vi.fn();

    const flags = {
      abc: { value: true, key: "abc" },
      def: { value: false, key: "abc" },
    };

    const sdk = createSpySDK();
    sdk.getFeatureFlags = vi.fn(async () => flags);

    const publishableKey = Math.random().toString();
    const flagOptions = { context: {} };

    const { result } = renderHook(() => useFeatureFlag(key), {
      wrapper: ({ children }) => (
        <Bucket
          sdk={sdk}
          publishableKey={publishableKey}
          flags={flagOptions}
          children={children}
        />
      ),
    });

    await waitFor(() => result.current.isLoading === false);
    expect(result.current).toEqual({ isLoading: false, value: value });
    expect(console.error).not.toHaveBeenCalled();
  });

  test("fails when given a missing feature flag", async () => {
    console.error = vi.fn();

    const flags = {
      abc: { value: true, key: "abc" },
      def: { value: false, key: "abc" },
    };

    const sdk = createSpySDK();
    sdk.getFeatureFlags = vi.fn(async () => flags);

    const publishableKey = Math.random().toString();
    const flagOptions = { context: {} };

    const { result } = renderHook(() => useFeatureFlag("does-not-exist"), {
      wrapper: ({ children }) => (
        <Bucket
          sdk={sdk}
          publishableKey={publishableKey}
          flags={flagOptions}
          children={children}
        />
      ),
    });

    await waitFor(() => result.current.isLoading === false);
    expect(result.current).toEqual({ isLoading: false, value: null });
    expect(console.error).toHaveBeenCalledWith(
      '[Bucket SDK] The feature flag "does-not-exist" was not found',
    );
  });
});

function createSpySDK(): BucketInstance {
  return {
    getFeatureFlags: vi.fn(async () => {}),
    init: vi.fn(),
    reset: vi.fn(),
  } as any as BucketInstance;
}
