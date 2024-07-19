import React from "react";
import { render, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  BucketInstance,
  BucketProps,
  BucketProvider,
  useFlag,
  useFlags,
  useUpdateContext,
} from "../src";

const originalConsoleError = console.error.bind(console);
afterEach(() => {
  console.error = originalConsoleError;
});

const publishableKey = Math.random().toString();
const company = { id: "123", name: "test" };
const user = { id: "456", name: "test" };
const otherContext = { test: "test" };

function getProvider(props: Partial<BucketProps>) {
  return (
    <BucketProvider
      {...props}
      publishableKey={publishableKey}
      company={company}
      user={user}
      otherContext={otherContext}
    />
  );
}

describe("<BucketProvider />", () => {
  test("calls init and getFeatureFlags", () => {
    const sdk = createSpySDK();
    const provider = getProvider({ sdk });

    render(provider);

    expect(sdk.init).toHaveBeenCalledOnce();
    expect(sdk.init).toHaveBeenCalledWith(publishableKey, {});
    expect(sdk.getFeatureFlags).toHaveBeenCalledOnce();
    expect(sdk.getFeatureFlags).toHaveBeenCalledWith({
      context: { company, user, otherContext },
    });
  });

  test("only calls init once with the same args", () => {
    const sdk = createSpySDK();
    const node = getProvider({ sdk });

    const x = render(node);
    x.rerender(node);
    x.rerender(node);
    x.rerender(node);

    expect(sdk.init).toHaveBeenCalledOnce();
    expect(sdk.getFeatureFlags).toHaveBeenCalledOnce();
    expect(sdk.getFeatureFlags).toHaveBeenCalledWith({
      context: { company, user, otherContext },
    });
  });
});

describe("useFlags", () => {
  test("returns a loading state initially", async () => {
    const sdk = createSpySDK();
    sdk.getFeatureFlags = vi.fn(async () => ({}) as any);

    const { result, unmount } = renderHook(() => useFlags(), {
      wrapper: ({ children }) => getProvider({ sdk, children }),
    });

    expect(result.current).toMatchObject({ flags: {}, isLoading: true });
    unmount();
  });

  test("returns the feature flags in context", async () => {
    const flags = {
      abc: true,
      def: true,
    };

    const sdk = createSpySDK();
    sdk.getFeatureFlags = vi.fn(async () => Promise.resolve(flags));

    const { result } = renderHook(() => useFlags(), {
      wrapper: ({ children }) => getProvider({ sdk, children }),
    });

    await waitFor(() => result.current.isLoading === false);
    expect(result.current).toMatchObject({ flags, isLoading: false });
  });
});

