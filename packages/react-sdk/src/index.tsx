import React, {
  createContext,
  ReactNode,
  useCallback,
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

export interface Flags {}

type BucketFlags = keyof (keyof Flags extends never
  ? Record<string, boolean>
  : Flags);

export type FlagsResult = { [k in BucketFlags]?: boolean };

type BucketContext = {
  bucket: BucketInstance;
  flags: {
    flags: FlagsResult;
    isLoading: boolean;
  };
  updateUser: (user?: UserContext) => void;
  updateCompany: (company: CompanyContext) => void;
  updateOtherContext: (otherContext: OtherContext) => void;

  sendFeedback: (opts: Omit<Feedback, "userId" | "companyId">) => void;
  requestFeedback: (
    opts: Omit<RequestFeedbackOptions, "userId" | "companyId">,
  ) => void;

  track: (eventName: string, attributes?: Record<string, any>) => void;
};

const Context = createContext<BucketContext>({
  bucket: BucketSingleton,
  flags: {
    flags: {},
    isLoading: false,
  },
  updateUser: () => undefined,
  updateCompany: () => undefined,
  updateOtherContext: () => undefined,
  track: () => undefined,
  sendFeedback: () => undefined,
  requestFeedback: () => undefined,
});

export type BucketProps = Omit<BucketSDKOptions, "persistUser"> &
  FlagContext & {
    publishableKey: string;
    flagOptions?: Omit<FeatureFlagsOptions, "context" | "fallbackFlags"> & {
      fallbackFlags?: BucketFlags[];
    };
    children?: ReactNode;
    sdk?: BucketInstance;
    loadingComponent?: ReactNode;
  };

export function BucketProvider({
  children,
  sdk,
  user: initialUser,
  company: initialCompany,
  otherContext: initialOtherContext,
  publishableKey,
  flagOptions,
  loadingComponent,
  ...config
}: BucketProps) {
  const [flags, setFlags] = useState<FlagsResult>(
    (flagOptions?.fallbackFlags ?? []).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as FlagsResult),
  );
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [bucket] = useState(() => sdk ?? BucketSingleton);

  const [flagContext, setFlagContext] = useState({
    user: initialUser,
    company: initialCompany,
    otherContext: initialOtherContext,
  });
  const { user, company } = flagContext;

  useEffect(() => {
    // on mount
    bucket.init(publishableKey, config);
    // on umount
    return () => bucket.reset();
  }, []);

  // call updateUser with no arguments to logout
  const updateUser = useCallback((newUser?: UserContext) => {
    setFlagContext({ ...flagContext, user: newUser });
    if (newUser?.id) {
      const { id, ...attributes } = newUser;
      // `user` calls bucket.reset() automatically when needed
      void bucket.user(String(id), attributes);
    } else {
      // logout
      bucket.reset();
    }
  }, []);

  // call updateUser with no arguments to re-set company context
  const updateCompany = useCallback((newCompany?: CompanyContext) => {
    setFlagContext({ ...flagContext, company: newCompany });
    if (newCompany?.id) {
      const { id, ...attributes } = newCompany;
      void bucket.company(
        String(id),
        attributes,
        flagContext?.user?.id !== undefined
          ? String(flagContext?.user?.id)
          : undefined,
      );
    }
  }, []);

  const updateOtherContext = useCallback((otherContext?: OtherContext) => {
    setFlagContext({ ...flagContext, otherContext });
  }, []);

  // fetch flags
  const contextKey = canonicalJSON({ config, flagContext });
  useEffect(() => {
    try {
      const { fallbackFlags, ...flagOptionsRest } = flagOptions || {};

      setFlagsLoading(true);

      void bucket
        .getFeatureFlags({
          ...flagOptionsRest,
          fallbackFlags,
          context: flagContext,
        })
        .then((loadedFlags) => {
          setFlags(loadedFlags);
        })
        .finally(() => {
          setFlagsLoading(false);
        });
    } catch (err) {
      console.error("[Bucket SDK] Unknown error:", err);
    }
  }, [contextKey]);

  const track = useCallback(
    (eventName: string, attributes?: Record<string, any>) => {
      if (user?.id === undefined)
        return () => {
          console.error("User is required to send events");
        };

      return bucket.track(
        eventName,
        attributes,
        user?.id !== undefined ? String(user?.id) : undefined,
        company?.id !== undefined ? String(company?.id) : undefined,
      );
    },
    [user?.id, company?.id],
  );

  const sendFeedback = useCallback(
    (opts: Omit<Feedback, "userId" | "companyId">) => {
      if (user?.id === undefined) {
        console.error("User is required to request feedback");
        return;
      }

      return bucket.feedback({
        ...opts,
        userId: String(user.id),
        companyId: company?.id !== undefined ? String(company.id) : undefined,
      });
    },
    [user?.id, company?.id],
  );

  const requestFeedback = useCallback(
    (opts: Omit<RequestFeedbackOptions, "userId" | "companyId">) => {
      if (user?.id === undefined) {
        console.error("User is required to request feedback");
        return;
      }

      bucket.requestFeedback({
        ...opts,
        userId: String(user.id),
        companyId: company?.id !== undefined ? String(company.id) : undefined,
      });
    },
    [user?.id, company?.id],
  );

  const context: BucketContext = {
    bucket,
    flags: {
      flags,
      isLoading: flagsLoading,
    },
    updateUser,
    updateCompany,
    updateOtherContext,
    track,

    sendFeedback,
    requestFeedback,
  };

  if (flagsLoading && loadingComponent) {
    return loadingComponent;
  }

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
 * optional typing provided through the `Flags` type.
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
  flags: FlagsResult;
} {
  const {
    flags: { flags, isLoading },
  } = useContext<BucketContext>(Context);

  return {
    isLoading,
    flags,
  };
}

