import type { Ref } from "vue";

import type {
  InitOptions,
  ReflagClient,
  ReflagContext,
  RequestFeedbackData,
} from "@reflag/browser-sdk";

export type EmptyFeatureRemoteConfig = { key: undefined; payload: undefined };

export type FeatureType = {
  config?: {
    payload: any;
  };
};

export type FeatureRemoteConfig =
  | {
      key: string;
      payload: any;
    }
  | EmptyFeatureRemoteConfig;

export interface Feature<
  TConfig extends FeatureType["config"] = EmptyFeatureRemoteConfig,
> {
  key: string;
  isEnabled: Ref<boolean>;
  isLoading: Ref<boolean>;
  config: Ref<({ key: string } & TConfig) | EmptyFeatureRemoteConfig>;
  track(): Promise<Response | undefined> | undefined;
  requestFeedback: (opts: RequestFeatureFeedbackOptions) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Features {}

export type TypedFeatures = keyof Features extends never
  ? Record<string, Feature>
  : {
      [TypedFeatureKey in keyof Features]: Features[TypedFeatureKey] extends FeatureType
        ? Feature<Features[TypedFeatureKey]["config"]>
        : Feature;
    };

export type FeatureKey = keyof TypedFeatures;

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

export type RequestFeatureFeedbackOptions = Omit<
  RequestFeedbackData,
  "featureKey" | "featureId"
>;
