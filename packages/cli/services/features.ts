import { authRequest } from "../utils/auth.js";

type Feature = {
  name: string;
  key: string;
};

type FeaturesResponse = {
  data: Feature[];
};

export async function listFeatures(appId: string) {
  const response = await authRequest<FeaturesResponse>(
    `/apps/${appId}/features`,
  );

  return response.data.map(({ name, key }) => ({
    name,
    key,
  }));
}

type FeatureResponse = {
  feature: Feature;
};

export async function createFeature(appId: string, name: string, key: string) {
  const response = await authRequest<FeatureResponse>(
    `/apps/${appId}/features`,
    {
      method: "POST",
      data: {
        name,
        key,
        source: "event",
      },
    },
  );
  return response.feature;
}
