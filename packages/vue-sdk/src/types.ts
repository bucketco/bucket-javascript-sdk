import type { Ref } from "vue";

import type {
  InitOptions,
  ReflagClient,
  ReflagContext,
  RequestFeedbackData,
} from "@reflag/browser-sdk";

export type FeatureRemoteConfig =
  | { key: string; payload: any }
  | { key: undefined; payload: undefined };

export type RequestFlagFeedbackOptions = Omit<
  RequestFeedbackData,
  "featureKey" | "flagKey"
>;

export interface Feature {
  key: string;
  isEnabled: Ref<boolean>;
  isLoading: Ref<boolean>;
  config: Ref<FeatureRemoteConfig>;
  track(): Promise<Response | undefined> | undefined;
  requestFeedback: (opts: RequestFlagFeedbackOptions) => void;
}

export interface ProviderContextType {
  client: Ref<ReflagClient>;
  isLoading: Ref<boolean>;
  updatedCount: Ref<number>;
  provider: boolean;
}

/**
 * Props for the ReflagProvider component.
 */
export type ReflagProps = ReflagContext &
  InitOptions & {
    /**
     * Whether to enable debug mode.
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
