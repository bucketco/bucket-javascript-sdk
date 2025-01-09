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
  BucketClient,
  BucketContext,
  FeaturesOptions,
  FeedbackOptions,
  RawFeatures,
  RequestFeedbackData,
  UnassignedFeedback,
} from "@bucketco/browser-sdk";

import { version } from "../package.json";

export interface Features {}

const SDK_VERSION = `react-sdk/${version}`;

export type FeatureKey = keyof (keyof Features extends never
  ? Record<string, boolean>
  : Features);

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
  featureOptions?: Omit<FeaturesOptions, "fallbackFeatures"> & {
    fallbackFeatures?: FeatureKey[];
  };
  children?: ReactNode;
  loadingComponent?: ReactNode;
  feedback?: FeedbackOptions;
  /**
   * @deprecated
   * Use `apiBaseUrl` instead.
   */
  host?: string;
  apiBaseUrl?: string;

  /**
   * @deprecated
   * Use `sseBaseUrl` instead.
   */
  sseHost?: string;
  sseBaseUrl?: string;
  debug?: boolean;
  enableTracking?: boolean;

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
  featureOptions,
  loadingComponent,
  newBucketClient = (...args) => new BucketClient(...args),
  ...config
}: BucketProps) {
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [features, setFeatures] = useState<RawFeatures>({});

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

      host: config.host,
      apiBaseUrl: config.apiBaseUrl,
      sseHost: config.sseHost,
      sseBaseUrl: config.sseBaseUrl,

      enableTracking: config.enableTracking,

      features: {
        ...featureOptions,
      },
      feedback: config.feedback,
      logger: config.debug ? console : undefined,
      sdkVersion: SDK_VERSION,
    });
    clientRef.current = client;

    client.onFeaturesUpdated(() => {
      setFeatures(client.getFeatures());
    });

    client
      .initialize()
      .then(() => {
        setFeaturesLoading(false);
      })
      .catch(() => {
        // initialize cannot actually throw, but this fixes lint warnings
      });
  }, [contextKey]);

  const context: ProviderContextType = {
    features: {
      features,
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

/**
 * Returns the state of a given feature for the current context, e.g.
 *
 * ```ts
 * function HuddleButton() {
 *   const {isEnabled, track} = useFeature("huddle");
 *   if (isEnabled) {
 *    return <button onClick={() => track()}>Start Huddle</button>;
 *   }
 * }
 * ```
 */
export function useFeature(key: FeatureKey) {
  const {
    features: { features, isLoading },
    client,
  } = useContext<ProviderContextType>(ProviderContext);

  const track = () => client?.track(key);
  const requestFeedback = (
    opts: Omit<RequestFeedbackData, "featureKey" | "featureId">,
  ) => client?.requestFeedback({ ...opts, featureKey: key });

  if (isLoading) {
    return {
      isLoading,
      isEnabled: false,
      track,
      requestFeedback,
    };
  }

  const feature = features[key];
  const enabled = feature?.isEnabled ?? false;

  return {
    isLoading,
    track,
    requestFeedback,
    get isEnabled() {
      client
        ?.sendCheckEvent({
          key,
          value: enabled,
          version: feature?.targetingVersion,
        })
        .catch(() => {
          // ignore
        });
      return enabled;
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
 * See [link](../../browser-sdk/FEEDBACK.md#bucketclient.requestfeedback-options) for more information
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
  const { client } = useContext<ProviderContextType>(ProviderContext);
  return (options: RequestFeedbackData) => client?.requestFeedback(options);
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
 *   featureId: "fe2323223";;
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
 *
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
 */
export function useUpdateOtherContext() {
  const { client } = useContext<ProviderContextType>(ProviderContext);
  return (opts: { [key: string]: string | number | undefined }) =>
    client?.updateOtherContext(opts);
}
