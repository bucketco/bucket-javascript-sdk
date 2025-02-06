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

import type { FeatureDefinitions } from "@bucketco/browser-sdk";
import {
  BucketClient,
  BucketContext,
  ConfigType,
  defineFeatures,
  FeatureKey as BaseFeatureKey,
  FeedbackOptions,
  RawFeatures,
  RequestFeedbackData,
  ToolbarOptions,
  UnassignedFeedback,
} from "@bucketco/browser-sdk";

import { version } from "../package.json";

export { defineFeatures, FeatureDefinitions };

export type FeaturesType<TFeatures extends FeatureDefinitions> = {
  [K in BaseFeatureKey<TFeatures>]: ConfigType<TFeatures, K>;
};

export interface Features {}

const SDK_VERSION = `react-sdk/${version}`;

type MaterializedFeatures = keyof Features extends never
  ? Record<string, any>
  : Features;

export type FeatureKey = keyof MaterializedFeatures;
export type FeatureConfig<TKey extends FeatureKey> =
  MaterializedFeatures[TKey] extends boolean
    ? never
    : MaterializedFeatures[TKey];

type ProviderContextType = {
  client?: BucketClient;
  features: {
    features: RawFeatures;
    isLoading: boolean;
  };
};

const ProviderContext = createContext<ProviderContextType>({
  features: {
    features: {},
    isLoading: false,
  },
});

export type BucketProps = BucketContext & {
  publishableKey: string;

  children?: ReactNode;
  loadingComponent?: ReactNode;
  feedback?: FeedbackOptions;

  apiBaseUrl?: string;
  appBaseUrl?: string;

  sseBaseUrl?: string;
  debug?: boolean;
  enableTracking?: boolean;

  features?: Readonly<FeatureDefinitions>;

  fallbackFeatures?: FeatureKey[] | Record<FeatureKey, any>;

  /**
   * Timeout in milliseconds when fetching features
   */
  timeoutMs?: number;

  /**
   * If set to true stale features will be returned while refetching features
   */
  staleWhileRevalidate?: boolean;

  /**
   * If set, features will be cached between page loads for this duration
   */
  expireTimeMs?: number;

  /**
   * Stale features will be returned if staleWhileRevalidate is true if no new features can be fetched
   */
  staleTimeMs?: number;

  toolbar?: ToolbarOptions;

  // for testing
  newBucketClient?: (
    ...args: ConstructorParameters<typeof BucketClient>
  ) => BucketClient;
};

export function BucketProvider({
  children,
  user,
  company,
  otherContext,
  publishableKey,
  loadingComponent,
  features,
  newBucketClient = (...args) => new BucketClient(...args),
  ...config
}: BucketProps) {
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [rawFeatures, setRawFeatures] = useState<RawFeatures>({});

  const clientRef = useRef<BucketClient>();
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

    const client = newBucketClient({
      publishableKey,
      user,
      company,
      otherContext,

      apiBaseUrl: config.apiBaseUrl,
      appBaseUrl: config.appBaseUrl,
      sseBaseUrl: config.sseBaseUrl,

      enableTracking: config.enableTracking,

      staleTimeMs: config.staleTimeMs,
      expireTimeMs: config.expireTimeMs,
      timeoutMs: config.timeoutMs,
      staleWhileRevalidate: config.staleWhileRevalidate,
      fallbackFeatures: config.fallbackFeatures,

      feedback: config.feedback,
      logger: config.debug ? console : undefined,
      sdkVersion: SDK_VERSION,
      features,
      toolbar: config.toolbar,
    });
    clientRef.current = client;

    client.onFeaturesUpdated(() => {
      setRawFeatures(client.getFeatures());
    });

    client
      .initialize()
      .catch((e) => {
        client.logger.error("failed to initialize client", e);
      })
      .finally(() => {
        setFeaturesLoading(false);
      });
  }, [contextKey]);

  const context: ProviderContextType = {
    features: {
      features: rawFeatures,
      isLoading: featuresLoading,
    },
    client: clientRef.current,
  };
  return (
    <ProviderContext.Provider
      children={
        featuresLoading && typeof loadingComponent !== "undefined"
          ? loadingComponent
          : children
      }
      value={context}
    />
  );
}

