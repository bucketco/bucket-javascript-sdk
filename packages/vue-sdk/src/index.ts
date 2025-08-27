import { App } from "vue";

import {
  CheckEvent,
  CompanyContext,
  TrackEvent,
  UserContext,
} from "@reflag/browser-sdk";

import ReflagProvider from "./ReflagProvider.vue";
import { Feature, ReflagProps } from "./types";

export {
  useClient,
  useFeature,
  useFlag,
  useIsLoading,
  useRequestFeedback,
  useSendFeedback,
  useTrack,
  useUpdateCompany,
  useUpdateOtherContext,
  useUpdateUser,
} from "./hooks";
export type { ReflagProps } from "./types";

export { ReflagProvider as BucketProvider, ReflagProvider };

export type { CheckEvent, CompanyContext, Feature, TrackEvent, UserContext };

export default {
  install(app: App, _options?: ReflagProps) {
    app.component("ReflagProvider", ReflagProvider);
  },
};
