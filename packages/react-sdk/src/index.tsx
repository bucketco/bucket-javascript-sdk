"use client";

import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import canonicalJSON from "canonical-json";

import {
  CheckEvent,
  CompanyContext,
  Flag,
  InitOptions,
  RawFlags,
  ReflagClient,
  ReflagContext,
  RequestFeedbackData,
  TrackEvent,
  UnassignedFeedback,
  UserContext,
} from "@reflag/browser-sdk";

import { version } from "../package.json";

export type { CheckEvent, CompanyContext, RawFlags, TrackEvent, UserContext };

type EmptyFeatureRemoteConfig = { key: undefined; payload: undefined };

/**
 * @internal
 *
 * Describes a feature with a remote config.
 */
export type FeatureWithRemoteConfigType = {
  config?: {
    payload: any;
  };
};

/**
 * @deprecated
 * A remotely managed configuration value for a flag.
 */
export type FeatureRemoteConfig =
  | {
      /**
       * The key of the matched configuration value.
       */
      key: string;

      /**
       * The optional user-supplied payload data.
       */
      payload: any;
    }
  | EmptyFeatureRemoteConfig;

/**
 * @deprecated
 *
 * Describes a feature.
 */
export interface Feature<
  TConfig extends
    FeatureWithRemoteConfigType["config"] = EmptyFeatureRemoteConfig,
> {
  /**
   * The key of the flag.
   */
  key: string;

  /**
   * If the flag is enabled.
   */
  isEnabled: boolean;

  /**
   * If the flag is loading.
   */
  isLoading: boolean;

  /*
   * Optional user-defined configuration.
   */
  config:
    | ({
        key: string;
      } & TConfig)
    | EmptyFeatureRemoteConfig;

  /**
   * Track flag usage in Reflag.
   */
  track(): Promise<Response | undefined> | undefined;
  /**
   * Request feedback from the user.
   */
  requestFeedback: (opts: RequestFeedbackOptions) => void;
}

/**
 * @deprecated
 * Use `Flags` instead.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Features {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Flags extends Features {}

/**
 * @deprecated
 * Describes a collection of evaluated flags.
 *
 * @remarks
 * This types falls back to a generic Record<string, Flag> if the Flags interface
 * has not been extended.
 */
export type TypedFeatures = keyof Flags extends never
  ? Record<string, Feature>
  : {
      [TKey in keyof Flags]: Flags[TKey] extends FeatureWithRemoteConfigType
        ? Feature<Flags[TKey]["config"]>
        : Feature;
    };

/**
 * @deprecated
 * Use `FlagKey` instead.
 */
export type FeatureKey = keyof TypedFeatures;

/**
 * Describes a collection of evaluated flags.
 *
 * @remarks
 * This types falls back to a generic Record<string, Flag> if the Flags interface
 * has not been extended.
 */
export type TypedFlags = keyof Flags extends never
  ? Record<string, Flag>
  : {
      [TKey in keyof Flags]: Flags[TKey] extends FeatureWithRemoteConfigType
        ? Flags[TKey]["config"] & { key: TKey }
        : boolean;
    };

/**
 * The key of a flag.
 */
export type FlagKey = keyof TypedFlags;

const SDK_VERSION = `react-sdk/${version}`;

type ProviderContextType = {
  client?: ReflagClient;
  flags: {
    flags: RawFlags;
    isLoading: boolean;
  };
  provider: boolean;
};

const ProviderContext = createContext<ProviderContextType>({
  flags: {
    flags: {},
    isLoading: false,
  },
  provider: false,
});

/**
 * Props for the ReflagProvider.
 */
export type ReflagProps = ReflagContext &
  InitOptions & {
    /**
     * Children to be rendered.
     */
    children?: ReactNode;

    /**
     * Loading component to be rendered while features are loading.
     */
    loadingComponent?: ReactNode;

    /**
     * Whether to enable debug mode (optional).
     */
    debug?: boolean;

    /**
     * @deprecated
     * New ReflagClient constructor. Use `newReflagClient` instead.
     *
     * @internal
     */
    newBucketClient?: (
      ...args: ConstructorParameters<typeof ReflagClient>
    ) => ReflagClient;

    /**
     * New ReflagClient constructor.
     *
     * @internal
     */
    newReflagClient?: (
      ...args: ConstructorParameters<typeof ReflagClient>
    ) => ReflagClient;
  };

