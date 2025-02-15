import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompanyContext, UserContext } from "../src";
import { CheckEvent, RawFeatures } from "../src/feature/features";
import {
  CheckHook,
  CompanyHook,
  FeaturesUpdatedHook,
  HooksManager,
  TrackHook,
  UserHook,
} from "../src/hooksManager";

describe("HookManager", () => {
  let hookManager: HooksManager;

  beforeEach(() => {
    hookManager = new HooksManager();
  });

  it("should add and trigger check-is-enabled hooks", () => {
    const callback = vi.fn();
    const hook: CheckHook = { type: "check-is-enabled", callback };
    hookManager.addHook(hook);

    const checkEvent: CheckEvent = {
      action: "check-is-enabled",
      key: "test-key",
      value: true,
    };
    hookManager.triggerCheck(checkEvent);

    expect(callback).toHaveBeenCalledWith(checkEvent);
  });

  it("should add and trigger check-config hooks", () => {
    const callback = vi.fn();
    const hook: CheckHook = { type: "check-config", callback };
    hookManager.addHook(hook);

    const checkEvent: CheckEvent = {
      action: "check-config",
      key: "test-key",
      value: { key: "key", payload: "payload" },
    };
    hookManager.triggerCheck(checkEvent);

    expect(callback).toHaveBeenCalledWith(checkEvent);
  });

  it("should add and trigger features-updated hooks", () => {
    const callback = vi.fn();
    const hook: FeaturesUpdatedHook = { type: "features-updated", callback };
    hookManager.addHook(hook);

    const features: RawFeatures = {
      /* mock RawFeatures data */
    };
    hookManager.triggerFeaturesUpdated(features);

    expect(callback).toHaveBeenCalledWith(features);
  });

  it("should add and trigger track hooks", () => {
    const callback = vi.fn();
    const user: UserContext = { id: "user-id", name: "user-name" };
    const company: CompanyContext = { id: "company-id", name: "company-name" };
    const hook: TrackHook = { type: "track", callback };
    hookManager.addHook(hook);

    const eventName = "test-event";
    const attributes = { key: "value" };
    hookManager.triggerTrack({ eventName, attributes, user, company });

    expect(callback).toHaveBeenCalledWith({
      eventName,
      attributes,
      user,
      company,
    });
  });

  it("should add and trigger user hooks", () => {
    const callback = vi.fn();
    const hook: UserHook = { type: "user", callback };
    hookManager.addHook(hook);

    const user = { id: "user-id", name: "user-name" };
    hookManager.triggerUser(user);

    expect(callback).toHaveBeenCalledWith(user);
  });

  it("should add and trigger company hooks", () => {
    const callback = vi.fn();
    const hook: CompanyHook = { type: "company", callback };
    hookManager.addHook(hook);

    const company = { id: "company-id", name: "company-name" };
    hookManager.triggerCompany(company);

    expect(callback).toHaveBeenCalledWith(company);
  });

  it("should handle multiple hooks of the same type", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const hook1: CheckHook = { type: "check-is-enabled", callback: callback1 };
    const hook2: CheckHook = { type: "check-is-enabled", callback: callback2 };
    hookManager.addHook(hook1);
    hookManager.addHook(hook2);

    const checkEvent: CheckEvent = {
      action: "check-is-enabled",
      key: "test-key",
      value: true,
    };
    hookManager.triggerCheck(checkEvent);

    expect(callback1).toHaveBeenCalledWith(checkEvent);
    expect(callback2).toHaveBeenCalledWith(checkEvent);
  });
});