/**
 * Returns a set of functions to update the current user, company or "other context".
 *
 * ```ts
 *  import { useUpdateContext } from "@bucketco/react-sdk";
 *  function Company() {
 *  const [company, _] = useState(initialCompany);
 *  const { updateCompany } = useUpdateContext();
 *  return (
 *    <div>
 *      <button onClick={() => updateCompany({ ...company, plan: "enterprise" })}>
 *        Upgrade to enterprise
 *      </button>
 *    </div>
 *  );
 * }
 * ```
 */
export function useUpdateContext() {
  const {
    updateUser,
    updateCompany,
    updateOtherContext,
    flags: { isLoading },
  } = useContext<BucketContext>(Context);
  return { updateUser, updateCompany, updateOtherContext, isLoading };
}

/**
 * Returns a function to send an event when a user performs an action
 * Note: When calling `useTrack`, user/company must already be set.
 *
 * ```ts
 * const track = useTrack();
 * track("Started Huddle", { button: "cta" });
 * ```
 */
export function useTrack() {
  const ctx = useContext<BucketContext>(Context);
  return ctx.track;
}

/**
 * Returns a function to open up the feedback form
 * Note: When calling `useRequestFeedback`, user/company must already be set.
 *
 * See https://github.com/bucketco/bucket-javascript-sdk/blob/main/packages/tracking-sdk/FEEDBACK.md#bucketrequestfeeback-options
 * for more information
 *
 * ```ts
 * const requestFeedback = useRequestFeedback();
 * bucket.requestFeedback({
 *   featureId: "bucket-feature-id",
 *   title: "How satisfied are you with file uploads?",
 * });
 * ```
 */
export function useRequestFeedback() {
  return useContext<BucketContext>(Context).requestFeedback;
}

/**
 * Returns a function to manually send feedback collected from a user.
 * Note: When calling `useSendFeedback`, user/company must already be set.
 *
 * See https://github.com/bucketco/bucket-javascript-sdk/blob/main/packages/tracking-sdk/FEEDBACK.md#using-your-own-ui-to-collect-feedback
 * for more information
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
  return useContext<BucketContext>(Context).sendFeedback;
}
