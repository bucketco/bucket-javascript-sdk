import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import canonicalJSON from "canonical-json";

import type {
  FeatureFlagsOptions,
  Options as BucketSDKOptions,
  Flag,
} from "@bucketco/tracking-sdk";
import BucketSingleton from "@bucketco/tracking-sdk";
import { Feedback } from "@bucketco/tracking-sdk/dist/types/src/types";

export type BucketInstance = typeof BucketSingleton;

type UserContext = {
  id: string | number;
  [key: string]: any;
};

type CompanyContext = {
  id: string | number;
  [key: string]: any;
};

type OtherContext = Record<string, any>;

type FlagContext = {
  user?: UserContext;
  company?: CompanyContext;
  otherContext?: OtherContext;
};

export function TypedBucket<T extends Record<string, boolean>>(flags: T) {
  return {
    useFlag(key: Extract<keyof T, string>) {
      return useFlag(key);
    },
    useFlags: useFlags,
    useFlagIsEnabled: (key: Extract<keyof T, string>) => useFlagIsEnabled(key),
    useCompany: useCompany,
    useUser: useUser,
    useOtherContext: useOtherContext,
    useTrack: useTrack,
    useSendFeedback: () => useSendFeedback(),
    useRequestFeedback: () => useRequestFeedback(),
    Provider: (props: BucketProps) =>
      BucketProvider({
        ...props,
        flagOptions: {
          ...props.flagOptions,
          fallbackFlags: Object.keys(flags),
        },
      }),
  };
}

type BucketContext<T = Record<string, string>> = {
  bucket: BucketInstance;
  flags: {
    flags: Flags<T>;
    isLoading: boolean;
    setContext: (context: FlagContext) => void;
    context: {
      user?: UserContext;
      company?: CompanyContext;
      otherContext?: OtherContext;
    };
  };
};

const Context = createContext<BucketContext>({
  bucket: BucketSingleton,
  flags: {
    flags: {},
    isLoading: true,
    setContext: () => {},
    context: {},
  },
});

export type BucketProps = BucketSDKOptions &
  FlagContext & {
    publishableKey: string;
    flagOptions?: Omit<FeatureFlagsOptions, "context" | "fallbackFlags"> & {
      fallbackFlags?: string[];
    };
    children?: ReactNode;
    sdk?: BucketInstance;
  };

export type Flags<T = Record<string, string>> = { [k in keyof T]?: Flag };

export function BucketProvider({
  children,
  sdk,
  user: initialUser,
  company: initialCompany,
  otherContext: initialOtherContext,
  ...config
}: BucketProps) {
  const [flags, setFlags] = useState<Flags>({});
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [bucket] = useState(() => sdk ?? BucketSingleton);

  const [flagContext, setFlagContext] = useState({
    user: initialUser,
    company: initialCompany,
    otherContext: initialOtherContext,
  });

  const { user, company, otherContext } = flagContext;

  const contextKey = canonicalJSON({ config, flagContext });

  // update the user and company on the Bucket servers
  useEffect(() => {
    if (user?.id) {
      const { id: _, ...attributes } = user;
      bucket.user(String(user.id), attributes);
    }
  }, [canonicalJSON(user)]);

  useEffect(() => {
    if (company?.id) {
      const { id: _, ...attributes } = company;
      bucket.company(
        String(company.id),
        attributes,
        user?.id !== undefined ? String(user?.id) : undefined,
      );
    }
  }, [canonicalJSON(company), user?.id]);

  useEffect(() => {
    try {
      const { publishableKey, flagOptions, ...options } = config;

      const { fallbackFlags, ...flagOptionsRest } = flagOptions || {};

      bucket.reset();
      bucket.init(publishableKey, options);

      setFlagsLoading(true);
      // TODO: otherContext...
      bucket
        .getFeatureFlags({
          ...flagOptionsRest,
          fallbackFlags: fallbackFlags?.map((key) => ({
            value: true,
            key,
          })),
          context: flagContext,
        })
        .then((loadedFlags) => {
          setFlags(loadedFlags);
          setFlagsLoading(false);
        })
        .catch((err) => {
          console.error("[Bucket SDK] Error fetching flags:", err);
        });
    } catch (err) {
      console.error("[Bucket SDK] Unknown error:", err);
    }
  }, [contextKey]);

  const context: BucketContext = {
    bucket,
    flags: {
      flags,
      isLoading: flagsLoading,
      context: { user, company, otherContext },
      setContext: (context: FlagContext) => {
        setFlagContext({
          ...flagContext,
          ...context,
        });
      },
    },
  };

  return <Context.Provider children={children} value={context} />;
}

