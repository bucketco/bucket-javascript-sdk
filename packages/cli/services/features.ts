import { authRequest } from "../utils/auth.js";

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
  const response = await authRequest<FeaturesResponse>(
    `/apps/${appId}/features`,
    {
      params: {
        sortBy: "name",
        sortOrder: "desc",
        includeRemoteConfigs: options.includeRemoteConfigs ? "true" : "false",
      },
    },
  );

  return response.data.map(({ name, key, remoteConfigs }) => ({
    name,
    key,
    remoteConfigs,
  }));
}

type FeatureResponse = {
  feature: Feature;
};

export async function createFeature(
  appId: string,
  name: string,
  key: string,
): Promise<Feature> {
  const response = await authRequest<FeatureResponse>(
    `/apps/${appId}/features`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        key,
        source: "event",
      }),
    },
  );
  return response.feature;
}
