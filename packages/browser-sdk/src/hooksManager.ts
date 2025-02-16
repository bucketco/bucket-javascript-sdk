import { CheckEvent, RawFeatures } from "./feature/features";
import { CompanyContext, UserContext } from "./context";

/**
 * @internal
 */
export interface HookArgs {
  "check-config": CheckEvent;
  "check-is-enabled": CheckEvent;
  "features-updated": RawFeatures;
  user: UserContext;
  company: CompanyContext;
  track: TrackEvent;
}

export type Hook<TType extends keyof HookArgs> = {
  type: TType;
  handler: (arg: HookArgs[TType]) => void;
};

type TrackEvent = {
  user: UserContext;
  company?: CompanyContext;
  eventName: string;
  attributes?: Record<string, any> | null;
};

/**
 * Hooks manager.
 * @internal
 */
export class HooksManager {
  private hooks: {
    "check-is-enabled": ((arg0: CheckEvent) => void)[];
    "check-config": ((arg0: CheckEvent) => void)[];
    "features-updated": ((arg0: RawFeatures) => void)[];
    user: ((arg0: UserContext) => void)[];
    company: ((arg0: CompanyContext) => void)[];
    track: ((arg0: TrackEvent) => void)[];
  } = {
    "check-is-enabled": [],
    "check-config": [],
    "features-updated": [],
    user: [],
    company: [],
    track: [],
  };

  addHook<THookType extends keyof HookArgs>(
    event: THookType,
    cb: (arg0: HookArgs[THookType]) => void,
  ): void {
    (this.hooks[event] as any[]).push(cb);
  }

  trigger<THookType extends keyof HookArgs>(
    event: THookType,
    arg: HookArgs[THookType],
  ): void {
    this.hooks[event].forEach((hook) => hook(arg as any));
  }
}
