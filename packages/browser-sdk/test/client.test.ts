import { beforeEach, describe, expect, it, vi } from "vitest";

import { BucketClient } from "../src/client";
import { FeaturesClient } from "../src/feature/features";
import { HttpClient } from "../src/httpClient";

import { featuresResult } from "./mocks/handlers";

describe("BucketClient", () => {
  let client: BucketClient;
  const httpClientPost = vi.spyOn(HttpClient.prototype as any, "post");

  const featureClientSetContext = vi.spyOn(
    FeaturesClient.prototype,
    "setContext",
  );

  beforeEach(() => {
    client = new BucketClient({
      publishableKey: "test-key",
      user: { id: "user1" },
      company: { id: "company1" },
    });
  });

  describe("updateUser", () => {
    it("should update the user context", async () => {
      // and send new user data and trigger feature update
      const updatedUser = { name: "New User" };

      await client.updateUser(updatedUser);

      expect(client["context"].user).toEqual({ id: "user1", ...updatedUser });
      expect(httpClientPost).toHaveBeenCalledWith({
        path: "/user",
        body: {
          userId: "user1",
          attributes: { name: updatedUser.name },
        },
      });
      expect(featureClientSetContext).toHaveBeenCalledWith(client["context"]);
    });
  });

  describe("updateCompany", () => {
    it("should update the company context", async () => {
      // send new company data and trigger feature update
      const updatedCompany = { name: "New Company" };

      await client.updateCompany(updatedCompany);

      expect(client["context"].company).toEqual({
        id: "company1",
        ...updatedCompany,
      });
      expect(httpClientPost).toHaveBeenCalledWith({
        path: "/company",
        body: {
          userId: "user1",
          companyId: "company1",
          attributes: { name: updatedCompany.name },
        },
      });
      expect(featureClientSetContext).toHaveBeenCalledWith(client["context"]);
    });
  });

  describe("getFeature", () => {
    it("takes overrides into account", async () => {
      await client.initialize();
      expect(featuresResult["featureA"].isEnabled).toBe(true);
      expect(client.getFeature("featureA").isEnabled).toBe(true);
      client.setFeatureOverride("featureA", false);
      expect(client.getFeature("featureA").isEnabled).toBe(false);
    });
  });

  describe("hooks integration", () => {
    it("on adds hooks appropriately, off removes them", async () => {
      const trackHook = vi.fn();
      const userHook = vi.fn();
      const companyHook = vi.fn();
      const checkHookIsEnabled = vi.fn();
      const checkHookConfig = vi.fn();
      const featuresUpdated = vi.fn();

      client.on("track", trackHook);
      client.on("user", userHook);
      client.on("company", companyHook);
      client.on("configCheck", checkHookConfig);
      client.on("enabledCheck", checkHookIsEnabled);
      client.on("featuresUpdated", featuresUpdated);

      await client.track("test-event");
      expect(trackHook).toHaveBeenCalledWith({
        eventName: "test-event",
        attributes: undefined,
        user: client["context"].user,
        company: client["context"].company,
      });

      await client["user"]();
      expect(userHook).toHaveBeenCalledWith(client["context"].user);

      await client["company"]();
      expect(companyHook).toHaveBeenCalledWith(client["context"].company);

      client.getFeature("featureA").isEnabled;
      expect(checkHookIsEnabled).toHaveBeenCalled();

      client.getFeature("featureA").config;
      expect(checkHookConfig).toHaveBeenCalled();

      expect(featuresUpdated).not.toHaveBeenCalled();
      await client.updateOtherContext({ key: "value" });
      expect(featuresUpdated).toHaveBeenCalled();

      // Remove hooks
      client.off("track", trackHook);
      client.off("user", userHook);
      client.off("company", companyHook);
      client.off("configCheck", checkHookConfig);
      client.off("enabledCheck", checkHookIsEnabled);
      client.off("featuresUpdated", featuresUpdated);

      // Reset mocks
      trackHook.mockReset();
      userHook.mockReset();
      companyHook.mockReset();
      checkHookIsEnabled.mockReset();
      checkHookConfig.mockReset();
      featuresUpdated.mockReset();

      // Trigger events again
      await client.track("test-event");
      await client["user"]();
      await client["company"]();
      client.getFeature("featureA").isEnabled;
      client.getFeature("featureA").config;
      await client.updateOtherContext({ key: "value" });

      // Ensure hooks are not called
      expect(trackHook).not.toHaveBeenCalled();
      expect(userHook).not.toHaveBeenCalled();
      expect(companyHook).not.toHaveBeenCalled();
      expect(checkHookIsEnabled).not.toHaveBeenCalled();
      expect(checkHookConfig).not.toHaveBeenCalled();
      expect(featuresUpdated).not.toHaveBeenCalled();
    });
  });
});
