import canonicalJson from "canonical-json";
import {
  App,
  defineComponent,
  inject,
  InjectionKey,
  onBeforeUnmount,
  provide,
  Ref,
  ref,
  type SetupContext,
  shallowRef,
  watch,
} from "vue";

import {
  BucketClient,
  BucketContext,
  CheckEvent,
  CompanyContext,
  InitOptions,
  RawFeatures,
  RequestFeedbackData,
  TrackEvent,
  UnassignedFeedback,
  UserContext,
} from "@bucketco/browser-sdk";

import { version } from "../package.json";

export type {
  CheckEvent,
  CompanyContext,
  RawFeatures,
  TrackEvent,
  UserContext,
};

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
  config: ({ key: string } & TConfig) | EmptyFeatureRemoteConfig;
  track(): Promise<Response | undefined> | undefined;
  requestFeedback: (opts: RequestFeedbackOptions) => void;
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

const SDK_VERSION = `vue-sdk/${version}`;

interface ProviderContextType {
  client: Ref<BucketClient>;
  isLoading: Ref<boolean>;
  updatedCount: Ref<number>;
  provider: boolean;
}

const ProviderSymbol: InjectionKey<ProviderContextType> =
  Symbol("BucketProvider");

export type BucketProps = BucketContext &
  InitOptions & {
    debug?: boolean;
    newBucketClient?: (
      ...args: ConstructorParameters<typeof BucketClient>
    ) => BucketClient;
  };

export const BucketProvider = defineComponent({
  name: "BucketProvider",
  props: {
    publishableKey: { type: String, required: true },
    user: { type: Object as () => UserContext | undefined, default: undefined },
    company: {
      type: Object as () => CompanyContext | undefined,
      default: undefined,
    },
    otherContext: {
      type: Object as () => Record<string, any> | undefined,
      default: undefined,
    },
    loadingComponent: { type: null as any, default: undefined },
    debug: { type: Boolean, default: false },
    newBucketClient: {
      type: Function as unknown as () => BucketProps["newBucketClient"],
      default: undefined,
    },
  },
  setup(props: BucketProps, { slots }: SetupContext) {
    const featuresLoading = ref(true);
    const updatedCount = ref<number>(0);

    function updateClient() {
      const cnext = (
        props.newBucketClient ?? ((...args) => new BucketClient(...args))
      )({
        ...props,
        logger: props.debug ? console : undefined,
        sdkVersion: SDK_VERSION,
      });
      featuresLoading.value = true;
      cnext
        .initialize()
        .catch((e) => cnext.logger.error("failed to initialize client", e))
        .finally(() => {
          featuresLoading.value = false;
        });

      return cnext;
    }

    watch(
      () =>
        canonicalJson(
          // canonicalJson doesn't handle `undefined` values, so we stringify/parse to remove them
          JSON.parse(
            JSON.stringify({
              user: props.user,
              company: props.company,
              otherContext: props.otherContext,
            }),
          ),
        ),
      () => {
        clientRef.value = updateClient();
      },
    );

    const clientRef = shallowRef<BucketClient>(updateClient());

    const context = {
      isLoading: featuresLoading,
      updatedCount: updatedCount,
      client: clientRef,
      provider: true,
    } satisfies ProviderContextType;

    provide(ProviderSymbol, context);

    return () =>
      featuresLoading.value && typeof slots.loading !== "undefined"
        ? slots.loading()
        : slots.default?.();
  },
});

export type RequestFeedbackOptions = Omit<
  RequestFeedbackData,
  "featureKey" | "featureId"
>;

export function useFeature<TKey extends FeatureKey>(key: TKey) {
  const client = useClient();
  const ctx = injectSafe();

  const track = () => client?.value.track(key);
  const requestFeedback = (opts: RequestFeedbackOptions) =>
    client.value.requestFeedback({ ...opts, featureKey: key });

  function getFeature() {
    const f = client.value.getFeature(key);
    return {
      isEnabled: f.isEnabled,
      config: f.config,
      track,
      requestFeedback,
      key,
      isLoading: ctx.isLoading,
    };
  }

  const feature = ref(getFeature());

  function updateFeature() {
    feature.value = getFeature();
  }

  client.value.on("featuresUpdated", updateFeature);
  onBeforeUnmount(() => {
    client.value.off("featuresUpdated", updateFeature);
  });

  return feature;
}

/**
 * Vue composable for tracking custom events.
 *
 * This composable returns a function that can be used to track custom events
 * with the Bucket SDK.
 *
 * @example
 * ```ts
 * import { useTrack } from '@bucketco/vue-sdk';
 *
 * const track = useTrack();
 *
 * // Track a custom event
 * track('button_clicked', { buttonName: 'Start Huddle' });
 * ```
 *
 * @returns A function that tracks an event. The function accepts:
 *   - `eventName`: The name of the event to track.
 *   - `attributes`: (Optional) Additional attributes to associate with the event.
 */
