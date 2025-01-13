import { Client, OpenFeature } from "@openfeature/web-sdk";
import { beforeAll, beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { BucketClient } from "@bucketco/browser-sdk";

import { BucketBrowserSDKProvider } from ".";

vi.mock("@bucketco/browser-sdk", () => {
  const actualModule = vi.importActual("@bucketco/browser-sdk");

  return {
    __esModule: true,
    ...actualModule,
    BucketClient: vi.fn(),
  };
});

const testFlagKey = "a-key";

const publishableKey = "your-publishable-key";

describe("BucketBrowserSDKProvider", () => {
  let provider: BucketBrowserSDKProvider;
  let ofClient: Client;
  const bucketClientMock = {
    getFeatures: vi.fn(),
    getFeature: vi.fn(),
    initialize: vi.fn().mockResolvedValue({}),
    track: vi.fn(),
  };

  const newBucketClient = BucketClient as Mock;
  newBucketClient.mockReturnValue(bucketClientMock);

  beforeAll(() => {
    provider = new BucketBrowserSDKProvider({ publishableKey });
    OpenFeature.setProvider(provider);
    ofClient = OpenFeature.getClient();
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const contextTranslatorFn = vi.fn();

  describe("initialize", () => {
    it("should call initialize function with correct arguments", async () => {
      await provider.initialize();
      expect(BucketClient).toHaveBeenCalledTimes(1);
      expect(BucketClient).toHaveBeenCalledWith({
        publishableKey,
      });
      expect(bucketClientMock.initialize).toHaveBeenCalledTimes(1);
    });

    it("should set the status to READY if initialization succeeds", async () => {
      bucketClientMock.initialize.mockReturnValue(Promise.resolve());
      await provider.initialize();
      expect(bucketClientMock.initialize).toHaveBeenCalledTimes(1);
      expect(provider.status).toBe("READY");
    });
  });

  describe("contextTranslator", () => {
    it("uses contextTranslatorFn if provided", async () => {
      const ofContext = {
        userId: "123",
        email: "ron@bucket.co",
        groupId: "456",
        groupName: "bucket",
      };

      const bucketContext = {
        user: { id: "123", name: "John Doe", email: "john@acme.com" },
        company: { id: "456", name: "Acme, Inc." },
      };

      contextTranslatorFn.mockReturnValue(bucketContext);
      provider = new BucketBrowserSDKProvider({
        publishableKey,
        contextTranslator: contextTranslatorFn,
      });
      await provider.initialize(ofContext);
      expect(contextTranslatorFn).toHaveBeenCalledWith(ofContext);
      expect(newBucketClient).toHaveBeenCalledWith({
        publishableKey,
        ...bucketContext,
      });
    });
  });

  describe("resolveBooleanEvaluation", () => {
    function mockFeature(enabled: boolean, config: any) {
      bucketClientMock.getFeature = vi.fn().mockReturnValue({
        isEnabled: enabled,
        config: config,
      });

      bucketClientMock.getFeatures = vi.fn().mockReturnValue({
        [testFlagKey]: {
          isEnabled: enabled,
          config: {
            name: "test",
            version: 1,
            payload: config,
          },
          targetingVersion: 1,
        },
      });
    }

    it("calls the client correctly when evaluating", async () => {
      mockFeature(true, true);
      await provider.initialize();

      const val = ofClient.getBooleanDetails(testFlagKey, false);

      expect(val).toBeDefined();

      expect(bucketClientMock.getFeatures).toHaveBeenCalled();
      expect(bucketClientMock.getFeature).toHaveBeenCalledWith(testFlagKey);
    });

    it.each([
      [true, true, false, true, "TARGETING_MATCH"],
      [true, false, false, true, "TARGETING_MATCH"],
      [true, null, false, true, "TARGETING_MATCH"],
      [true, { obj: true }, false, true, "TARGETING_MATCH"],
      [true, 15, false, true, "TARGETING_MATCH"],
      [false, true, false, false, "DISABLED"],
      [false, true, true, true, "DISABLED"],
    ])(
      "should return the correct result when evaluating boolean %s, %s, %s, %s, %s`",
      async (enabled, config, def, expected, reason) => {
        mockFeature(enabled, config);
        expect(ofClient.getBooleanDetails(testFlagKey, def)).toEqual({
          flagKey: "a-key",
          flagMetadata: {},
          reason: reason,
          value: expected,
        });
      },
    );

    it.each([
      [true, 1, -1, 1, "TARGETING_MATCH"],
      [true, null, -2, -2, "DEFAULT"],
      [false, 3, -3, -3, "DISABLED"],
      [false, 4, -4, -4, "DISABLED"],
    ])(
      "should return the correct result when evaluating number %s, %s, %s, %s, %s`",
      async (enabled, config, def, expected, reason) => {
        mockFeature(enabled, config);
        expect(ofClient.getNumberDetails(testFlagKey, def)).toEqual({
          flagKey: "a-key",
          flagMetadata: {},
          reason: reason,
          value: expected,
        });
      },
    );

    it.each([["string"], [true], [{}]])(
      "should handle type mismatch when evaluating number as %s`",
      async (config) => {
        mockFeature(true, config);
        expect(ofClient.getNumberDetails(testFlagKey, -1)).toEqual({
          flagKey: "a-key",
          flagMetadata: {},
          reason: "ERROR",
          errorCode: "TYPE_MISMATCH",
          errorMessage: "",
          value: -1,
        });
      },
    );

    it.each([
      [true, "1", "-1", "1", "TARGETING_MATCH"],
      [true, null, "-2", "-2", "DEFAULT"],
      [false, "2", "-3", "-3", "DISABLED"],
      [false, "3", "-4", "-4", "DISABLED"],
    ])(
      "should return the correct result when evaluating string %s, %s, %s, %s, %s`",
      async (enabled, config, def, expected, reason) => {
        mockFeature(enabled, config);
        expect(ofClient.getStringDetails(testFlagKey, def)).toEqual({
          flagKey: "a-key",
          flagMetadata: {},
          reason: reason,
          value: expected,
        });
      },
    );

    it.each([[15], [true], [{}]])(
      "should handle type mismatch when evaluating string as %s`",
      async (config) => {
        mockFeature(true, config);
        expect(ofClient.getStringDetails(testFlagKey, "hello")).toEqual({
          flagKey: "a-key",
          flagMetadata: {},
          reason: "ERROR",
          errorCode: "TYPE_MISMATCH",
          errorMessage: "",
          value: "hello",
        });
      },
    );

    it.each([
      [true, [], [1], [], "TARGETING_MATCH"],
      [true, null, [2], [2], "DEFAULT"],
      [false, [3], [4], [4], "DISABLED"],
      [false, [5], [6], [6], "DISABLED"],
    ])(
      "should return the correct result when evaluating array %s, %s, %s, %s, %s`",
      async (enabled, config, def, expected, reason) => {
        mockFeature(enabled, config);
        expect(ofClient.getObjectDetails(testFlagKey, def)).toEqual({
          flagKey: "a-key",
          flagMetadata: {},
          reason: reason,
          value: expected,
        });
      },
    );

    it.each([
      [true, {}, { a: 1 }, {}, "TARGETING_MATCH"],
      [true, null, { a: 2 }, { a: 2 }, "DEFAULT"],
      [false, { a: 3 }, { a: 4 }, { a: 4 }, "DISABLED"],
      [false, { a: 5 }, { a: 6 }, { a: 6 }, "DISABLED"],
    ])(
      "should return the correct result when evaluating object %s, %s, %s, %s, %s`",
      async (enabled, config, def, expected, reason) => {
        mockFeature(enabled, config);
        expect(ofClient.getObjectDetails(testFlagKey, def)).toEqual({
          flagKey: "a-key",
          flagMetadata: {},
          reason: reason,
          value: expected,
        });
      },
    );

    it.each([["string"], [15], [true]])(
      "should handle type mismatch when evaluating object as %s`",
      async (config) => {
        mockFeature(true, config);
        expect(ofClient.getObjectDetails(testFlagKey, { obj: true })).toEqual({
          flagKey: "a-key",
          flagMetadata: {},
          reason: "ERROR",
          errorCode: "TYPE_MISMATCH",
          errorMessage: "",
          value: { obj: true },
        });
      },
    );
  });

  describe("track", () => {
    it("calls the client correctly for track calls", async () => {
      const testEvent = "testEvent";
      await provider.initialize();

      ofClient.track(testEvent, { key: "value" });
      expect(bucketClientMock.track).toHaveBeenCalled();
      expect(bucketClientMock.track).toHaveBeenCalledWith(testEvent, {
        key: "value",
      });
    });
  });

  describe("onContextChange", () => {
    it("re-initialize client", async () => {
      const p = new BucketBrowserSDKProvider({ publishableKey });
      expect(p["_client"]).toBeUndefined();
      expect(newBucketClient).toHaveBeenCalledTimes(0);

      await p.onContextChange({}, {});
      expect(newBucketClient).toHaveBeenCalledTimes(1);
      expect(p["_client"]).toBeDefined();
    });
  });
});
