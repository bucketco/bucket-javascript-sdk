import { authRequest } from "../utils/auth.js";

import { Stage } from "./stages.js";

export type RemoteConfigVariant = {
  key?: string;
  payload?: any;
};

export type RemoteConfig = {
  variants: [
    {
      variant: RemoteConfigVariant;
    },
  ];
};

export type Feature = {
  name: string;
  key: string;
  remoteConfigs: RemoteConfig[];
  stage: Stage | null;
};

export type FeaturesResponse = {
  data: Feature[];
};

export type ListOptions = {
  includeRemoteConfigs?: boolean;
};

export async function listFeatures(
  appId: string,
  options: ListOptions = {},
): Promise<Feature[]> {
  return authRequest<FeaturesResponse>(`/apps/${appId}/features`, {
    params: {
      sortBy: "key",
      sortOrder: "asc",
      includeRemoteConfigs: options.includeRemoteConfigs ? "true" : "false",
    },
  }).then(({ data }) => data);
}

type FeatureResponse = {
  feature: Feature;
};

export async function createFeature(
  appId: string,
  name: string,
  key: string,
): Promise<Feature> {
  return authRequest<FeatureResponse>(`/apps/${appId}/features`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      key,
      source: "event",
    }),
  }).then(({ feature }) => feature);
}
