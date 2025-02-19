import { authRequest } from "../utils/auth.js";
import { genDTS, genFeatureKey } from "../utils/gen.js";

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

export async function genFeatureTypes(appId: string) {
  const response = await listFeatures(appId);
  return genDTS(response.map(({ key }) => key));
}

type FeatureResponse = {
  feature: Feature;
};

export async function createFeature(
  appId: string,
  name: string,
  key: string | undefined,
) {
  const features = await listFeatures(appId);
  const response = await authRequest<FeatureResponse>(
    `/apps/${appId}/features`,
    {
      method: "POST",
      data: {
        name,
        key: genFeatureKey(
          key ?? name,
          features.map(({ key }) => key),
        ),
        source: "event",
      },
    },
  );
  return response.feature;
}
