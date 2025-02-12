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

import { version } from "../package.json";
import {
  BucketProps,
  BucketProvider,
  useFeature,
  useRequestFeedback,
  useSendFeedback,
  useTrack,
  useUpdateCompany,
  useUpdateOtherContext,
  useUpdateUser,
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
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<BucketProvider />", () => {
  test("calls initialize", () => {
    const onFeaturesUpdated = vi.fn();

    const newBucketClient = vi.fn().mockReturnValue({
      initialize: vi.fn().mockResolvedValue(undefined),
      onFeaturesUpdated,
    });

    const provider = getProvider({
      publishableKey: "KEY",
      apiBaseUrl: "https://test.com",
      sseBaseUrl: "https://test.com",
      company: { id: "123", name: "test" },
      user: { id: "456", name: "test" },
      otherContext: { test: "test" },
      enableTracking: false,
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
        apiBaseUrl: "https://test.com",
        host: undefined,
        logger: undefined,
        sseBaseUrl: "https://test.com",
        sseHost: undefined,
        enableTracking: false,
        feedback: undefined,
        features: {},
        sdkVersion: `react-sdk/${version}`,
      },
    ]);

    expect(onFeaturesUpdated).toBeTruthy();
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

describe("useFeature", () => {
  test("returns a loading state initially", async () => {
    const { result, unmount } = renderHook(() => useFeature("huddle"), {
      wrapper: ({ children }) => getProvider({ children }),
    });

    expect(result.current).toStrictEqual({
      isEnabled: false,
      isLoading: true,
      track: expect.any(Function),
      requestFeedback: expect.any(Function),
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
        requestFeedback: expect.any(Function),
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

describe("useUpdateUser", () => {
  test("updates user", async () => {
    const updateUser = vi
      .spyOn(BucketClient.prototype, "updateUser")
      .mockResolvedValue(undefined);

    const { result: updateUserFn, unmount } = renderHook(
      () => useUpdateUser(),
      {
        wrapper: ({ children }) => getProvider({ children }),
      },
    );

    // todo: need this `waitFor` because useUpdateOtherContext
    // runs before `client` is initialized and then the call gets
    // lost.
    await waitFor(async () => {
      await updateUserFn.current({ optInHuddles: "true" });

      expect(updateUser).toHaveBeenCalledWith({
        optInHuddles: "true",
      });
    });

    unmount();
  });
});

describe("useUpdateCompany", () => {
  test("updates company", async () => {
    const updateCompany = vi
      .spyOn(BucketClient.prototype, "updateCompany")
      .mockResolvedValue(undefined);

    const { result: updateCompanyFn, unmount } = renderHook(
      () => useUpdateCompany(),
      {
        wrapper: ({ children }) => getProvider({ children }),
      },
    );

    // todo: need this `waitFor` because useUpdateOtherContext
    // runs before `client` is initialized and then the call gets
    // lost.
    await waitFor(async () => {
      await updateCompanyFn.current({ optInHuddles: "true" });

      expect(updateCompany).toHaveBeenCalledWith({
        optInHuddles: "true",
      });
    });
    unmount();
  });
});

describe("useUpdateOtherContext", () => {
  test("updates other context", async () => {
    const updateOtherContext = vi
      .spyOn(BucketClient.prototype, "updateOtherContext")
      .mockResolvedValue(undefined);

    const { result: updateOtherContextFn, unmount } = renderHook(
      () => useUpdateOtherContext(),
      {
        wrapper: ({ children }) => getProvider({ children }),
      },
    );

    // todo: need this `waitFor` because useUpdateOtherContext
    // runs before `client` is initialized and then the call gets
    // lost.
    await waitFor(async () => {
      await updateOtherContextFn.current({ optInHuddles: "true" });

      expect(updateOtherContext).toHaveBeenCalledWith({
        optInHuddles: "true",
      });
    });

    unmount();
  });
});
