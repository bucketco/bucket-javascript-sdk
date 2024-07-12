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
} from "@bucketco/tracking-sdk";
import BucketSingleton from "@bucketco/tracking-sdk";
import {
  Feedback,
  RequestFeedbackOptions,
} from "@bucketco/tracking-sdk/dist/types/src/types";

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

declare global {
  module Bucket {
    interface Flags {}
  }
}

type BucketFlags = keyof (keyof Bucket.Flags extends never
  ? Record<string, boolean>
  : Bucket.Flags);

type BucketContext = {
  bucket: BucketInstance;
  flags: {
    flags: Flags;
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
    isLoading: false,
    setContext: () => {},
    context: {},
  },
});

export type BucketProps = BucketSDKOptions &
  FlagContext & {
    publishableKey: string;
    flagOptions?: Omit<FeatureFlagsOptions, "context" | "fallbackFlags"> & {
      fallbackFlags?: Record<BucketFlags, boolean>;
    };
    children?: ReactNode;
    sdk?: BucketInstance;
  };

export type Flags = { [k in BucketFlags]?: boolean };

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

  useEffect(() => {
    try {
      const { publishableKey, flagOptions, ...options } = config;

      const { fallbackFlags, ...flagOptionsRest } = flagOptions || {};

      bucket.reset();
      bucket.init(publishableKey, options);

      // update the user and company on the Bucket servers

      if (user?.id) {
        const { id: _, ...attributes } = user;
        bucket.user(String(user.id), attributes);
      }

      if (company?.id) {
        const { id: _, ...attributes } = company;
        bucket.company(
          String(company.id),
          attributes,
          user?.id !== undefined ? String(user?.id) : undefined,
        );
      }

      setFlagsLoading(true);
      bucket
        .getFeatureFlags({
          ...flagOptionsRest,
          fallbackFlags: Object.entries(fallbackFlags ?? {}).map(
            ([key, value]) => ({ key, value }),
          ),
          context: flagContext,
        })
        .then((loadedFlags) => {
          setFlags(
            Object.fromEntries(
              Object.entries(loadedFlags).map(([key, { value }]) => [
                key,
                value,
              ]),
            ),
          );
        })
        .catch((err) => {
          console.error("[Bucket SDK] Error fetching flags:", err);
        })
        .finally(() => {
          setFlagsLoading(false);
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
export function useFlagIsEnabled(flagKey: BucketFlags) {
  const { flags } = useContext<BucketContext>(Context).flags;
  return flags[flagKey] ?? false;
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
export function useFlag(key: BucketFlags) {
  const flags = useContext<BucketContext>(Context).flags;
  const isEnabled = flags.flags[key] ?? false;

  return { isLoading: flags.isLoading, isEnabled };
}

/**
 * Returns feature flags as an object, e.g.
 * Note: this returns the raw flag keys, and does not use the
 * optional typing provided through `Bucket.Flags`.
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
  flags: Record<string, boolean>;
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
 * Note: When calling `useSendFeedback`, user/company must already be set.
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
 * Returns a function to send feedback collected from a user.
 * Note: When calling `useSendFeedback`, user/company must already be set.
 *
 * ```ts
 * const sendFeedback = useSendFeedback();
 * sendFeedback({
 *   featureId: "fe2323223";;
 *   question: "How did you like the new huddle feature?";
 *   score: 5;
 *   comment: "I loved it!";
 * });
 * ```
 */
export function useSendFeedback() {
  const ctx = useContext<BucketContext>(Context);

  const { user, company } = ctx.flags.context;
  if (user?.id === undefined)
    return () => {
      console.error("User is required to send feedback");
    };

  return (opts: Omit<Feedback, "userId">) => {
    return ctx.bucket.feedback({
      ...opts,
      companyId: company?.id !== undefined ? String(company.id) : undefined,
      userId: String(user.id),
    });
  };
}

/**
 * Returns a function to open up the feedback form
 * Note: When calling `useRequestFeedback`, user/company must already be set.
 *
 * ```ts
 * const requestFeedback = useRequestFeedback();
 * requestFeedback("Started Huddle", { button: "cta" });
 * ```
 */
export function useRequestFeedback() {
  const ctx = useContext<BucketContext>(Context);
  const { user, company } = ctx.flags.context;
  if (user?.id === undefined)
    return () => {
      console.error("User is required to request feedback");
    };

  return (opts: Omit<RequestFeedbackOptions, "userId" | "companyId">) =>
    ctx.bucket.requestFeedback({
      ...opts,
      userId: String(user.id),
      companyId: company?.id !== undefined ? String(company.id) : undefined,
    });
}
