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
  };
  updateUser: (user: UserContext) => void;
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
  updateUser: () => {},
  updateCompany: () => {},
  updateOtherContext: () => {},
  track: () => {},
  sendFeedback: () => {},
  requestFeedback: () => {},
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

export type Flags = { [k in BucketFlags]?: boolean };

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
  const [flags, setFlags] = useState<Flags>(
    (flagOptions?.fallbackFlags ?? []).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Flags),
  );
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [bucket] = useState(() => sdk ?? BucketSingleton);

  const [user, updateUser] = useState(initialUser);
  const [company, updateCompany] = useState(initialCompany);
  const [otherContext, updateOtherContext] = useState(initialOtherContext);

  useEffect(() => {
    // on mount
    bucket.init(publishableKey, config);
    // on umount
    return () => bucket.reset();
  }, []);

  // if user.id or attributes change, send new attributes to the servers
  useEffect(() => {
    if (user?.id) {
      const { id, ...attributes } = user;
      // `user` calls bucket.reset() automatically when needed
      bucket.user(String(id), attributes);
    } else {
      // logout
      bucket.reset();
    }
  }, [canonicalJSON({ user })]);

  useEffect(() => {
    if (company?.id) {
      const { id, ...attributes } = company;
      bucket.company(
        String(id),
        attributes,
        user?.id !== undefined ? String(user?.id) : undefined,
      );
    }
  }, [canonicalJSON({ company })]);

  // fetch flags
  const flagContext = { user, company, otherContext };
  const contextKey = canonicalJSON({ config, flagContext });
  useEffect(() => {
    try {
      const { fallbackFlags, ...flagOptionsRest } = flagOptions || {};

      setFlagsLoading(true);

      bucket
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

      bucket.feedback({
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
    flags,
  };
}

/**
 * Returns a function to update the current company
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
  const { updateUser, updateCompany, updateOtherContext } =
    useContext<BucketContext>(Context);
  return { updateUser, updateCompany, updateOtherContext };
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
