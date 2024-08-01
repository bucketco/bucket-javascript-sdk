import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import canonicalJSON from "canonical-json";

import {
  BucketClient,
  BucketContext,
  CompanyContext,
  Feedback,
  FeedbackOptions,
  FlagsOptions,
  RequestFeedbackOptions,
  UserContext,
} from "@bucketco/browser-sdk";

type OtherContext = Record<string, any>;

export interface Flags {}

type BucketFlags = keyof (keyof Flags extends never
  ? Record<string, boolean>
  : Flags);

export type FlagsResult = { [k in BucketFlags]?: boolean };

type ProviderContextType = {
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

const ProviderContext = createContext<ProviderContextType>({
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

export type BucketProps = BucketContext & {
  publishableKey: string;
  flagOptions?: Omit<FlagsOptions, "fallbackFlags"> & {
    fallbackFlags?: BucketFlags[];
  };
  children?: ReactNode;
  loadingComponent?: ReactNode;
  feedback?: FeedbackOptions;
  host?: string;
  sseHost?: string;
  debug?: boolean;
};

export function BucketProvider({
  children,
  user: initialUser,
  company: initialCompany,
  otherContext: initialOtherContext,
  publishableKey,
  flagOptions,
  loadingComponent,
  ...config
}: BucketProps) {
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [flags, setFlags] = useState<FlagsResult>({});
  const ref = useRef<BucketClient>();

  const [flagContext, setFlagContext] = useState({
    user: initialUser,
    company: initialCompany,
    otherContext: initialOtherContext,
  });
  const { user, company } = flagContext;

  const contextKey = canonicalJSON({ config, flagContext });

  useEffect(() => {
    // on update of contextKey and on mount
    if (ref.current) {
      ref.current.stop();
    }

    const client = new BucketClient(publishableKey, flagContext, {
      host: config.host,
      sseHost: config.sseHost,
      flags: {
        ...flagOptions,
      },
      feedback: config.feedback,
      logger: config.debug ? console : undefined,
    });
    ref.current = client;
    client
      .initialize()
      .then(() => {
        setFlags(client.getFlags() ?? {});
        setFlagsLoading(false);

        // update user attributes
        const { id: userId, ...userAttributes } = flagContext.user || {};
        if (userId) {
          client.user(userAttributes).catch(() => {
            // ignore rejections. Logged inside
          });
        }

        // update company attributes
        const { id: companyId, ...companyAttributes } =
          flagContext.company || {};

        if (companyId) {
          client.company(companyAttributes).catch(() => {
            // ignore rejections. Logged inside
          });
        }
      })
      .catch(() => {
        // initialize cannot actually throw, but this fixes lint warnings
      });

    // on umount
    return () => client.stop();
  }, [contextKey]);

  // call updateUser with no arguments to logout
  const updateUser = useCallback((newUser?: UserContext) => {
    setFlagContext({ ...flagContext, user: newUser });
  }, []);

  // call updateUser with no arguments to re-set company context
  const updateCompany = useCallback((newCompany?: CompanyContext) => {
    setFlagContext({ ...flagContext, company: newCompany });
  }, []);

  const updateOtherContext = useCallback((otherContext?: OtherContext) => {
    setFlagContext({ ...flagContext, otherContext });
  }, []);

  const track = useCallback(
    (eventName: string, attributes?: Record<string, any>) => {
      if (user?.id === undefined)
        return () => {
          console.error("User is required to send events");
        };

      return ref.current?.track(eventName, attributes);
    },
    [user?.id, company?.id],
  );

  const sendFeedback = useCallback(
    (opts: Omit<Feedback, "userId" | "companyId">) => {
      if (user?.id === undefined) {
        console.error("User is required to request feedback");
        return;
      }

      return ref.current?.feedback({
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

      ref.current?.requestFeedback({
        ...opts,
        userId: String(user.id),
        companyId: company?.id !== undefined ? String(company.id) : undefined,
      });
    },
    [user?.id, company?.id],
  );

  const context: ProviderContextType = {
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

  return <ProviderContext.Provider children={children} value={context} />;
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
  const { flags } = useContext<ProviderContextType>(ProviderContext).flags;
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
  const { flags, isLoading } =
    useContext<ProviderContextType>(ProviderContext).flags;

  const isEnabled = flags[key] ?? false;

  return { isLoading: isLoading, isEnabled };
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
  const { flags, isLoading } =
    useContext<ProviderContextType>(ProviderContext).flags;

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
  } = useContext<ProviderContextType>(ProviderContext);
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
  const ctx = useContext<ProviderContextType>(ProviderContext);
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
  return useContext<ProviderContextType>(ProviderContext).requestFeedback;
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
  return useContext<ProviderContextType>(ProviderContext).sendFeedback;
}
