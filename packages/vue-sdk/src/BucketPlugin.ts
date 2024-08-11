// BucketPlugin.ts
import { reactive, ref } from "vue";
import type { App, InjectionKey } from "vue";
import type {
  CompanyContext,
  Feedback,
  FeedbackOptions,
  FeaturesOptions,
  RequestFeedbackOptions,
  UserContext,
} from "@bucketco/browser-sdk";
import { BucketClient } from "@bucketco/browser-sdk";

import { version } from "../package.json";

const SDK_VERSION = `vue-sdk/${version}`;

type OtherContext = Record<string, any>;

export interface Features {}

export type BucketFeatures = keyof (keyof Features extends never
  ? Record<string, boolean>
  : Features);

export type FeaturesResult = { [k in BucketFeatures]?: boolean };

export interface BucketState {
  features: FeaturesResult;
  isLoading: boolean;
  user: UserContext | null;
  company: CompanyContext | null;
  otherContext: OtherContext | null;
}

export interface BucketPluginOptions {
  publishableKey: string;
  flagOptions?: Omit<FeaturesOptions, "fallbackFeatures"> & {
    fallbackFeatures?: BucketFeatures[];
  };
  feedback?: FeedbackOptions;
  host?: string;
  sseHost?: string;
  debug?: boolean;
}

type ProvideType = {
  state: BucketState;
  track: (eventName: string, attributes?: Record<string, any>) => Promise<void>;
  sendFeedback: (opts: Omit<Feedback, "userId" | "companyId">) => Promise<void>;
  requestFeedback: (
    opts: Omit<RequestFeedbackOptions, "userId" | "companyId">,
  ) => void;
};

export const BucketInjectionKey = Symbol() as InjectionKey<ProvideType>;

export const BucketPlugin = {
  install(app: App, options: BucketPluginOptions) {
    const bucketState = reactive<BucketState>({
      features: {},
      isLoading: true,
      user: null,
      company: null,
      otherContext: null,
    });

    const client = ref<BucketClient | null>(null);

    const updateClient = () => {
      if (client.value) {
        client.value.stop();
      }

      client.value = new BucketClient(
        options.publishableKey,
        {
          user: bucketState.user ?? undefined,
          company: bucketState.company ?? undefined,
          otherContext: bucketState.otherContext ?? undefined,
        },
        {
          host: options.host,
          sseHost: options.sseHost,
          features: {
            ...options.flagOptions,
            // onUpdatedFeatures: (flags) => {
            //   bucketState.flags = flags;
            // },
          },
          feedback: options.feedback,
          logger: options.debug ? console : undefined,
          sdkVersion: SDK_VERSION,
        },
      );

      client.value
        .initialize()
        .then(() => {
          bucketState.features = client.value!.getFeatures() ?? {};
          bucketState.isLoading = false;

          // Update user attributes
          const { id: userId, ...userAttributes } = bucketState.user || {};
          if (userId) {
            client.value!.user(userAttributes).catch(() => {
              // ignore rejections. Logged inside
            });
          }

          // Update company attributes
          const { id: companyId, ...companyAttributes } =
            bucketState.company || {};
          if (companyId) {
            client.value!.company(companyAttributes).catch(() => {
              // ignore rejections. Logged inside
            });
          }
        })
        .catch(() => {
          // initialize cannot actually throw, but this fixes lint warnings
        });
    };

    const track = async (
      eventName: string,
      attributes?: Record<string, any>,
    ) => {
      if (!bucketState.user?.id) {
        console.error("User is required to send events");
        return;
      }
      await client.value?.track(eventName, attributes);
    };

    const sendFeedback = async (
      opts: Omit<Feedback, "userId" | "companyId">,
    ) => {
      if (!bucketState.user?.id) {
        console.error("User is required to send feedback");
        return;
      }
      await client.value?.feedback({
        ...opts,
        userId: String(bucketState.user.id),
        companyId: bucketState.company?.id
          ? String(bucketState.company.id)
          : undefined,
      });
    };

    const requestFeedback = (
      opts: Omit<RequestFeedbackOptions, "userId" | "companyId">,
    ) => {
      if (!bucketState.user?.id) {
        console.error("User is required to request feedback");
        return;
      }
      client.value?.requestFeedback({
        ...opts,
        userId: String(bucketState.user.id),
        companyId: bucketState.company?.id
          ? String(bucketState.company.id)
          : undefined,
      });
    };

    app.provide(BucketInjectionKey, {
      state: bucketState,
      track,
      sendFeedback,
      requestFeedback,
    });

    updateClient();
  },
};