/**
 * Provider for the ReflagClient.
 */
export function ReflagProvider({
  children,
  user,
  company,
  otherContext,
  loadingComponent,
  newBucketClient,
  newReflagClient = (...args) => new ReflagClient(...args),
  ...config
}: ReflagProps) {
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [rawFlags, setRawFlags] = useState<RawFlags>({});

  const clientRef = useRef<ReflagClient>();
  const contextKeyRef = useRef<string>();

  const featureContext = { user, company, otherContext };
  const contextKey = canonicalJSON({ config, featureContext });

  useEffect(() => {
    // useEffect will run twice in development mode
    // This is a workaround to prevent re-initialization
    if (contextKeyRef.current === contextKey) {
      return;
    }
    contextKeyRef.current = contextKey;

    // on update of contextKey and on unmount
    if (clientRef.current) {
      void clientRef.current.stop();
    }

    setFlagsLoading(true);

    // Deprecated, compatibility with Bucket SDK
    const newClient = newBucketClient ?? newReflagClient;

    const client = newClient({
      ...config,
      user,
      company,
      otherContext,

      logger: config.debug ? console : undefined,
      sdkVersion: SDK_VERSION,
    });

    clientRef.current = client;

    client.on("flagsUpdated", setRawFlags);

    client
      .initialize()
      .catch((e) => {
        client.logger.error("failed to initialize client", e);
      })
      .finally(() => {
        setFlagsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- should only run once
  }, [contextKey]);

  const context: ProviderContextType = {
    flags: {
      flags: rawFlags,
      isLoading: flagsLoading,
    },
    client: clientRef.current,
    provider: true,
  };
  return (
    <ProviderContext.Provider value={context}>
      {flagsLoading && typeof loadingComponent !== "undefined"
        ? loadingComponent
        : children}
    </ProviderContext.Provider>
  );
}

/**
 * @deprecated
 * Use `ReflagProvider` instead.
 */
export const BucketProvider = ReflagProvider;

type RequestFeedbackOptions = Omit<
  RequestFeedbackData,
  "featureKey" | "flagKey"
>;

/**
 * @deprecated
 * Use `useFlag` instead.
 *
 * Returns the state of a given flag for the current context, e.g.
 *
 * ```ts
 * function HuddleButton() {
 *   const {isEnabled, config: { payload }, track} = useFlag("huddle");
 *   if (isEnabled) {
 *    return <button onClick={() => track()}>{payload?.buttonTitle ?? "Start Huddle"}</button>;
 * }
 * ```
 */
export function useFeature<TKey extends FeatureKey>(
  flagKey: TKey,
): TypedFeatures[TKey] {
  const client = useClient();
  const {
    flags: { isLoading },
  } = useContext<ProviderContextType>(ProviderContext);

  const track = () => client?.track(flagKey);
  const requestFeedback = (opts: RequestFeedbackOptions) =>
    client?.requestFeedback({ ...opts, flagKey });

  if (isLoading || !client) {
    return {
      key: flagKey,
      isLoading,
      isEnabled: false,
      config: {
        key: undefined,
        payload: undefined,
      } as TypedFeatures[TKey]["config"],
      track,
      requestFeedback,
    };
  }

  const flag = client.getFeature(flagKey);

  return {
    key: flagKey,
    isLoading,
    track,
    requestFeedback,
    get isEnabled() {
      return flag.isEnabled ?? false;
    },
    get config() {
      return flag.config as TypedFeatures[TKey]["config"];
    },
  };
}

/**
 * Returns the state of a given flag for the current context, e.g.
 *
 * ```ts
 * function HuddleButton() {
 *   const enabled = useFlag("huddle");
 *
 *   if (enabled) {
 *    return <button onClick={() => alert("Huddle started")}>Start Huddle</button>;
 * }
 * ```
 */
export function useFlag<TKey extends FlagKey>(
  flagKey: TKey,
): TypedFlags[TKey] | undefined {
  const client = useClient();

  if (!client) {
    return undefined;
  }

  return client.getFlag(flagKey) as TypedFlags[TKey];
}

/**
 * Returns a boolean indicating whether the flags are loading.
 *
 * ```ts
 * const isLoading = useIsLoading();
 * if (isLoading) {
 *   return <div>Loading...</div>;
 * }
 * ```
 */
export function useIsLoading() {
  const {
    flags: { isLoading },
  } = useContext<ProviderContextType>(ProviderContext);

  return isLoading;
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
  const client = useClient();
  return (eventName: string, attributes?: Record<string, any> | null) =>
    client?.track(eventName, attributes);
}

type TypedRequestFeedbackData = Omit<
  RequestFeedbackData,
  "featureKey" | "flagKey"
> &
  (
    | {
        flagKey: FlagKey;
      }
    | {
        /**
         * @deprecated
         * Use `flagKey` instead.
         */
        featureKey: FlagKey;
      }
  );

/**
 * Returns a function to open up the feedback form
 * Note: When calling `useRequestFeedback`, user/company must already be set.
 *
 * See [link](../../browser-sdk/FEEDBACK.md#reflagclientrequestfeedback-options) for more information
 *
 * ```ts
 * const requestFeedback = useRequestFeedback();
 * reflag.requestFeedback({
 *   featureKey: "file-uploads",
 *   title: "How satisfied are you with file uploads?",
 * });
 * ```
 */
export function useRequestFeedback() {
  const client = useClient();

  return (options: TypedRequestFeedbackData) =>
    client?.requestFeedback(options);
}

/**
 * Returns a function to manually send feedback collected from a user.
 * Note: When calling `useSendFeedback`, user/company must already be set.
 *
 * See [link](./../../browser-sdk/FEEDBACK.md#using-your-own-ui-to-collect-feedback) for more information
 *
 * ```ts
 * const sendFeedback = useSendFeedback();
 * sendFeedback({
 *   featureKey: "huddle";
 *   question: "How did you like the new huddle feature?";
 *   score: 5;
 *   comment: "I loved it!";
 * });
 * ```
 */
export function useSendFeedback() {
  const client = useClient();
  return (opts: UnassignedFeedback) => client?.feedback(opts);
}

/**
 * Returns a function to update the current user's information.
 * For example, if the user changed role or opted into a beta-feature.
 *
 * The method returned is a function which returns a promise that
 * resolves when after the features have been updated as a result
 * of the user update.
 *
 * ```ts
 * const updateUser = useUpdateUser();
 * updateUser({ optInHuddles: "true" }).then(() => console.log("Flags updated"));
 * ```
 */
export function useUpdateUser() {
  const client = useClient();
  return (opts: { [key: string]: string | number | undefined }) =>
    client?.updateUser(opts);
}

/**
 * Returns a function to update the current company's information.
 * For example, if the company changed plan or opted into a beta-feature.
 *
 * The method returned is a function which returns a promise that
 * resolves when after the features have been updated as a result
 * of the company update.
 *
 * ```ts
 * const updateCompany = useUpdateCompany();
 * updateCompany({ plan: "enterprise" }).then(() => console.log("Flags updated"));
 * ```
 */
export function useUpdateCompany() {
  const client = useClient();

  return (opts: { [key: string]: string | number | undefined }) =>
    client?.updateCompany(opts);
}

/**
 * Returns a function to update the "other" context information.
 * For example, if the user changed workspace, you can set the workspace id here.
 *
 * The method returned is a function which returns a promise that
 * resolves when after the features have been updated as a result
 * of the update to the "other" context.
 *
 * ```ts
 * const updateOtherContext = useUpdateOtherContext();
 * updateOtherContext({ workspaceId: newWorkspaceId })
 *   .then(() => console.log("Flags updated"));
 * ```
 */
export function useUpdateOtherContext() {
  const client = useClient();
  return (opts: { [key: string]: string | number | undefined }) =>
    client?.updateOtherContext(opts);
}

/**
 * Returns the current `ReflagClient` used by the `ReflagProvider`.
 *
 * This is useful if you need to access the `ReflagClient` outside of the `ReflagProvider`.
 *
 * ```ts
 * const client = useClient();
 * useEffect(() => {
 *   return client?.on("check", () => {
 *     console.log("check hook called");
 *   });
 * }, [client]);
 * ```
 */
export function useClient() {
  const { client, provider } = useContext<ProviderContextType>(ProviderContext);
  if (!provider) {
    throw new Error(
      "ReflagProvider is missing. Please ensure your component is wrapped with a ReflagProvider.",
    );
  }

  return client;
}
