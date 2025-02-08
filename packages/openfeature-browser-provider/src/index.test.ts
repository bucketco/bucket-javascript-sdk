import { Client, OpenFeature } from "@openfeature/web-sdk";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";

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
    stop: vi.fn(),
  };

  const newBucketClient = BucketClient as Mock;
  newBucketClient.mockReturnValue(bucketClientMock);

  beforeEach(async () => {
    await OpenFeature.clearProviders();

    provider = new BucketBrowserSDKProvider({ publishableKey });
    OpenFeature.setProvider(provider);
    ofClient = OpenFeature.getClient();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const contextTranslatorFn = vi.fn();

  describe("lifecycle", () => {
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

    it("should call stop function when provider is closed", async () => {
      await OpenFeature.clearProviders();
      expect(bucketClientMock.stop).toHaveBeenCalledTimes(1);
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
    beforeEach(async () => {
      await provider.initialize();
    });

    function mockFeature(
      enabled: boolean,
      configKey?: string | null,
      configPayload?: any,
    ) {
      const config = {
        key: configKey,
        payload: configPayload,
      };

      bucketClientMock.getFeature = vi.fn().mockReturnValue({
        isEnabled: enabled,
        config,
      });

      bucketClientMock.getFeatures = vi.fn().mockReturnValue({
        [testFlagKey]: {
          isEnabled: enabled,
          config: {
            key: "key",
            payload: configPayload,
          },
        },
      });
    }

    it("returns error if provider is not initialized", async () => {
      await OpenFeature.clearProviders();

      const val = ofClient.getBooleanDetails(testFlagKey, true);

      expect(val).toMatchObject({
        flagKey: testFlagKey,
        flagMetadata: {},
        reason: "ERROR",
        errorCode: "PROVIDER_NOT_READY",
        value: true,
      });
    });

    it("returns error if flag is not found", async () => {
      mockFeature(true, "key", true);
      const val = ofClient.getBooleanDetails("missing-key", true);

      expect(val).toMatchObject({
        flagKey: "missing-key",
        flagMetadata: {},
        reason: "ERROR",
        errorCode: "FLAG_NOT_FOUND",
        value: true,
      });
    });

    it("calls the client correctly when evaluating", async () => {
      mockFeature(true, "key", true);

      const val = ofClient.getBooleanDetails(testFlagKey, false);

      expect(val).toMatchObject({
        flagKey: testFlagKey,
        flagMetadata: {},
        reason: "TARGETING_MATCH",
        value: true,
      });

      expect(bucketClientMock.getFeatures).toHaveBeenCalled();
      expect(bucketClientMock.getFeature).toHaveBeenCalledWith(testFlagKey);
    });

    it.each([
      [true, false, true, "TARGETING_MATCH", undefined],
      [null, true, true, "ERROR", "FLAG_NOT_FOUND"],
      [null, false, false, "ERROR", "FLAG_NOT_FOUND"],
    ])(
      "should return the correct result when evaluating boolean. enabled: %s, value: %s, default: %s, expected: %s, reason: %s, errorCode: %s`",
      (enabled, def, expected, reason, errorCode) => {
        mockFeature(enabled ?? false);
        const flagKey = enabled ? testFlagKey : "missing-key";

        expect(ofClient.getBooleanDetails(flagKey, def)).toMatchObject({
          flagKey,
          flagMetadata: {},
          reason,
          value: expected,
          ...(errorCode ? { errorCode } : {}),
        });
      },
    );

    it("should return error when evaluating number", async () => {
      expect(ofClient.getNumberDetails(testFlagKey, 1)).toMatchObject({
        flagKey: testFlagKey,
        flagMetadata: {},
        reason: "ERROR",
        errorCode: "GENERAL",
        value: 1,
      });
    });

    it.each([
      ["key-1", "default", "key-1", "TARGETING_MATCH"],
      [null, "default", "default", "DEFAULT"],
      [undefined, "default", "default", "DEFAULT"],
    ])(
      "should return the correct result when evaluating string. configKey: %s, def: %s, expected: %s, reason: %s, errorCode: %s`",
      (configKey, def, expected, reason) => {
        mockFeature(true, configKey, {});
        expect(ofClient.getStringDetails(testFlagKey, def)).toMatchObject({
          flagKey: testFlagKey,
          flagMetadata: {},
          reason,
          value: expected,
        });
      },
    );

    it.each([
      [{}, { a: 1 }, {}, "TARGETING_MATCH", undefined],
      ["string", "default", "string", "TARGETING_MATCH", undefined],
      [15, -15, 15, "TARGETING_MATCH", undefined],
      [true, false, true, "TARGETING_MATCH", undefined],
      [null, { a: 2 }, { a: 2 }, "ERROR", "TYPE_MISMATCH"],
      [100, "string", "string", "ERROR", "TYPE_MISMATCH"],
      [true, 1337, 1337, "ERROR", "TYPE_MISMATCH"],
      ["string", 1337, 1337, "ERROR", "TYPE_MISMATCH"],
    ])(
      "should return the correct result when evaluating object. payload: %s, default: %s, expected: %s, reason: %s, errorCode: %s`",
      (value, def, expected, reason, errorCode) => {
        mockFeature(true, "config-key", value);
        expect(ofClient.getObjectDetails(testFlagKey, def)).toMatchObject({
          flagKey: testFlagKey,
          flagMetadata: {},
          reason,
          value: expected,
          ...(errorCode ? { errorCode } : {}),
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
