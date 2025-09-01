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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Flags {}

type MultiVariateFlagSignature = {
  payload: any;
};

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
      [TKey in keyof Flags]: Flags[TKey] extends MultiVariateFlagSignature
        ? {
            key: string;
            payload: Flags[TKey]["payload"];
          }
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
     * New `ReflagClient` constructor.
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

    const client = newReflagClient({
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
 * Returns the value of a given flag for the current context, e.g.:
 *
 * ```ts
 * // For "toggle" flags
 * function HuddleButton() {
 *   const enabled = useFlag("huddle");
 *
 *   if (enabled) {
 *    return <button onClick={() => alert("Huddle started")}>Start Huddle</button>;
 * }
 *
 * // For "multi-variate" flags
 * function HuddleButton() {
 *   const { key, payload } = useFlag("huddle");
 *
 *   if (key === "full-mode") {
 *    return <button onClick={() => alert("Huddle started")}>Start Huddle</button>;
 *   }
 *
 *   return null;
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
    client,
  } = useContext<ProviderContextType>(ProviderContext);

  return isLoading || !client;
}

/**
 * Returns a function to send a track event when a user performs an action.
 * Note: When calling `useTrack`, user/company must already be set.
 *
 * ```ts
 * const track = useTrack("huddle");
 * track({ button: "cta" });
 * ```
 */
export function useTrack<TKey extends FlagKey>(flagKey: TKey) {
  const client = useClient();

  return (attributes?: Record<string, any> | null) =>
    client?.track(flagKey, attributes);
}

/**
 * Returns a function to send a custom track event when a user performs an action.
 * Note: When calling `useTrackCustom`, user/company must already be set.
 *
 * ```ts
 * const track = useTrackCustom("Custom Event");
 * track({ button: "cta" });
 * ```
 */
export function useTrackCustom(event: string) {
  const client = useClient();

  return (attributes?: Record<string, any> | null) =>
    client?.track(event, attributes);
}

/**
 * Returns a function to open up the feedback form.
 *
 * Note: When calling `useRequestFeedback`, user/company must already be set.
 *
 * See [link](../../browser-sdk/FEEDBACK.md#reflagclientrequestfeedback-options) for more information.
 *
 * ```ts
 * const requestFeedback = useRequestFeedback("huddle");
 * reflag.requestFeedback({
 *   title: "How satisfied are you with file uploads?",
 * });
 * ```
 */
export function useRequestFeedback<TKey extends FlagKey>(flagKey: TKey) {
  const client = useClient();

  return (options: Omit<RequestFeedbackData, "flagKey">) =>
    client?.requestFeedback({ ...options, flagKey });
}

/**
 * Returns a function to manually send feedback collected from a user.
 * Note: When calling `useSendFeedback`, user/company must already be set.
 *
 * See [link](./../../browser-sdk/FEEDBACK.md#using-your-own-ui-to-collect-feedback) for more information
 *
 * ```ts
 * const sendFeedback = useSendFeedback("huddle");
 * sendFeedback({
 *   question: "How did you like the new huddle feature?";
 *   score: 5;
 *   comment: "I loved it!";
 * });
 * ```
 */
export function useSendFeedback<TKey extends FlagKey>(flagKey: TKey) {
  const client = useClient();

  return (opts: Omit<UnassignedFeedback, "flagKey" | "feedbackId">) =>
    client?.feedback({ ...opts, flagKey });
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
