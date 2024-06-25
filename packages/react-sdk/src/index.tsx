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

type BucketContext<T = Record<string, string>> = {
  bucket: BucketInstance;
  flags: {
    flags: Flags<T>;
    isLoading: boolean;
    setFlagContext: (context: FlagContext) => void;
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
    setFlagContext: () => {},
    context: {},
  },
});

export type BucketProps = BucketSDKOptions &
  FlagContext & {
    publishableKey: string;
    flags: FeatureFlagsOptions;
    children?: ReactNode;
    sdk?: BucketInstance;
  };

export type Flags<T> = { [k in keyof T]?: Flag };

export function BucketProvider<T = Record<string, string>>({
  children,
  sdk,
  user: initialUser,
  company: initialCompany,
  otherContext: initialOtherContext,
  ...config
}: BucketProps) {
  const [flags, setFlags] = useState<Flags<T>>({});
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
      const { publishableKey, flags: flagOptions, ...options } = config;

      bucket.reset();
      bucket.init(publishableKey, options);

      setFlagsLoading(true);
      bucket
        .getFeatureFlags(flagOptions)
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

  const context: BucketContext<T> = {
    bucket,
    flags: {
      flags,
      isLoading: flagsLoading,
      context: { user, company, otherContext },
      setFlagContext: (context: FlagContext) => {
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

  const value = flag?.value ?? null;

  return { isLoading: flags.isLoading, isEnabled: value };
}

/**
 * Returns feature flags as an object, e.g.
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
export function useFlags() {
  const { isLoading, flags } = useContext<BucketContext>(Context).flags;
  return {
    isLoading,
    flags: Object.fromEntries(Object.keys(flags).map((f) => [f, true])),
  };
}

/**
 * Returns a function to update the current company
 *
 * ```ts
 * const updateCompany = useUpdateCompany();
 * updateCompany({
 *   id: "company1",
 *   plan: "enterprise",
 * });
 * ```
 */
export function useUpdateCompany() {
  return (company: CompanyContext) => {
    useContext<BucketContext>(Context).flags.setFlagContext({ company });
  };
}

/**
 * Returns a function to update the current user
 *
 * ```ts
 * const updateUser = useUpdateUser();
 * updateUser({
 *   id: "user1",
 *   plan: "enterprise",
 * });
 * ```
 */
export function useUpdateUser() {
  return (user: UserContext) => {
    useContext<BucketContext>(Context).flags.setFlagContext({ user });
  };
}

/**
 * Returns a function to update the "other" context
 *
 * ```ts
 * const updateUser = useUpdateOtherContext();
 * updateOtherContext({
 *   happeningId: "big-conf1",
 * });
 * ```
 */
export function useUpdateOtherContext() {
  return (otherContext: OtherContext) => {
    useContext<BucketContext>(Context).flags.setFlagContext({ otherContext });
  };
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

  return (eventName: string, attributes: Record<string, any>) => {
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
 * const track = useRequestFeedback();
 * track("Started Huddle", { button: "cta" });
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