/**
 * Returns true if the feature flags is enabled.
 * If the provider hasn't finished loading, it will return false.
 *
 * ```ts
 * const isEnabled = useFlagIsEnabled('huddle');
 * // true / false
 * ```
 */
export function useFlagIsEnabled(flagKey: string) {
  const { flags } = useContext<BucketContext>(Context).flags;
  return flags[flagKey]?.value ?? false;
}

/**
 * Returns the state of a given feature flag for the current context, e.g.
 *
 * ```ts
 * const huddleFlag = useFlag("huddle");
 * // {
 * //   "isLoading": false,
 * //   "isEnabled": true,
 * // }
 * ```
 */
export function useFlag(key: string) {
  const flags = useContext<BucketContext>(Context).flags;
  const flag = flags.flags[key];

  const value = flag?.value ?? false;

  return { isLoading: flags.isLoading, isEnabled: value };
}

/**
 * Returns feature flags as an object, e.g.
 * Note: this returns the raw flag keys, and does not use the
 * mapping provided in the `BucketProvider`.
 *
 * ```ts
 * const flags = useFlags();
 * // {
 * //   "isLoading": false,
 * //   "flags: {
 * //     "huddle": true,
 * //     "post-message": true
 * //   }
 * // }
 * ```
 */
export function useFlags(): {
  isLoading: boolean;
  flags: { [key: string]: boolean };
} {
  const {
    flags: { flags, isLoading },
  } = useContext<BucketContext>(Context);

  return {
    isLoading,
    flags: Object.fromEntries(Object.keys(flags).map((f) => [f, true])),
  };
}

/**
 * Returns a function to update the current company
 *
 * ```ts
 * const [company, setCompany] = useCompany();
 * setCompany({
 *   ...company,
 *   plan: "enterprise",
 * });
 * ```
 */
export function useCompany() {
  const { context, setContext } = useContext<BucketContext>(Context).flags;
  return [
    context.company,
    (company: CompanyContext) => {
      setContext({ ...context, company });
    },
  ] as const;
}

/**
 * Returns a function to update the current user
 *
 * ```ts
 * const [user, setUser] = useUser();
 * setUser({
 *   ...user,
 *   role: "manager",
 * });
 * ```
 */
export function useUser() {
  const { context, setContext } = useContext<BucketContext>(Context).flags;
  return [
    context.user,
    (user: UserContext) => {
      setContext({ ...context, user });
    },
  ] as const;
}

/**
 * Returns a function to update the "other" context
 *
 * ```ts
 * const otherContext = useOtherContext();
 * setOtherContext({
 *   happeningId: "big-conf1",
 * });
 * ```
 */
export function useOtherContext() {
  const { context, setContext } = useContext<BucketContext>(Context).flags;
  return [
    context.otherContext,
    (otherContext: OtherContext) => {
      setContext({ ...context, otherContext });
    },
  ] as const;
}

/**
 * Returns a function to send an event when a user performs an action
 *
 * ```ts
 * const track = useTrack();
 * track("Started Huddle", { button: "cta" });
 * ```
 */
export function useTrack() {
  const ctx = useContext<BucketContext>(Context);

  return (eventName: string, attributes?: Record<string, any>) => {
    const { user, company } = ctx.flags.context;

    if (user?.id === undefined)
      return () => {
        console.error("User is required to send events");
      };

    return ctx.bucket.track(
      eventName,
      attributes,
      user?.id !== undefined ? String(user?.id) : undefined,
      company?.id !== undefined ? String(company?.id) : undefined,
    );
  };
}

/**
 * Returns a function to send feedback collected from a user
 *
 * ```ts
 * const track = useSendFeedback();
 * track("Started Huddle", { button: "cta" });
 * ```
 */
export function useSendFeedback() {
  const ctx = useContext<BucketContext>(Context);
  const { user } = ctx.flags.context;
  if (user?.id === undefined)
    return () => {
      console.error("User is required to send feedback");
    };
  return (opts: Omit<Feedback, "userId">) =>
    ctx.bucket.feedback({ ...opts, userId: String(user.id) });
}

/**
 * Returns a function to open up the feedback form
 *
 * ```ts
 * const requestFeedback = useRequestFeedback();
 * requestFeedback("Started Huddle", { button: "cta" });
 * ```
 */
export function useRequestFeedback() {
  const ctx = useContext<BucketContext>(Context);
  const { user } = ctx.flags.context;
  if (user?.id === undefined)
    return () => {
      console.error("User is required to request feedback");
    };
  return (opts: Omit<Feedback, "userId">) =>
    ctx.bucket.requestFeedback({ ...opts, userId: String(user.id) });
}
