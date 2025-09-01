import { App } from "vue";

import {
  CheckEvent,
  CompanyContext,
  TrackEvent,
  UserContext,
} from "@reflag/browser-sdk";

import ReflagProvider from "./ReflagProvider.vue";
import { ReflagProps } from "./types";

export {
  useClient,
  useFlag,
  useIsLoading,
  useRequestFeedback,
  useSendFeedback,
  useTrack,
  useUpdateCompany,
  useUpdateOtherContext,
  useUpdateUser,
} from "./hooks";
export type { ReflagProps, RequestFlagFeedbackOptions } from "./types";

export { ReflagProvider };

export type {
  CheckEvent,
  CompanyContext,
  EmptyFlagRemoteConfig,
  Flag,
  Flags,
  FlagType,
  TrackEvent,
  UserContext,
};

export default {
  install(app: App, _options?: ReflagProps) {
    app.component("ReflagProvider", ReflagProvider);
  },
};
