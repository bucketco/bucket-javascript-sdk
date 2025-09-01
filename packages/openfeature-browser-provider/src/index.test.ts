import { Client, OpenFeature } from "@openfeature/web-sdk";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { ReflagClient } from "@reflag/browser-sdk";

import { defaultContextTranslator, ReflagBrowserSDKProvider } from ".";

vi.mock("@reflag/browser-sdk", () => {
  const actualModule = vi.importActual("@reflag/browser-sdk");

  return {
    __esModule: true,
    ...actualModule,
    ReflagClient: vi.fn(),
  };
});

const testFlagKey = "a-key";

const publishableKey = "your-publishable-key";

describe("ReflagBrowserSDKProvider", () => {
  let provider: ReflagBrowserSDKProvider;
  let ofClient: Client;

  const reflagClientMock = {
    getFlags: vi.fn(),
    getFlag: vi.fn(),
    initialize: vi.fn().mockResolvedValue({}),
    track: vi.fn(),
    stop: vi.fn(),
  };

  const mockReflagClient = ReflagClient as Mock;
  mockReflagClient.mockReturnValue(reflagClientMock);

  beforeEach(async () => {
    await OpenFeature.clearProviders();

    provider = new ReflagBrowserSDKProvider({ publishableKey });
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
      expect(ReflagClient).toHaveBeenCalledTimes(1);
      expect(ReflagClient).toHaveBeenCalledWith({
        publishableKey,
      });
      expect(reflagClientMock.initialize).toHaveBeenCalledTimes(1);
    });

    it("should set the status to READY if initialization succeeds", async () => {
      reflagClientMock.initialize.mockReturnValue(Promise.resolve());
      await provider.initialize();
      expect(reflagClientMock.initialize).toHaveBeenCalledTimes(1);
      expect(provider.status).toBe("READY");
    });

    it("should call stop function when provider is closed", async () => {
      await OpenFeature.clearProviders();
      expect(reflagClientMock.stop).toHaveBeenCalledTimes(1);
    });

    it("onContextChange re-initializes client", async () => {
      const p = new ReflagBrowserSDKProvider({ publishableKey });
      expect(p["_client"]).toBeUndefined();
      expect(mockReflagClient).toHaveBeenCalledTimes(0);

      await p.onContextChange({}, {});
      expect(mockReflagClient).toHaveBeenCalledTimes(1);
      expect(p["_client"]).toBeDefined();
    });
  });

  describe("contextTranslator", () => {
    it("uses contextTranslatorFn if provided", async () => {
      const ofContext = {
        userId: "123",
        email: "ron@reflag.co",
        avatar: "https://reflag.co/avatar.png",
        groupId: "456",
        groupName: "reflag",
        groupAvatar: "https://reflag.co/group-avatar.png",
        groupPlan: "pro",
      };

      const reflagContext = {
        user: {
          id: "123",
          name: "John Doe",
          email: "john@acme.com",
          avatar: "https://acme.com/avatar.png",
        },
        company: {
          id: "456",
          name: "Acme, Inc.",
          plan: "pro",
          avatar: "https://acme.com/company-avatar.png",
        },
      };

      contextTranslatorFn.mockReturnValue(reflagContext);
      provider = new ReflagBrowserSDKProvider({
        publishableKey,
        contextTranslator: contextTranslatorFn,
      });

      await provider.initialize(ofContext);

      expect(contextTranslatorFn).toHaveBeenCalledWith(ofContext);
      expect(mockReflagClient).toHaveBeenCalledWith({
        publishableKey,
        ...reflagContext,
      });
    });

    it("defaultContextTranslator provides the correct context", async () => {
      expect(
        defaultContextTranslator({
          userId: 123,
          name: "John Doe",
          email: "ron@reflag.co",
          avatar: "https://reflag.co/avatar.png",
          companyId: "456",
          companyName: "Acme, Inc.",
          companyAvatar: "https://acme.com/company-avatar.png",
          companyPlan: "pro",
        }),
      ).toEqual({
        user: {
          id: "123",
          name: "John Doe",
          email: "ron@reflag.co",
          avatar: "https://reflag.co/avatar.png",
        },
        company: {
          id: "456",
          name: "Acme, Inc.",
          plan: "pro",
          avatar: "https://acme.com/company-avatar.png",
        },
      });
    });

    it("defaultContextTranslator uses targetingKey if provided", async () => {
      expect(
        defaultContextTranslator({
          targetingKey: "123",
        }),
      ).toMatchObject({
        user: {
          id: "123",
        },
        company: {
          id: undefined,
        },
      });
    });
  });

  describe("resolving flags", () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    function mockBooleanFlag(enabled: boolean) {
      reflagClientMock.getFlag = vi.fn().mockReturnValue(enabled);
      reflagClientMock.getFlags = vi.fn().mockReturnValue({
        [testFlagKey]: {
          isEnabled: enabled,
        },
      });
    }

    function mockMultiVariantFlag(key: string, payload: any) {
      const config = {
        key,
        payload,
      };

      reflagClientMock.getFlag = vi.fn().mockReturnValue(config);
      reflagClientMock.getFlags = vi.fn().mockReturnValue({
        [testFlagKey]: {
          isEnabled: true,
          config,
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
      mockBooleanFlag(false);

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
      mockBooleanFlag(true);

      const val = ofClient.getBooleanDetails(testFlagKey, false);

      expect(val).toMatchObject({
        flagKey: testFlagKey,
        flagMetadata: {},
        reason: "TARGETING_MATCH",
        value: true,
      });

      expect(reflagClientMock.getFlags).toHaveBeenCalled();
      expect(reflagClientMock.getFlag).toHaveBeenCalledWith(testFlagKey);
    });

    it("should return error when evaluating number", async () => {
      expect(ofClient.getNumberDetails(testFlagKey, 1)).toMatchObject({
        flagKey: testFlagKey,
        flagMetadata: {},
        reason: "ERROR",
        errorCode: "GENERAL",
        value: 1,
      });
    });

    describe("boolean", () => {
      it.each([
        [true, false, true, "TARGETING_MATCH", undefined],
        [false, true, true, "ERROR", "FLAG_NOT_FOUND"],
        [false, false, false, "ERROR", "FLAG_NOT_FOUND"],
      ])(
        "should return the correct result when evaluating boolean. enabled: %s, value: %s, default: %s, expected: %s, reason: %s, errorCode: %s`",
        (enabled, def, expected, reason, errorCode) => {
          const flagKey = enabled ? testFlagKey : "missing-key";

          mockBooleanFlag(enabled);

          expect(ofClient.getBooleanDetails(flagKey, def)).toMatchObject({
            flagKey,
            flagMetadata: {},
            reason,
            value: expected,
            ...(errorCode ? { errorCode } : {}),
          });
        },
      );

      it("should return error when evaluating string", async () => {
        mockBooleanFlag(true);

        expect(ofClient.getStringDetails(testFlagKey, "a")).toMatchObject({
          flagKey: testFlagKey,
          flagMetadata: {},
          reason: "ERROR",
          errorCode: "TYPE_MISMATCH",
          value: "a",
        });
      });

      it("should return error when evaluating object", async () => {
        mockBooleanFlag(true);

        expect(ofClient.getObjectDetails(testFlagKey, { a: 1 })).toMatchObject({
          flagKey: testFlagKey,
          flagMetadata: {},
          reason: "ERROR",
          errorCode: "TYPE_MISMATCH",
          value: { a: 1 },
        });
      });
    });

    describe("multi-variant", () => {
      it("should return error when evaluating boolean", async () => {
        mockMultiVariantFlag("key", { a: 1 });

        expect(ofClient.getBooleanDetails(testFlagKey, true)).toMatchObject({
          flagKey: testFlagKey,
          flagMetadata: {},
          reason: "ERROR",
          errorCode: "TYPE_MISMATCH",
          value: true,
        });
      });

      it("should return the correct result when evaluating string", () => {
        mockMultiVariantFlag("key", { a: 1 });
        expect(ofClient.getStringDetails(testFlagKey, "default")).toMatchObject(
          {
            flagKey: testFlagKey,
            flagMetadata: {},
            reason: "TARGETING_MATCH",
            value: "key",
            variant: "key",
          },
        );
      });

      it.each([
        ["one", {}, { a: 1 }, {}, "TARGETING_MATCH", undefined],
        ["two", "string", "default", "string", "TARGETING_MATCH", undefined],
        ["three", 15, 16, 15, "TARGETING_MATCH", undefined],
        ["four", true, true, true, "TARGETING_MATCH", undefined],
        ["five", 100, "string", "string", "ERROR", "TYPE_MISMATCH"],
        ["six", 1337, true, true, "ERROR", "TYPE_MISMATCH"],
        ["seven", "string", 1337, 1337, "ERROR", "TYPE_MISMATCH"],
      ])(
        "should return the correct result when evaluating object. variant: %s, value: %s, default: %s, expected: %s, reason: %s, errorCode: %s`",
        (variant, value, def, expected, reason, errorCode) => {
          mockMultiVariantFlag(variant, value);

          expect(ofClient.getObjectDetails(testFlagKey, def)).toMatchObject({
            flagKey: testFlagKey,
            flagMetadata: {},
            reason,
            value: expected,
            ...(errorCode ? { errorCode } : {}),
            ...(!errorCode ? { variant } : {}),
          });
        },
      );
    });
  });

  describe("track", () => {
    it("calls the client correctly for track calls", async () => {
      const testEvent = "testEvent";
      await provider.initialize();

      ofClient.track(testEvent, { key: "value" });
      expect(reflagClientMock.track).toHaveBeenCalled();
      expect(reflagClientMock.track).toHaveBeenCalledWith(testEvent, {
        key: "value",
      });
    });
  });
});
