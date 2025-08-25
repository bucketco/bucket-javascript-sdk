import { CheckEvent, RawFlags } from "./flag/flags";
import { CompanyContext, UserContext } from "./context";

export interface HookArgs {
  /**
   * Deprecated: Use `check` instead.
   * @deprecated
   */
  configCheck: CheckEvent;
  /**
   * Deprecated: Use `check` instead.
   * @deprecated
   */
  enabledCheck: CheckEvent;
  check: CheckEvent;
  flagsUpdated: RawFlags;

  /**
   * @deprecated
   *
   * Use `flagsUpdated` instead.
   */
  featuresUpdated: RawFlags;
  user: UserContext;
  company: CompanyContext;
  track: TrackEvent;
}

export type TrackEvent = {
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
    enabledCheck: ((arg0: CheckEvent) => void)[];
    configCheck: ((arg0: CheckEvent) => void)[];
    check: ((arg0: CheckEvent) => void)[];
    flagsUpdated: ((arg0: RawFlags) => void)[];
    featuresUpdated: ((arg0: RawFlags) => void)[];
    user: ((arg0: UserContext) => void)[];
    company: ((arg0: CompanyContext) => void)[];
    track: ((arg0: TrackEvent) => void)[];
  } = {
    enabledCheck: [],
    configCheck: [],
    check: [],
    flagsUpdated: [],
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
