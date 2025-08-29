import { App } from "vue";

import {
  CheckEvent,
  CompanyContext,
  TrackEvent,
  UserContext,
} from "@reflag/browser-sdk";

import ReflagProvider from "./ReflagProvider.vue";
import { FlagKey, ReflagProps } from "./types";

export {
  useClient,
  useFlag,
  useIsLoading,
  useRequestFeedback,
  useSendFeedback,
  useTrack,
  useTrackCustom,
  useUpdateCompany,
  useUpdateOtherContext,
  useUpdateUser,
} from "./hooks";
export type { ReflagProps } from "./types";

export { ReflagProvider };

export type { CheckEvent, CompanyContext, FlagKey, TrackEvent, UserContext };

export default {
  install(app: App, _options?: ReflagProps) {
    app.component("ReflagProvider", ReflagProvider);
  },
};
