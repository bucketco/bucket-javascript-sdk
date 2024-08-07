import React from "react";
import { render, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import { BucketClient } from "@bucketco/browser-sdk";
import { HttpClient } from "@bucketco/browser-sdk/src/httpClient";

import {
  BucketProps,
  BucketProvider,
  useFeature,
  useFeatureIsEnabled,
  useFeatures,
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

const server = setupServer(
  http.get(/\/flags\/evaluate$/, () => {
    return new HttpResponse(
      JSON.stringify({
        success: true,
        flags: {
          abc: {
            key: "abc",
            value: true,
            version: 1,
          },
          def: {
            key: "def",
            value: true,
            version: 2,
          },
        },
      }),
      { status: 200 },
    );
  }),
  http.post(/\/user$/, () => {
    return new HttpResponse(
      JSON.stringify({
        success: true,
      }),
      { status: 200 },
    );
  }),
  http.post(/\/company$/, () => {
    return new HttpResponse(
      JSON.stringify({
        success: true,
      }),
      { status: 200 },
    );
  }),
  http.post(/feedback\/prompting-init$/, () => {
    return new HttpResponse(
      JSON.stringify({
        success: false,
      }),
      { status: 200 },
    );
  }),
  http.post(/\/flags\/events$/, () => {
    return new HttpResponse(
      JSON.stringify({
        success: false,
      }),
      { status: 200 },
    );
  }),
);

beforeAll(() =>
  server.listen({
    onUnhandledRequest(request) {
      console.error("Unhandled %s %s", request.method, request.url);
    },
  }),
);
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const flags = {
  abc: true,
  def: true,
};

beforeAll(() => {
  vi.spyOn(BucketClient.prototype, "initialize");
  vi.spyOn(BucketClient.prototype, "getFeatures");
  vi.spyOn(BucketClient.prototype, "stop");
  vi.spyOn(BucketClient.prototype, "user");
  vi.spyOn(BucketClient.prototype, "company");

  vi.spyOn(HttpClient.prototype, "get");
  vi.spyOn(HttpClient.prototype, "post");
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<BucketProvider />", () => {
  test("calls initialize", () => {
    const newBucketClient = vi.fn().mockReturnValue({
      initialize: vi.fn().mockResolvedValue(undefined),
    });

    const provider = getProvider({
      publishableKey: "KEY",
      host: "https://test.com",
      sseHost: "https://test.com",
      company: { id: "123", name: "test" },
      user: { id: "456", name: "test" },
      otherContext: { test: "test" },
      newBucketClient,
    });

    render(provider);

    expect(newBucketClient.mock.calls.at(0)).toStrictEqual([
      "KEY",
      {
        user: {
          id: "456",
          name: "test",
        },
        company: {
          id: "123",
          name: "test",
        },
        otherContext: {
          test: "test",
        },
      },
      {
        host: "https://test.com",
        logger: undefined,
        sseHost: "https://test.com",
        feedback: undefined,
        flags: {},
        sdkVersion: "react-sdk/1.0.0-beta.1",
      },
    ]);
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

describe("useFeatureIsEnabled", () => {
  test("returns the feature flags in context", async () => {
    const { result } = renderHook(() => useFeatureIsEnabled("abc"), {
      wrapper: ({ children }) => getProvider({ children }),
    });

    await waitFor(() => expect(result.current).toStrictEqual(true));
    expect(result.current).toStrictEqual(true);
  });
});

describe("useFeatures", () => {
  test("returns a loading state initially, stops loading once initialized", async () => {
    const { result, unmount } = renderHook(() => useFeatures(), {
      wrapper: ({ children }) => getProvider({ children }),
    });

    await waitFor(() =>
      expect(JSON.stringify(result.current)).toEqual(
        JSON.stringify({ isLoading: false, flags }),
      ),
    );

    unmount();
  });
});

describe("useFeature", () => {
  test("returns a loading state initially, stops loading once initialized", async () => {
    const { result, unmount } = renderHook(() => useFeature("test-flag"), {
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
      unmount();
  });
});

describe("useUpdateContext", () => {
  test("updates SDK when user is reset", async () => {
    console.error = vi.fn();

    const initialized = vi.mocked(BucketClient.prototype.initialize);
    const mockedUser = vi.mocked(BucketClient.prototype.user);
    const mockedStop = vi.mocked(BucketClient.prototype.stop);
    expect(initialized).not.toHaveBeenCalled();
    const { result, unmount } = renderHook(() => useUpdateContext(), {
      wrapper: ({ children }) => getProvider({ children }),
    });

    expect(initialized).toHaveBeenCalledOnce();

    result.current.updateUser({
      id: "new-user",
      name: "new-user-name",
    });

    await waitFor(() => expect(mockedStop).toHaveBeenCalled());
    expect(mockedStop).toHaveBeenCalled();
    expect(mockedUser).toHaveBeenCalledTimes(2);
    expect(mockedUser).toHaveBeenCalledWith({
      name: "new-user-name",
    });
    expect(initialized).toHaveBeenCalledTimes(2);

    expect(console.error).not.toHaveBeenCalled();

    unmount();
  });

  test("updates SDK when company is updated", async () => {
    console.error = vi.fn();

    expect(BucketClient.prototype.initialize).not.toHaveBeenCalled();
    const { result, unmount } = renderHook(() => useUpdateContext(), {
      wrapper: ({ children }) => getProvider({ children }),
    });

    expect(BucketClient.prototype.initialize).toHaveBeenCalledOnce();
    expect(BucketClient.prototype.stop).not.toHaveBeenCalled();
    result.current.updateCompany({
      id: "new-company1",
      name: "new-company-name",
    });

    // due to our use of useEffect, stop actually gets called twice
    await waitFor(() => expect(BucketClient.prototype.stop).toHaveBeenCalled());

    await waitFor(() =>
      expect(
        vi.mocked(BucketClient.prototype.initialize),
      ).toHaveBeenCalledTimes(2),
    );

    await waitFor(() =>
      expect(vi.mocked(BucketClient.prototype.company)).toHaveBeenCalledTimes(
        2,
      ),
    );
    expect(BucketClient.prototype.company).toHaveBeenCalledTimes(2);
    expect(BucketClient.prototype.company).toHaveBeenCalledWith({
      name: "new-company-name",
    });
    expect(BucketClient.prototype.initialize).toHaveBeenCalledTimes(2);

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
