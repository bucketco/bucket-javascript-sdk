"use client";

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
  FeaturesOptions,
  Feedback,
  FeedbackOptions,
  RequestFeedbackOptions,
} from "@bucketco/browser-sdk";

import { version } from "../package.json";

export interface Features {}

const SDK_VERSION = `react-sdk/${version}`;

type BucketFeatures = keyof (keyof Features extends never
  ? Record<string, boolean>
  : Features);

export type FeaturesResult = { [k in BucketFeatures]?: boolean };

type ProviderContextType = {
  features: {
    features: FeaturesResult;
    isLoading: boolean;
  };

  sendFeedback: (opts: Omit<Feedback, "userId" | "companyId">) => void;
  requestFeedback: (
    opts: Omit<RequestFeedbackOptions, "userId" | "companyId">,
  ) => void;

  track: (eventName: string, attributes?: Record<string, any>) => void;
};

const ProviderContext = createContext<ProviderContextType>({
  features: {
    features: {},
    isLoading: false,
  },

  track: () => undefined,
  sendFeedback: () => undefined,
  requestFeedback: () => undefined,
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
  const [features, setFeatures] = useState<FeaturesResult>({});

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

    const client = newBucketClient(publishableKey, featureContext, {
      host: config.host,
      sseHost: config.sseHost,
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
        setFeatures(client.getFeatures() ?? {});
        setFeaturesLoading(false);

        // update user attributes
        const { id: userId, ...userAttributes } = featureContext.user || {};
        if (userId) {
          client.user(userAttributes).catch(() => {
            // ignore rejections. Logged inside
          });
        }

        // update company attributes
        const { id: companyId, ...companyAttributes } =
          featureContext.company || {};

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
    return () => void client.stop();
  }, [contextKey]);

  const track = useCallback(
    (eventName: string, attributes?: Record<string, any>) => {
      if (user?.id === undefined)
        return () => {
          console.error("User is required to send events");
        };

      return clientRef.current?.track(eventName, attributes);
    },
    [user?.id, company?.id],
  );

  const sendFeedback = useCallback(
    (opts: Omit<Feedback, "userId" | "companyId">) => {
      if (user?.id === undefined) {
        console.error("User is required to request feedback");
        return;
      }

      return clientRef.current?.feedback({
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

      clientRef.current?.requestFeedback({
        ...opts,
        userId: String(user.id),
        companyId: company?.id !== undefined ? String(company.id) : undefined,
      });
    },
    [user?.id, company?.id],
  );

  const context: ProviderContextType = {
    features: {
      features,
      isLoading: featuresLoading,
    },
    track,

    sendFeedback,
    requestFeedback,
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
    track,
  } = useContext<ProviderContextType>(ProviderContext);

  const isEnabled = features[key] ?? false;

  return { isLoading: isLoading, isEnabled, track: () => track(key) };
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
