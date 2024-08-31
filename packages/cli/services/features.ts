import { authRequest } from "../utils/auth.js";
import { genDTS, genFeatureKey } from "../utils/gen.js";

type Feature = {
  id: string;
  name: string;
  key: string;
};

type FeatureNamesResponse = Feature[];

export async function listFeatures(appId: string) {
  const response = await authRequest<FeatureNamesResponse>(
    `/apps/${appId}/features/names`,
  );
  return response.map(({ name, key }) => ({
    name,
    key,
  }));
}

export async function genFeatureTypes(appId: string) {
  const response = await authRequest<FeatureNamesResponse>(
    `/apps/${appId}/features/names`,
  );
  return genDTS(response.map(({ key }) => key));
}

type FeatureResponse = {
  feature: Feature;
};

export async function createFeature(
  appId: string,
  envId: string,
  name: string,
  key: string | undefined,
) {
  const features = await listFeatures(appId);
  const response = await authRequest<FeatureResponse>(
    `/apps/${appId}/features?envId=${envId}`,
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
