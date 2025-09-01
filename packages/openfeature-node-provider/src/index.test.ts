import { ProviderStatus } from "@openfeature/server-sdk";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";

import { ReflagClient } from "@reflag/node-sdk";

import { BucketNodeProvider, defaultContextTranslator } from "./index";

vi.mock("@reflag/node-sdk", () => {
  const actualModule = vi.importActual("@reflag/node-sdk");

  return {
    __esModule: true,
    ...actualModule,
    ReflagClient: vi.fn(),
  };
});

const bucketClientMock = {
  getFeature: vi.fn(),
  getFeatureDefinitions: vi.fn().mockReturnValue([]),
  initialize: vi.fn().mockResolvedValue({}),
  flush: vi.fn(),
  track: vi.fn(),
};

const secretKey = "sec_fakeSecretKey______"; // must be 23 characters long

const context = {
  targetingKey: "abc",
  name: "John Doe",
  email: "john@acme.inc",
};

const bucketContext = {
  user: { id: "42" },
  company: { id: "99" },
};

const testFlagKey = "a-key";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BucketNodeProvider", () => {
  let provider: BucketNodeProvider;

  const mockBucketClient = ReflagClient as Mock;
  mockBucketClient.mockReturnValue(bucketClientMock);

  let mockTranslatorFn: Mock;

  function mockFeature(
    enabled: boolean,
    configKey?: string | null,
    configPayload?: any,
    flagKey = testFlagKey,
  ) {
    const config = {
      key: configKey,
      payload: configPayload,
    };

    bucketClientMock.getFeature = vi.fn().mockReturnValue({
      isEnabled: enabled,
      config,
    });

    // Mock getFeatureDefinitions to return feature definitions that include the specified flag
    bucketClientMock.getFeatureDefinitions = vi.fn().mockReturnValue([
      {
        key: flagKey,
        description: "Test flag",
        flag: {},
        config: {},
      },
    ]);
  }

  beforeEach(async () => {
    mockTranslatorFn = vi.fn().mockReturnValue(bucketContext);

    provider = new BucketNodeProvider({
      secretKey,
      contextTranslator: mockTranslatorFn,
    });

    await provider.initialize();
  });

  describe("contextTranslator", () => {
    it("defaultContextTranslator provides the correct context", async () => {
      expect(
        defaultContextTranslator({
          userId: 123,
          name: "John Doe",
          email: "ron@bucket.co",
          avatar: "https://reflag.com/avatar.png",
          companyId: "456",
          companyName: "Acme, Inc.",
          companyAvatar: "https://acme.com/company-avatar.png",
          companyPlan: "pro",
        }),
      ).toEqual({
        user: {
          id: "123",
          name: "John Doe",
          email: "ron@bucket.co",
          avatar: "https://reflag.com/avatar.png",
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

  describe("lifecycle", () => {
    it("calls the constructor of ReflagClient", () => {
      mockBucketClient.mockClear();

      provider = new BucketNodeProvider({
        secretKey,
        contextTranslator: mockTranslatorFn,
      });

      expect(mockBucketClient).toHaveBeenCalledTimes(1);
      expect(mockBucketClient).toHaveBeenCalledWith({ secretKey });
    });

    it("should set the status to READY if initialization succeeds", async () => {
      provider = new BucketNodeProvider({
        secretKey,
        contextTranslator: mockTranslatorFn,
      });

      await provider.initialize();

      expect(provider.status).toBe(ProviderStatus.READY);
    });

    it("should keep the status as READY after closing", async () => {
      provider = new BucketNodeProvider({
        secretKey: "invalid",
        contextTranslator: mockTranslatorFn,
      });

      await provider.initialize();
      await provider.onClose();

      expect(provider.status).toBe(ProviderStatus.READY);
    });

    it("calls flush when provider is closed", async () => {
      await provider.onClose();
      expect(bucketClientMock.flush).toHaveBeenCalledTimes(1);
    });

    it("uses the contextTranslator function", async () => {
      mockFeature(true);

      await provider.resolveBooleanEvaluation(testFlagKey, false, context);

      expect(mockTranslatorFn).toHaveBeenCalledTimes(1);
      expect(mockTranslatorFn).toHaveBeenCalledWith(context);

      expect(bucketClientMock.getFeatureDefinitions).toHaveBeenCalledTimes(1);
      expect(bucketClientMock.getFeature).toHaveBeenCalledWith(
        bucketContext,
        testFlagKey,
      );
    });
  });

  describe("resolving flags", () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it("returns error if provider is not initialized", async () => {
      provider = new BucketNodeProvider({
        secretKey: "invalid",
        contextTranslator: mockTranslatorFn,
      });

      const val = await provider.resolveBooleanEvaluation(
        testFlagKey,
        true,
        context,
      );

      expect(val).toMatchObject({
        reason: "ERROR",
        errorCode: "PROVIDER_NOT_READY",
        value: true,
      });
    });

    it("returns error if flag is not found", async () => {
      mockFeature(true, "key", true);
      const val = await provider.resolveBooleanEvaluation(
        "missing-key",
        true,
        context,
      );

      expect(val).toMatchObject({
        reason: "ERROR",
        errorCode: "FLAG_NOT_FOUND",
        value: true,
      });
    });

    it("calls the client correctly when evaluating", async () => {
      mockFeature(true, "key", true);

      const val = await provider.resolveBooleanEvaluation(
        testFlagKey,
        false,
        context,
      );

      expect(val).toMatchObject({
        reason: "TARGETING_MATCH",
        value: true,
      });

      expect(bucketClientMock.getFeatureDefinitions).toHaveBeenCalled();
      expect(bucketClientMock.getFeature).toHaveBeenCalledWith(
        bucketContext,
        testFlagKey,
      );
    });

    it.each([
      [true, false, true, "TARGETING_MATCH", undefined],
      [undefined, true, true, "ERROR", "FLAG_NOT_FOUND"],
      [undefined, false, false, "ERROR", "FLAG_NOT_FOUND"],
    ])(
      "should return the correct result when evaluating boolean. enabled: %s, value: %s, default: %s, expected: %s, reason: %s, errorCode: %s`",
      async (enabled, def, expected, reason, errorCode) => {
        const configKey = enabled !== undefined ? "variant-1" : undefined;

        mockFeature(enabled ?? false, configKey);
        const flagKey = enabled ? testFlagKey : "missing-key";

        expect(
          await provider.resolveBooleanEvaluation(flagKey, def, context),
        ).toMatchObject({
          reason,
          value: expected,
          ...(configKey ? { variant: configKey } : {}),
          ...(errorCode ? { errorCode } : {}),
        });
      },
    );

    it("should return error when context is missing user ID", async () => {
      mockTranslatorFn.mockReturnValue({ user: {} });

      expect(
        await provider.resolveBooleanEvaluation(testFlagKey, true, context),
      ).toMatchObject({
        reason: "ERROR",
        errorCode: "INVALID_CONTEXT",
        value: true,
      });
    });

    it("should return error when evaluating number", async () => {
      expect(
        await provider.resolveNumberEvaluation(testFlagKey, 1),
      ).toMatchObject({
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
      "should return the correct result when evaluating string. variant: %s, def: %s, expected: %s, reason: %s, errorCode: %s`",
      async (variant, def, expected, reason) => {
        mockFeature(true, variant, {});
        expect(
          await provider.resolveStringEvaluation(testFlagKey, def, context),
        ).toMatchObject({
          reason,
          value: expected,
          ...(variant ? { variant } : {}),
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
      [undefined, "default", "default", "ERROR", "TYPE_MISMATCH"],
    ])(
      "should return the correct result when evaluating object. payload: %s, default: %s, expected: %s, reason: %s, errorCode: %s`",
      async (value, def, expected, reason, errorCode) => {
        const configKey = value === undefined ? undefined : "config-key";
        mockFeature(true, configKey, value);
        expect(
          await provider.resolveObjectEvaluation(testFlagKey, def, context),
        ).toMatchObject({
          reason,
          value: expected,
          ...(errorCode ? { errorCode, variant: configKey } : {}),
        });
      },
    );
  });

  describe("track", () => {
    it("should track", async () => {
      expect(mockTranslatorFn).toHaveBeenCalledTimes(0);
      provider.track("event", context, {
        action: "click",
      });

      expect(mockTranslatorFn).toHaveBeenCalledTimes(1);
      expect(mockTranslatorFn).toHaveBeenCalledWith(context);
      expect(bucketClientMock.track).toHaveBeenCalledTimes(1);
      expect(bucketClientMock.track).toHaveBeenCalledWith("42", "event", {
        attributes: { action: "click" },
        companyId: bucketContext.company.id,
      });
    });
  });
});
