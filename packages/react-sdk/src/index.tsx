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
  InitOptions,
  RawFeatures,
  RequestFeedbackData,
  UnassignedFeedback,
} from "@bucketco/browser-sdk";

import { version } from "../package.json";

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
  provider: boolean;
};

const ProviderContext = createContext<ProviderContextType>({
  features: {
    features: {},
    isLoading: false,
  },
  provider: false,
});

/**
 * Props for the BucketProvider.
 */
export type BucketProps = BucketContext &
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
     * New BucketClient constructor.
     *
     * @internal
     */
    newBucketClient?: (
      ...args: ConstructorParameters<typeof BucketClient>
    ) => BucketClient;
  };

/**
 * Provider for the BucketClient.
 */
export function BucketProvider({
  children,
  user,
  company,
  otherContext,
  loadingComponent,
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
      ...config,
      user,
      company,
      otherContext,

      logger: config.debug ? console : undefined,
      sdkVersion: SDK_VERSION,
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
    provider: true,
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
    features: { isLoading },
    client,
    provider,
  } = useContext<ProviderContextType>(ProviderContext);
  ensureProvider(provider);

  const track = () => client?.track(key);
  const requestFeedback = (opts: RequestFeedbackOptions) =>
    client?.requestFeedback({ ...opts, featureKey: key });

  if (isLoading || !client) {
    return {
      isLoading,
      isEnabled: false,
      config: { key: undefined, payload: undefined },
      track,
      requestFeedback,
    };
  }

  const feature = client.getFeature(key);

  return {
    isLoading,
    track,
    requestFeedback,
    get isEnabled() {
      return feature.isEnabled ?? false;
    },
    get config() {
      return feature.config ?? { key: undefined, payload: undefined };
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
  const { client, provider } = useContext<ProviderContextType>(ProviderContext);
  ensureProvider(provider);
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
 *   featureId: "bucket-feature-id",
 *   title: "How satisfied are you with file uploads?",
 * });
 * ```
 */
export function useRequestFeedback() {
  const { client, provider } = useContext<ProviderContextType>(ProviderContext);
  ensureProvider(provider);
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
  const { client, provider } = useContext<ProviderContextType>(ProviderContext);
  ensureProvider(provider);
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
  const { client, provider } = useContext<ProviderContextType>(ProviderContext);
  ensureProvider(provider);
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
  const { client, provider } = useContext<ProviderContextType>(ProviderContext);
  ensureProvider(provider);

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
  const { client, provider } = useContext<ProviderContextType>(ProviderContext);
  ensureProvider(provider);
  return (opts: { [key: string]: string | number | undefined }) =>
    client?.updateOtherContext(opts);
}

function ensureProvider(provider: boolean) {
  if (!provider) {
    throw new Error(
      "BucketProvider is missing. Please ensure your component is wrapped with a BucketProvider.",
    );
  }
}
