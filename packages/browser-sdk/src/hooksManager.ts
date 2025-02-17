import { CheckEvent, RawFeatures } from "./feature/features";
import { CompanyContext, UserContext } from "./context";

/**
 * @internal
 */
export interface HookArgs {
  configCheck: CheckEvent;
  isEnabledCheck: CheckEvent;
  featuresUpdated: RawFeatures;
  user: UserContext;
  company: CompanyContext;
  track: TrackEvent;
}

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
    isEnabledCheck: ((arg0: CheckEvent) => void)[];
    configCheck: ((arg0: CheckEvent) => void)[];
    featuresUpdated: ((arg0: RawFeatures) => void)[];
    user: ((arg0: UserContext) => void)[];
    company: ((arg0: CompanyContext) => void)[];
    track: ((arg0: TrackEvent) => void)[];
  } = {
    isEnabledCheck: [],
    configCheck: [],
    featuresUpdated: [],
    user: [],
    company: [],
    track: [],
  };

  addHook<THookType extends keyof HookArgs>(
    event: THookType,
    cb: (arg0: HookArgs[THookType]) => void,
  ): () => void {
    (this.hooks[event] as any[]).push(cb);
    return () => {
      this.removeHook(event, cb);
    };
  }

  removeHook<THookType extends keyof HookArgs>(
    event: THookType,
    cb: (arg0: HookArgs[THookType]) => void,
  ): void {
    this.hooks[event] = this.hooks[event].filter((hook) => hook !== cb) as any;
  }

  trigger<THookType extends keyof HookArgs>(
    event: THookType,
    arg: HookArgs[THookType],
  ): void {
    this.hooks[event].forEach((hook) => hook(arg as any));
  }
}
