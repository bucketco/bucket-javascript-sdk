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

import { version } from "../package.json";
import {
  BucketProps,
  BucketProvider,
  useFeature,
  useRequestFeedback,
  useSendFeedback,
  useTrack,
} from "../src";

const events: string[] = [];
const originalConsoleError = console.error.bind(console);

afterEach(() => {
  events.length = 0;
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
  http.post(/\/event$/, () => {
    events.push("EVENT");
    return new HttpResponse(
      JSON.stringify({
        success: true,
      }),
      { status: 200 },
    );
  }),
  http.post(/\/feedback$/, () => {
    events.push("FEEDBACK");
    return new HttpResponse(
      JSON.stringify({
        success: true,
      }),
      { status: 200 },
    );
  }),
  http.get(/\/features\/enabled$/, () => {
    return new HttpResponse(
      JSON.stringify({
        success: true,
        features: {
          abc: {
            key: "abc",
            isEnabled: true,
            targetingVersion: 1,
          },
          def: {
            key: "def",
            isEnabled: true,
            targetingVersion: 2,
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
  http.post(/\/features\/events$/, () => {
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

beforeAll(() => {
  vi.spyOn(BucketClient.prototype, "initialize");
  vi.spyOn(BucketClient.prototype, "stop");

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
      impersonating: true,
      newBucketClient,
    });

    render(provider);

    expect(newBucketClient.mock.calls.at(0)).toStrictEqual([
      {
        publishableKey: "KEY",
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
        host: "https://test.com",
        logger: undefined,
        sseHost: "https://test.com",
        impersonating: true,
        feedback: undefined,
        features: {},
        sdkVersion: `react-sdk/${version}`,
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

  test("calls stop on unmount", () => {
    const node = getProvider();
    const initialize = vi.spyOn(BucketClient.prototype, "initialize");

    const x = render(node);
    x.rerender(node);
    x.rerender(node);
    x.rerender(node);

    expect(initialize).toHaveBeenCalledOnce();
    expect(BucketClient.prototype.stop).not.toHaveBeenCalledOnce();

    x.unmount();

    expect(BucketClient.prototype.stop).toHaveBeenCalledOnce();
  });
});

describe("useFeature", () => {
  test("returns a loading state initially", async () => {
    let resolve: (r: BucketClient) => void;
    const { result, unmount } = renderHook(() => useFeature("huddle"), {
      wrapper: ({ children }) =>
        getProvider({ children, onInitialized: resolve }),
    });

    expect(result.current).toStrictEqual({
      isEnabled: false,
      isLoading: true,
      track: expect.any(Function),
    });

    unmount();
  });

  test("finishes loading", async () => {
    const { result, unmount } = renderHook(() => useFeature("huddle"), {
      wrapper: ({ children }) => getProvider({ children }),
    });

    await waitFor(() => {
      expect(result.current).toStrictEqual({
        isEnabled: false,
        isLoading: false,
        track: expect.any(Function),
      });
    });

    unmount();
  });
});

describe("useTrack", () => {
  test("sends track request", async () => {
    const { result, unmount } = renderHook(() => useTrack(), {
      wrapper: ({ children }) => getProvider({ children }),
    });

    await waitFor(async () => {
      await result.current("event", { test: "test" });
      expect(events).toStrictEqual(["EVENT"]);
    });

    unmount();
  });
});

describe("useSendFeedback", () => {
  test("sends feedback", async () => {
    const { result, unmount } = renderHook(() => useSendFeedback(), {
      wrapper: ({ children }) => getProvider({ children }),
    });

    await waitFor(async () => {
      await result.current({
        featureId: "123",
        score: 5,
      });
      expect(events).toStrictEqual(["FEEDBACK"]);
    });

    unmount();
  });
});

describe("useRequestFeedback", () => {
  test("sends feedback", async () => {
    const requestFeedback = vi
      .spyOn(BucketClient.prototype, "requestFeedback")
      .mockReturnValue(undefined);

    const { result, unmount } = renderHook(() => useRequestFeedback(), {
      wrapper: ({ children }) => getProvider({ children }),
    });

    await waitFor(async () => {
      result.current({
        featureId: "123",
        title: "Test question",
        companyId: "456",
      });

      expect(requestFeedback).toHaveBeenCalledOnce();
      expect(requestFeedback).toHaveBeenCalledWith({
        companyId: "456",
        featureId: "123",
        title: "Test question",
      });
    });

    unmount();
  });
});
