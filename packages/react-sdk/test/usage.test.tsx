import { describe, expect, test, vi } from "vitest";
import { render, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import Bucket, {
  BucketInstance,
  useBucket,
  useFeatureFlag,
  useFeatureFlags,
} from "../src";

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

    await waitFor(() => result.current["abc"]);
    expect(result.current).toEqual(flags);
  });
});

describe("useFeatureFlag", () => {
  test.each([
    { key: "abc", value: true },
    { key: "def", value: false },
  ])("returns the feature flag from context", async ({ key, value }) => {
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

    await waitFor(() => result.current[key]);
    expect(result.current).toEqual(value);
  });
});

function createSpySDK(): BucketInstance {
  return {
    getFeatureFlags: vi.fn(async () => {}),
    init: vi.fn(),
    reset: vi.fn(),
  } as any as BucketInstance;
}