describe("useFlag", () => {
  test("returns a loading state initially", async () => {
    console.error = vi.fn();

    const sdk = createSpySDK();
    sdk.getFeatureFlags = vi.fn(async () => ({}));

    const { result, unmount } = renderHook(() => useFlag("test-flag"), {
      wrapper: ({ children }) => getProvider({ sdk, children }),
    });

    expect(result.current).toEqual({ isLoading: true, isEnabled: false });
    expect(console.error).not.toHaveBeenCalled();

    unmount();
  });

  test.each([
    { key: "abc", value: true },
    { key: "def", value: false },
  ])("returns the feature flag from context", async ({ key, value }) => {
    console.error = vi.fn();

    const flags = { [key]: value };

    const sdk = createSpySDK();
    sdk.getFeatureFlags = vi.fn(async () => flags);

    const { result } = renderHook(() => useFlag(key), {
      wrapper: ({ children }) => getProvider({ sdk, children }),
    });

    await waitFor(() => result.current.isLoading === false);
    expect(result.current).toEqual({ isLoading: false, isEnabled: value });
    expect(console.error).not.toHaveBeenCalled();
  });

  test.each([
    { key: "abc", value: true },
    { key: "def", value: false },
  ])("returns the feature flag from context", async ({ key, value }) => {
    console.error = vi.fn();

    const flags = { [key]: value };

    const sdk = createSpySDK();
    sdk.getFeatureFlags = vi.fn(async () => flags);

    const { result } = renderHook(() => useFlag(key), {
      wrapper: ({ children }) => getProvider({ sdk, children }),
    });

    await waitFor(() => result.current.isLoading === false);
    expect(result.current).toEqual({ isLoading: false, isEnabled: value });
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("useUpdateContext", () => {
  test("updates SDK when user is reset", async () => {
    console.error = vi.fn();

    const sdk = createSpySDK();
    sdk.getFeatureFlags = vi.fn(async () => ({}));
    sdk.user = vi.fn();

    const { result, unmount } = renderHook(() => useUpdateContext(), {
      wrapper: ({ children }) => getProvider({ sdk, children }),
    });

    result.current.updateUser();

    expect(sdk.user).not.toHaveBeenCalled();
    expect(sdk.reset).toHaveBeenCalled();

    vi.mocked(sdk.getFeatureFlags).mockReset();

    expect(console.error).not.toHaveBeenCalled();

    await waitFor(() => result.current.isLoading === false);
    expect(sdk.getFeatureFlags).toHaveBeenCalledWith({
      context: { company, user: undefined, otherContext },
    });

    unmount();
  });

  test("updates SDK when user is updated", async () => {
    console.error = vi.fn();

    const sdk = createSpySDK();
    sdk.getFeatureFlags = vi.fn(async () => ({}));
    sdk.user = vi.fn();

    const { result, unmount } = renderHook(() => useUpdateContext(), {
      wrapper: ({ children }) => getProvider({ sdk, children }),
    });

    const newUser = { id: "new-user", name: "new-user-name" };
    result.current.updateUser(newUser);

    const { id, ...newUserAttrs } = newUser;
    expect(sdk.user).toHaveBeenCalledWith(id, newUserAttrs);
    expect(sdk.reset).not.toHaveBeenCalled();

    expect(console.error).not.toHaveBeenCalled();

    await waitFor(() => result.current.isLoading === false);
    expect(sdk.getFeatureFlags).toHaveBeenCalledWith({
      context: { company, user: newUser, otherContext },
    });

    unmount();
  });

  test("updates SDK when company is updated", async () => {
    console.error = vi.fn();

    const sdk = createSpySDK();
    sdk.getFeatureFlags = vi.fn(async () => ({}));
    sdk.user = vi.fn();

    const { result, unmount } = renderHook(() => useUpdateContext(), {
      wrapper: ({ children }) => getProvider({ sdk, children }),
    });

    const newCompany = { id: "new-comp", name: "new-company-name" };
    result.current.updateCompany(newCompany);

    const { id, ...companyAttrs } = newCompany;
    expect(sdk.company).toHaveBeenCalledWith(id, companyAttrs, user.id);
    expect(sdk.reset).not.toHaveBeenCalled();

    expect(console.error).not.toHaveBeenCalled();

    await waitFor(() => result.current.isLoading === false);
    expect(sdk.getFeatureFlags).toHaveBeenCalledWith({
      context: { company: newCompany, user, otherContext },
    });

    unmount();
  });

  test("updates SDK when other context is updated", async () => {
    console.error = vi.fn();

    const sdk = createSpySDK();
    sdk.getFeatureFlags = vi.fn(async () => ({}));
    sdk.user = vi.fn();

    const { result, unmount } = renderHook(() => useUpdateContext(), {
      wrapper: ({ children }) => getProvider({ sdk, children }),
    });

    const newOtherContext = { happeningId: "new-conference" };
    result.current.updateOtherContext(newOtherContext);

    expect(sdk.reset).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();

    await waitFor(() => result.current.isLoading === false);
    expect(sdk.getFeatureFlags).toHaveBeenCalledWith({
      context: { company, user, otherContext: newOtherContext },
    });

    unmount();
  });
});

function createSpySDK(): BucketInstance {
  return {
    getFeatureFlags: vi.fn(async () => ({})),
    init: vi.fn(),
    reset: vi.fn(),
    user: vi.fn(),
    company: vi.fn(),
    track: vi.fn(),
  } as any as BucketInstance;
}
