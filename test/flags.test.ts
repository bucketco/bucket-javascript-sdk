import { fail } from "assert";
import fetch from "cross-fetch";
import { beforeAll, describe, expect, test, vi } from "vitest";

import { FeatureFlagsResponse, getFlags } from "../src/flags";

vi.mock("cross-fetch", () => {
  return {
    default: vi.fn(),
  };
});

const flagsResponse: FeatureFlagsResponse = {
  success: true,
  flags: {
    featureA: { value: true, key: "featureA" },
  },
};

describe("getFlags unit tests", () => {
  beforeAll(() => {
    vi.mocked(fetch).mockResolvedValue({
      status: 200,
      ok: true,
      json: function () {
        return Promise.resolve(flagsResponse);
      },
    } as Response);
  });

  test("fetches flags", async () => {
    const flags = await getFlags({
      apiBaseUrl: "https://localhost",
      context: { user: { id: "123" } },
      includeFlags: [{ value: true, key: "featureB" }],
      timeoutMs: 1000,
    });

    expect(flags).toEqual({
      featureA: { value: true, key: "featureA" },
      featureB: { value: true, key: "featureB" },
    });
  });

  test("does not handle request failure", async () => {
    const err = new Error("Request failed");
    vi.mocked(fetch).mockRejectedValue(err);

    try {
      await getFlags({
        apiBaseUrl: "https://localhost",
        context: { user: { id: "123" } },
        includeFlags: [{ value: true, key: "featureB" }],
        timeoutMs: 1000,
      });
      fail("Expected an error");
    } catch (e) {
      expect(e).toBe(err);
    }
  });
});
