import { App } from "vue";

import {
  CheckEvent,
  CompanyContext,
  RawFeatures,
  TrackEvent,
  UserContext,
} from "@bucketco/browser-sdk";

import BucketProvider from "./BucketProvider.vue";
import { BucketProps } from "./types";

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
export type { BucketProps, RequestFeatureFeedbackOptions } from "./types";

export { BucketProvider };

export type {
  CheckEvent,
  CompanyContext,
  RawFeatures,
  TrackEvent,
  UserContext,
};

export default {
  install(app: App, _options?: BucketProps) {
    app.component("BucketProvider", BucketProvider);
  },
};
