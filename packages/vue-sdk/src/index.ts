import { App } from "vue";

import {
  CheckEvent,
  CompanyContext,
  RawFeatures,
  TrackEvent,
  UserContext,
} from "@reflag/browser-sdk";

import ReflagProvider from "./ReflagProvider.vue";
import {
  EmptyFeatureRemoteConfig,
  Feature,
  FeatureType,
  ReflagProps,
} from "./types";

export {
  useClient,
  useFeature,
  useIsLoading,
  useRequestFeedback,
  useSendFeedback,
  useTrack,
  useUpdateCompany,
  useUpdateOtherContext,
  useUpdateUser,
} from "./hooks";
export type { ReflagProps, RequestFeatureFeedbackOptions } from "./types";

export { ReflagProvider as BucketProvider, ReflagProvider };

export type {
  CheckEvent,
  CompanyContext,
  EmptyFeatureRemoteConfig,
  Feature,
  FeatureType,
  RawFeatures,
  TrackEvent,
  UserContext,
};

export default {
  install(app: App, _options?: ReflagProps) {
    app.component("ReflagProvider", ReflagProvider);
  },
};
