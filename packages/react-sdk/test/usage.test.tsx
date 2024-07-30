import React from "react";
import { render, renderHook, waitFor } from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
  beforeEach,
  beforeAll,
} from "vitest";

import {
  BucketProps,
  BucketProvider,
  useFlag,
  useFlagIsEnabled,
  useFlags,
  useUpdateContext,
} from "../src";

import { BucketClient } from "@bucketco/browser-sdk";

const originalConsoleError = console.error.bind(console);
afterEach(() => {
  console.error = originalConsoleError;
});

const publishableKey = Math.random().toString();
const company = { id: "123", name: "test" };
const user = { id: "456", name: "test" };
const otherContext = { test: "test" };

function getProvider(props: Partial<BucketProps> = {}) {
  return (
    <BucketProvider
      publishableKey={publishableKey}
      company={company}
      user={user}
      otherContext={otherContext}
      {...props}
    />
  );
}

const flags = {
  abc: true,
  def: true,
};

beforeAll(() => {
  vi.spyOn(BucketClient.prototype, "initialize").mockResolvedValue();
  vi.spyOn(BucketClient.prototype, "getFlags").mockReturnValue(flags);
  vi.spyOn(BucketClient.prototype, "stop");
  vi.spyOn(BucketClient.prototype, "user");
  vi.spyOn(BucketClient.prototype, "company");
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<BucketProvider />", () => {
  test("calls initialize", () => {
    const provider = getProvider();

    render(provider);

    expect(BucketClient.prototype.initialize).toHaveBeenCalledOnce();
    expect(BucketClient.prototype.stop).not.toHaveBeenCalledOnce();
  });

  test("only calls init once with the same args", () => {
    const node = getProvider();
    const initialize = vi.spyOn(BucketClient.prototype, "initialize");

    const x = render(node);
    x.rerender(node);
    x.rerender(node);
    x.rerender(node);

    expect(initialize).toHaveBeenCalledOnce();
    expect(BucketClient.prototype.stop).not.toHaveBeenCalledOnce();
  });
});

describe("useFlagIsEnabled", () => {
  test("returns the feature flags in context", async () => {
    const { result } = renderHook(() => useFlagIsEnabled("abc"), {
      wrapper: ({ children }) => getProvider({ children }),
    });

    await waitFor(() => expect(result.current).toStrictEqual(true));
    expect(result.current).toStrictEqual(true);
  });
});

describe("useFlags", () => {
  test("returns a loading state initially, stops loading once initialized", async () => {
    const { result, unmount } = renderHook(() => useFlags(), {
      wrapper: ({ children }) => getProvider({ children }),
    });

    await waitFor(() =>
      expect(result.current).toStrictEqual({ flags, isLoading: false }),
    );
    expect(result.current).toStrictEqual({ flags, isLoading: false });
    unmount();
  });
});

describe("useFlag", () => {
  test("returns a loading state initially, stops loading once initialized", async () => {
    console.error = vi.fn();

    const { result, unmount } = renderHook(() => useFlag("test-flag"), {
      wrapper: ({ children }) => getProvider({ children }),
    });

    expect(result.current).toStrictEqual({ isEnabled: false, isLoading: true });

    await waitFor(() =>
      expect(result.current).toStrictEqual({
        isEnabled: false,
        isLoading: false,
      }),
    );
    expect(result.current).toStrictEqual({
      isEnabled: false,
      isLoading: false,
    }),
      expect(console.error).not.toHaveBeenCalled();

    unmount();
  });
});

describe("useUpdateContext", () => {
  test("updates SDK when user is reset", async () => {
    console.error = vi.fn();

    const initialized = vi.mocked(BucketClient.prototype.initialize);
    const user = vi.mocked(BucketClient.prototype.user);
    const stop = vi.mocked(BucketClient.prototype.stop);
    expect(initialized).not.toHaveBeenCalled();
    const { result, unmount } = renderHook(() => useUpdateContext(), {
      wrapper: ({ children }) => getProvider({ children }),
    });

    expect(initialized).toHaveBeenCalledOnce();

    result.current.updateUser({
      id: "new-user",
      name: "new-user-name",
    });

    await waitFor(() => expect(stop).toHaveBeenCalled());
    expect(stop).toHaveBeenCalled();
    expect(user).toHaveBeenCalledTimes(2);
    expect(user).toHaveBeenCalledWith({
      name: "new-user-name",
    });
    expect(initialized).toHaveBeenCalledTimes(2);

    expect(console.error).not.toHaveBeenCalled();

    unmount();
  });

  test("updates SDK when company is updated", async () => {
    console.error = vi.fn();

    const initialized = vi.mocked(BucketClient.prototype.initialize);
    const company = vi.mocked(BucketClient.prototype.company);
    const stop = vi.mocked(BucketClient.prototype.stop);
    expect(initialized).not.toHaveBeenCalled();
    const { result, unmount } = renderHook(() => useUpdateContext(), {
      wrapper: ({ children }) => getProvider({ children }),
    });

    expect(initialized).toHaveBeenCalledOnce();

    result.current.updateCompany({
      id: "new-company",
      name: "new-company-name",
    });

    await waitFor(() => expect(stop).toHaveBeenCalled());
    expect(stop).toHaveBeenCalled();
    expect(company).toHaveBeenCalledTimes(2);
    expect(company).toHaveBeenCalledWith({
      name: "new-company-name",
    });
    expect(initialized).toHaveBeenCalledTimes(2);

    expect(console.error).not.toHaveBeenCalled();

    unmount();
  });

  test("updates SDK when other context is updated", async () => {
    console.error = vi.fn();

    const initialized = vi.mocked(BucketClient.prototype.initialize);
    const stop = vi.mocked(BucketClient.prototype.stop);
    expect(initialized).not.toHaveBeenCalled();
    const { result, unmount } = renderHook(() => useUpdateContext(), {
      wrapper: ({ children }) => getProvider({ children }),
    });

    expect(initialized).toHaveBeenCalledOnce();

    expect(stop).not.toHaveBeenCalled();

    const newOtherContext = { happeningId: "new-conference" };
    result.current.updateOtherContext(newOtherContext);

    await waitFor(() => expect(stop).toHaveBeenCalled());

    expect(stop).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();

    await waitFor(() => result.current.isLoading === false);

    unmount();
  });
});
