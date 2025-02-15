import { CheckEvent, RawFeatures } from "./feature/features";
import { CompanyContext, UserContext } from "./context";

/**
 * Hook for check event.
 */
export type CheckHook = {
  type: "check-is-enabled" | "check-config";
  callback: (checkEvent: CheckEvent) => void;
};

/**
 * Hook for company update event.
 */
export type CompanyHook = {
  type: "company";
  callback: (company: CompanyContext) => void;
};

/**
 * Hook for user update event.
 */
export type UserHook = {
  type: "user";
  callback: (user: UserContext) => void;
};

/**
 * Hook for features updated event.
 */
export type FeaturesUpdatedHook = {
  type: "features-updated";
  callback: (features: RawFeatures) => void;
};

type trackEvent = {
  user: UserContext;
  company?: CompanyContext;
  eventName: string;
  attributes?: Record<string, any> | null;
};

/**
 * Hook for track event.
 */
export type TrackHook = {
  type: "track";
  callback: (trackEvent: trackEvent) => void;
};

/**
 * Hook definition.
 */
export type Hook =
  | CheckHook
  | FeaturesUpdatedHook
  | UserHook
  | CompanyHook
  | TrackHook;

/**
 * Hooks manager.
 * @internal
 */
export class HooksManager {
  private hooks: {
    "check-config": CheckHook[];
    "check-is-enabled": CheckHook[];
    "features-updated": FeaturesUpdatedHook[];
    user: UserHook[];
    company: CompanyHook[];
    track: TrackHook[];
  } = {
    "check-config": [],
    "check-is-enabled": [],
    "features-updated": [],
    user: [],
    company: [],
    track: [],
  };

  addHook(hook: Hook): void {
    (this.hooks[hook.type] as Hook[]).push(hook);
  }

  triggerCheck(checkEvent: CheckEvent): void {
    this.hooks[checkEvent.action].forEach((hook) => hook.callback(checkEvent));
  }

  triggerFeaturesUpdated(features: RawFeatures): void {
    this.hooks["features-updated"].forEach((hook) => hook.callback(features));
  }

  triggerUser(user: UserContext): void {
    this.hooks["user"].forEach((hook) => hook.callback(user));
  }

  triggerCompany(company: CompanyContext): void {
    this.hooks["company"].forEach((hook) => hook.callback(company));
  }

  triggerTrack(args: trackEvent): void {
    this.hooks["track"].forEach((hook) => hook.callback(args));
  }
}