export function useTrack() {
  const client = useClient();
  return (eventName: string, attributes?: Record<string, any> | null) =>
    client?.value.track(eventName, attributes);
}

/**
 * Vue composable for requesting user feedback.
 *
 * This composable returns a function that can be used to trigger the feedback
 * collection flow with the Bucket SDK. You can use this to prompt users for
 * feedback at any point in your application.
 *
 * @example
 * ```ts
 * import { useRequestFeedback } from '@bucketco/vue-sdk';
 *
 * const requestFeedback = useRequestFeedback();
 *
 * // Request feedback from the user
 * requestFeedback({
 *   prompt: "How was your experience?",
 *   metadata: { page: "dashboard" }
 * });
 * ```
 *
 * @returns A function that requests feedback from the user. The function accepts:
 *   - `options`: An object containing feedback request options.
 */
export function useRequestFeedback() {
  const client = useClient();
  return (options: RequestFeedbackData) =>
    client?.value.requestFeedback(options);
}

/**
 * Vue composable for sending feedback.
 *
 * This composable returns a function that can be used to send feedback to the
 * Bucket SDK. You can use this to send feedback from your application.
 *
 * @example
 * ```ts
 * import { useSendFeedback } from '@bucketco/vue-sdk';
 *
 * const sendFeedback = useSendFeedback();
 *
 * // Send feedback from the user
 * sendFeedback({
 *   feedback: "I love this feature!",
 *   metadata: { page: "dashboard" }
 * });
 * ```
 *
 * @returns A function that sends feedback to the Bucket SDK. The function accepts:
 *   - `options`: An object containing feedback options.
 */
export function useSendFeedback() {
  const client = useClient();
  return (opts: UnassignedFeedback) => client?.value.feedback(opts);
}

/**
 * Vue composable for updating the user context.
 *
 * This composable returns a function that can be used to update the user context
 * with the Bucket SDK. You can use this to update the user context at any point
 * in your application.
 *
 * @example
 * ```ts
 * import { useUpdateUser } from '@bucketco/vue-sdk';
 *
 * const updateUser = useUpdateUser();
 *
 * // Update the user context
 * updateUser({ id: "123", name: "John Doe" });
 * ```
 *
 * @returns A function that updates the user context. The function accepts:
 *   - `opts`: An object containing the user context to update.
 */
export function useUpdateUser() {
  const client = useClient();
  return (opts: { [key: string]: string | number | undefined }) =>
    client?.value.updateUser(opts);
}

/**
 * Vue composable for updating the company context.
 *
 * This composable returns a function that can be used to update the company
 * context with the Bucket SDK. You can use this to update the company context
 * at any point in your application.
 *
 * @example
 * ```ts
 * import { useUpdateCompany } from '@bucketco/vue-sdk';
 *
 * const updateCompany = useUpdateCompany();
 *
 * // Update the company context
 * updateCompany({ id: "123", name: "Acme Inc." });
 * ```
 *
 * @returns A function that updates the company context. The function accepts:
 *   - `opts`: An object containing the company context to update.
 */
export function useUpdateCompany() {
  const client = useClient();
  return (opts: { [key: string]: string | number | undefined }) =>
    client?.value.updateCompany(opts);
}

/**
 * Vue composable for updating the other context.
 *
 * This composable returns a function that can be used to update the other
 * context with the Bucket SDK. You can use this to update the other context
 * at any point in your application.
 *
 * @example
 * ```ts
 * import { useUpdateOtherContext } from '@bucketco/vue-sdk';
 *
 * const updateOtherContext = useUpdateOtherContext();
 *
 * // Update the other context
 * updateOtherContext({ id: "123", name: "Acme Inc." });
 * ```
 *
 * @returns A function that updates the other context. The function accepts:
 *   - `opts`: An object containing the other context to update.
 */
export function useUpdateOtherContext() {
  const client = useClient();
  return (opts: { [key: string]: string | number | undefined }) =>
    client?.value.updateOtherContext(opts);
}

/**
 * Vue composable for getting the Bucket client.
 *
 * This composable returns the Bucket client. You can use this to get the Bucket
 * client at any point in your application.
 *
 * @returns The Bucket client.
 */
export function useClient() {
  const ctx = injectSafe();
  return ctx.client;
}

/**
 * Vue composable for checking if the Bucket client is loading.
 *
 * This composable returns a boolean value that indicates whether the Bucket client is loading.
 * You can use this to check if the Bucket client is loading at any point in your application.
 */
export function useIsLoading() {
  const ctx = injectSafe();
  return ctx.isLoading;
}

function injectSafe() {
  const ctx = inject(ProviderSymbol);
  if (!ctx?.provider) {
    throw new Error(
      `BucketProvider is missing. Please ensure your component is wrapped with a BucketProvider.`,
    );
  }
  return ctx;
}

export default {
  install(app: App, _options?: BucketProps) {
    app.component("BucketProvider", BucketProvider);
  },
};
