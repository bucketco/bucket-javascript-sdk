import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompanyContext, UserContext } from "../src";
import { CheckEvent, RawFeatures } from "../src/feature/features";
import { HooksManager } from "../src/hooksManager";

describe("HookManager", () => {
  let hookManager: HooksManager;

  beforeEach(() => {
    hookManager = new HooksManager();
  });

  it("should add and trigger check-is-enabled hooks", () => {
    const callback = vi.fn();
    hookManager.addHook("check-is-enabled", callback);

    const checkEvent: CheckEvent = {
      action: "check-is-enabled",
      key: "test-key",
      value: true,
    };
    hookManager.trigger("check-is-enabled", checkEvent);

    expect(callback).toHaveBeenCalledWith(checkEvent);
  });

  it("should add and trigger check-config hooks", () => {
    const callback = vi.fn();
    hookManager.addHook("check-config", callback);

    const checkEvent: CheckEvent = {
      action: "check-config",
      key: "test-key",
      value: { key: "key", payload: "payload" },
    };
    hookManager.trigger("check-config", checkEvent);

    expect(callback).toHaveBeenCalledWith(checkEvent);
  });

  it("should add and trigger features-updated hooks", () => {
    const callback = vi.fn();
    hookManager.addHook("features-updated", callback);

    const features: RawFeatures = {
      /* mock RawFeatures data */
    };
    hookManager.trigger("features-updated", features);

    expect(callback).toHaveBeenCalledWith(features);
  });

  it("should add and trigger track hooks", () => {
    const callback = vi.fn();
    const user: UserContext = { id: "user-id", name: "user-name" };
    const company: CompanyContext = { id: "company-id", name: "company-name" };
    hookManager.addHook("track", callback);

    const eventName = "test-event";
    const attributes = { key: "value" };
    hookManager.trigger("track", { eventName, attributes, user, company });

    expect(callback).toHaveBeenCalledWith({
      eventName,
      attributes,
      user,
      company,
    });
  });

  it("should add and trigger user hooks", () => {
    const callback = vi.fn();

    hookManager.addHook("user", callback);

    const user = { id: "user-id", name: "user-name" };
    hookManager.trigger("user", user);

    expect(callback).toHaveBeenCalledWith(user);
  });

  it("should add and trigger company hooks", () => {
    const callback = vi.fn();
    hookManager.addHook("company", callback);

    const company = { id: "company-id", name: "company-name" };
    hookManager.trigger("company", company);

    expect(callback).toHaveBeenCalledWith(company);
  });

  it("should handle multiple hooks of the same type", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    hookManager.addHook("check-is-enabled", callback1);
    hookManager.addHook("check-is-enabled", callback2);

    const checkEvent: CheckEvent = {
      action: "check-is-enabled",
      key: "test-key",
      value: true,
    };
    hookManager.trigger("check-is-enabled", checkEvent);

    expect(callback1).toHaveBeenCalledWith(checkEvent);
    expect(callback2).toHaveBeenCalledWith(checkEvent);
  });

  it("should remove the given hook and no other hooks", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    hookManager.addHook("check-is-enabled", callback1);
    hookManager.addHook("check-is-enabled", callback2);
    hookManager.removeHook("check-is-enabled", callback1);

    const checkEvent: CheckEvent = {
      action: "check-is-enabled",
      key: "test-key",
      value: true,
    };
    hookManager.trigger("check-is-enabled", checkEvent);

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledWith(checkEvent);
  });
});
