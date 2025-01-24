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
    it("calls the client correctly for boolean evaluation", async () => {
      bucketClientMock.getFeature = vi.fn().mockReturnValue({
        isEnabled: true,
      });
      bucketClientMock.getFeatures = vi.fn().mockReturnValue({
        [testFlagKey]: {
          isEnabled: true,
          targetingVersion: 1,
        },
      });
      await provider.initialize();

      ofClient.getBooleanDetails(testFlagKey, false);
      expect(bucketClientMock.getFeatures).toHaveBeenCalled();
      expect(bucketClientMock.getFeature).toHaveBeenCalledWith(testFlagKey);
    });
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
