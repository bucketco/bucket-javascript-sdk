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
  Feedback,
  FeedbackOptions,
  RequestFeedbackData,
} from "@bucketco/browser-sdk";
import { APIFeaturesResponse } from "@bucketco/browser-sdk/dist/src/feature/features";

import { version } from "../package.json";

export interface Features {}

const SDK_VERSION = `react-sdk/${version}`;

type BucketFeatures = keyof (keyof Features extends never
  ? Record<string, boolean>
  : Features);

type ProviderContextType = {
  client?: BucketClient;
  features: {
    features: APIFeaturesResponse;
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
    fallbackFeatures?: BucketFeatures[];
  };
  children?: ReactNode;
  loadingComponent?: ReactNode;
  feedback?: FeedbackOptions;
  host?: string;
  sseHost?: string;
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
  const [features, setFeatures] = useState<APIFeaturesResponse>({});

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

    // on update of contextKey and on mount
    if (clientRef.current) {
      void clientRef.current.stop();
    }

    const client = newBucketClient({
      publishableKey,
      user,
      company,
      otherContext,
      host: config.host,
      sseHost: config.sseHost,

      enableTracking: config.enableTracking,

      features: {
        ...featureOptions,
      },
      feedback: config.feedback,
      logger: config.debug ? console : undefined,
      sdkVersion: SDK_VERSION,
    });
    clientRef.current = client;
    client
      .initialize()
      .then(() => {
        setFeatures(client.getFeatures());
        setFeaturesLoading(false);
      })
      .catch(() => {
        // initialize cannot actually throw, but this fixes lint warnings
      });

    // on umount
    return () => void client.stop();
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
export function useFeature(key: BucketFeatures) {
  const {
    features: { features, isLoading },
    client,
  } = useContext<ProviderContextType>(ProviderContext);

  const track = () => client?.track(key);

  if (isLoading) {
    return {
      isLoading,
      isEnabled: false,
      track,
    };
  }

  const feature = features[key];
  const enabled = feature?.isEnabled ?? false;

  return {
    isLoading,
    track,
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
  const { client } = useContext<ProviderContextType>(ProviderContext);
  return (options: RequestFeedbackData) => client?.requestFeedback(options);
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
  const { client } = useContext<ProviderContextType>(ProviderContext);
  return (opts: Omit<Feedback, "userId" | "companyId">) =>
    client?.feedback(opts as Feedback);
}