type RequestFeedbackOptions = Omit<
  RequestFeedbackData,
  "featureKey" | "featureId"
>;

type Feature<TKey extends FeatureKey> = {
  isEnabled: boolean;
  isLoading: boolean;
  config:
    | {
        key: string;
        payload: FeatureConfig<TKey>;
      }
    | {
        key: undefined;
        payload: undefined;
      };
  track: () => void;
  requestFeedback: (opts: RequestFeedbackOptions) => void;
};

/**
 * Returns the state of a given feature for the current context, e.g.
 *
 * ```ts
 * function HuddleButton() {
 *   const {isEnabled, config: { payload }, track} = useFeature("huddle");
 *   if (isEnabled) {
 *    return <button onClick={() => track()}>{payload?.buttonTitle ?? "Start Huddle"}</button>;
 * }
 * ```
 */
export function useFeature<TKey extends FeatureKey>(key: TKey): Feature<TKey> {
  const {
    features: { features, isLoading },
    client,
  } = useContext<ProviderContextType>(ProviderContext);

  const track = () => client?.track(key);
  const requestFeedback = (opts: RequestFeedbackOptions) =>
    client?.requestFeedback({ ...opts, featureKey: key });

  if (isLoading) {
    return {
      isLoading,
      isEnabled: false,
      config: { key: undefined, payload: undefined },
      track,
      requestFeedback,
    };
  }

  const feature = features[key];
  const enabled = feature?.isEnabledOverride ?? feature?.isEnabled ?? false;

  function sendCheckEvent() {
    client
      ?.sendCheckEvent({
        key,
        value: enabled,
        version: feature?.targetingVersion,
      })
      .catch(() => {
        // ignore
      });
  }

  const reducedConfig = feature?.config
    ? { key: feature.config.key, payload: feature.config.payload }
    : { key: undefined, payload: undefined };

  return {
    isLoading,
    track,
    requestFeedback,
    get isEnabled() {
      sendCheckEvent();
      return enabled;
    },
    get config() {
      sendCheckEvent();
      return reducedConfig;
    },
  };
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
  const { client } = useContext<ProviderContextType>(ProviderContext);
  return (eventName: string, attributes?: Record<string, any> | null) =>
    client?.track(eventName, attributes);
}

/**
 * Returns a function to open up the feedback form
 * Note: When calling `useRequestFeedback`, user/company must already be set.
 *
 * See [link](../../browser-sdk/FEEDBACK.md#bucketclientrequestfeedback-options) for more information
 *
 * ```ts
 * const requestFeedback = useRequestFeedback();
 * bucket.requestFeedback({
 *   featureKey: "file-uploads",
 *   title: "How satisfied are you with file uploads?",
 * });
 * ```
 */
export function useRequestFeedback() {
  const { client } = useContext<ProviderContextType>(ProviderContext);
  return (options: RequestFeedbackData<FeatureKey>) =>
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
  const { client } = useContext<ProviderContextType>(ProviderContext);
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
 * updateUser({ optInHuddles: "true" }).then(() => console.log("Features updated"));
 * ```
 */
export function useUpdateUser() {
  const { client } = useContext<ProviderContextType>(ProviderContext);
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
 * updateCompany({ plan: "enterprise" }).then(() => console.log("Features updated"));
 * ```
 */
export function useUpdateCompany() {
  const { client } = useContext<ProviderContextType>(ProviderContext);
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
 *   .then(() => console.log("Features updated"));
 * ```
 */
export function useUpdateOtherContext() {
  const { client } = useContext<ProviderContextType>(ProviderContext);
  return (opts: { [key: string]: string | number | undefined }) =>
    client?.updateOtherContext(opts);
}
