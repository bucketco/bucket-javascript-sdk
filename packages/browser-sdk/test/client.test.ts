import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReflagClient } from "../src/client";
import { FlagsClient } from "../src/flag/flags";
import { HttpClient } from "../src/httpClient";

import { flagsResult } from "./mocks/handlers";

describe("ReflagClient", () => {
  let client: ReflagClient;
  const httpClientPost = vi.spyOn(HttpClient.prototype as any, "post");
  const httpClientGet = vi.spyOn(HttpClient.prototype as any, "get");

  const flagsClientSetContext = vi.spyOn(FlagsClient.prototype, "setContext");

  beforeEach(() => {
    client = new ReflagClient({
      publishableKey: "test-key",
      user: { id: "user1" },
      company: { id: "company1" },
    });

    vi.clearAllMocks();
  });

  describe("updateUser", () => {
    it("should update the user context", async () => {
      // and send new user data and trigger flag update
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
      expect(flagsClientSetContext).toHaveBeenCalledWith(client["context"]);
    });
  });

  describe("updateCompany", () => {
    it("should update the company context", async () => {
      // send new company data and trigger flag update
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
      expect(flagsClientSetContext).toHaveBeenCalledWith(client["context"]);
    });
  });

  describe("getFeature (deprecated)", () => {
    it("takes overrides into account", async () => {
      await client.initialize();

      expect(flagsResult["flagA"].isEnabled).toBe(true);
      expect(client.getFeature("flagA").isEnabled).toBe(true);

      client.getFeature("flagA").setIsEnabledOverride(false);
      expect(client.getFeature("flagA").isEnabled).toBe(false);
    });
  });

  describe("getFlag", () => {
    beforeEach(async () => {
      await client.initialize();

      // Set overrides to null to ensure they are not taken into account
      client.setFlagOverride("flagA", null);
      client.setFlagOverride("flagB", null);
    });

    it("returns the flag value", async () => {
      expect(client.getFlag("flagA")).toBe(true);
      expect(client.getFlag("flagB")).toStrictEqual({
        key: "gpt3",
        payload: { model: "gpt-something", temperature: 0.5 },
      });
      expect(client.getFlag("flagUnknown")).toBe(false);
    });

    it("returns the override flag value", async () => {
      client.setFlagOverride("flagA", false);
      expect(client.getFlag("flagA")).toBe(false);

      client.setFlagOverride("flagA", null);
      expect(client.getFlag("flagA")).toBe(true);
    });
  });

  describe("getFlagOverride & setFlagOverride", () => {
    beforeEach(async () => {
      await client.initialize();

      // Set overrides to null to ensure they are not taken into account
      client.setFlagOverride("flagA", null);
      client.setFlagOverride("flagB", null);
    });

    it("returns the flag override value (boolean)", async () => {
      expect(client.getFlagOverride("flagA")).toBe(null);
      client.setFlagOverride("flagA", false);

      expect(client.getFlagOverride("flagA")).toBe(false);
    });

    it("returns the flag override value (object)", async () => {
      expect(client.getFlagOverride("flagA")).toBe(null);
      client.setFlagOverride("flagA", { key: "something", payload: "else" });

      expect(client.getFlagOverride("flagA")).toStrictEqual({
        key: "something",
        payload: "else",
      });
    });

    it("ignores unknown flags", async () => {
      expect(client.getFlagOverride("flagUnknown")).toBe(null);
      client.setFlagOverride("flagUnknown", false);

      expect(client.getFlagOverride("flagUnknown")).toBe(null);
    });
  });

  describe("hooks integration", () => {
    const trackHook = vi.fn();
    const userHook = vi.fn();
    const companyHook = vi.fn();
    const checkHook = vi.fn();
    const checkHookIsEnabled = vi.fn();
    const checkHookConfig = vi.fn();
    const flagsUpdated = vi.fn();

    beforeEach(async () => {
      await client.initialize();

      client.on("track", trackHook);
      client.on("user", userHook);
      client.on("company", companyHook);
      client.on("check", checkHook);
      client.on("configCheck", checkHookConfig);
      client.on("enabledCheck", checkHookIsEnabled);
      client.on("flagsUpdated", flagsUpdated);

      trackHook.mockReset();
      userHook.mockReset();
      companyHook.mockReset();
      checkHook.mockReset();
      checkHookIsEnabled.mockReset();
      checkHookConfig.mockReset();
      flagsUpdated.mockReset();
    });

    afterEach(() => {
      client.off("track", trackHook);
      client.off("user", userHook);
      client.off("company", companyHook);
      client.off("check", checkHook);
      client.off("configCheck", checkHookConfig);
      client.off("enabledCheck", checkHookIsEnabled);
      client.off("flagsUpdated", flagsUpdated);
    });

    it("track", async () => {
      await client.track("test-event");

      expect(trackHook).toHaveBeenCalledWith({
        eventName: "test-event",
        attributes: undefined,
        user: client["context"].user,
        company: client["context"].company,
      });

      // Remove hooks
      client.off("track", trackHook);

      // Reset mocks
      trackHook.mockReset();

      // Trigger events again
      await client.track("test-event");

      // Ensure hooks are not called
      expect(trackHook).not.toHaveBeenCalled();
    });

    it("user", async () => {
      await client["user"]();
      expect(userHook).toHaveBeenCalledWith(client["context"].user);

      // Remove hooks
      client.off("user", userHook);

      // Reset mocks
      userHook.mockReset();

      // Trigger events again
      await client["user"]();

      // Ensure hooks are not called
      expect(userHook).not.toHaveBeenCalled();
    });

    it("company", async () => {
      await client["company"]();
      expect(companyHook).toHaveBeenCalledWith(client["context"].company);

      // Remove hooks
      client.off("company", companyHook);

      // Reset mocks
      companyHook.mockReset();

      // Trigger events again
      await client["company"]();

      // Ensure hooks are not called
      expect(companyHook).not.toHaveBeenCalled();
    });

    it("check (isEnabled)", async () => {
      client.getFlag("flagA");

      const checkEvent = {
        action: "check-is-enabled",
        key: "flagA",
        missingContextFields: ["field1", "field2"],
        ruleEvaluationResults: [false, true],
        value: true,
        version: 1,
      };

      expect(checkHookIsEnabled).toHaveBeenCalledWith(checkEvent);
      expect(checkHook).toHaveBeenCalledWith(checkEvent);

      // Remove hooks
      client.off("check", checkHook);
      client.off("enabledCheck", checkHookIsEnabled);

      // Reset mocks
      checkHook.mockReset();
      checkHookIsEnabled.mockReset();

      // Trigger events again
      client.getFlag("flagA");

      // Ensure hooks are not called
      expect(checkHook).not.toHaveBeenCalled();
      expect(checkHookIsEnabled).not.toHaveBeenCalled();
    });

    it("check (config)", async () => {
      client.getFlag("flagB");

      const checkEvent = {
        action: "check-config",
        key: "flagB",
        missingContextFields: ["field3"],
        ruleEvaluationResults: [true, false, false],
        value: {
          key: "gpt3",
          payload: {
            model: "gpt-something",
            temperature: 0.5,
          },
        },
        version: 12,
      };

      expect(checkHook).toHaveBeenCalledWith(checkEvent);
      expect(checkHookConfig).toHaveBeenCalledWith(checkEvent);

      client.off("check", checkHook);
      client.off("configCheck", checkHookConfig);

      // Reset mocks
      checkHook.mockReset();
      checkHookConfig.mockReset();

      client.getFlag("flagB");

      // Ensure hooks are not called
      expect(checkHook).not.toHaveBeenCalled();
      expect(checkHookConfig).not.toHaveBeenCalled();
    });

    it("flagsUpdated", async () => {
      await client.updateOtherContext({ key: "value" });
      expect(flagsUpdated).toHaveBeenCalled();

      // Remove hooks
      client.off("flagsUpdated", flagsUpdated);

      // Reset mocks
      flagsUpdated.mockReset();

      // Trigger events again
      await client.updateOtherContext({ key: "value" });

      // Ensure hooks are not called
      expect(flagsUpdated).not.toHaveBeenCalled();
    });
  });

  describe("offline mode", () => {
    it("should not make HTTP calls when offline", async () => {
      client = new ReflagClient({
        publishableKey: "test-key",
        user: { id: "user1" },
        company: { id: "company1" },
        offline: true,
        feedback: { enableAutoFeedback: true },
      });

      await client.initialize();
      await client.track("offline-event");
      await client.feedback({ flagKey: "flagA", score: 5 });
      await client.updateUser({ name: "New User" });
      await client.updateCompany({ name: "New Company" });
      await client.stop();

      expect(httpClientPost).not.toHaveBeenCalled();
      expect(httpClientGet).not.toHaveBeenCalled();
    });
  });
});
