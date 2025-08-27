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

type HookType = keyof HookArgs;

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
    user: ((arg0: UserContext) => void)[];
    company: ((arg0: CompanyContext) => void)[];
    track: ((arg0: TrackEvent) => void)[];
  } = {
    enabledCheck: [],
    configCheck: [],
    check: [],
    flagsUpdated: [],
    user: [],
    company: [],
    track: [],
  };

  #adjustHookType(event: HookType): Exclude<HookType, "featuresUpdated"> {
    if (event === "featuresUpdated") {
      return "flagsUpdated";
    }
    return event;
  }

  addHook<THookType extends HookType>(
    event: THookType,
    cb: (arg0: HookArgs[THookType]) => void,
  ): () => void {
    const adjustedEvent = this.#adjustHookType(event);
    (this.hooks[adjustedEvent] as any[]).push(cb);
    return () => {
      this.removeHook(event, cb);
    };
  }

  removeHook<THookType extends HookType>(
    event: THookType,
    cb: (arg0: HookArgs[THookType]) => void,
  ): void {
    const adjustedEvent = this.#adjustHookType(event);
    this.hooks[adjustedEvent] = this.hooks[adjustedEvent].filter(
      (hook) => hook !== cb,
    ) as any;
  }

  trigger<THookType extends HookType>(
    event: Exclude<THookType, "featuresUpdated">,
    arg: HookArgs[THookType],
  ): void {
    const adjustedEvent = this.#adjustHookType(event);
    this.hooks[adjustedEvent].forEach((hook) => hook(arg as any));
  }
}
