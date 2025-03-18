import { z } from "zod";

import { authRequest } from "../utils/auth.js";
import {
  booleanish,
  EnvironmentQuerySchema,
  sortTypeSchema,
} from "../utils/schemas.js";
import { PaginatedResponse } from "../utils/types.js";

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
  id: string;
  name: string;
  key: string;
  description: string | null;
  remoteConfigs: RemoteConfig[];
  stage: Stage | null;
};

export type FeaturesResponse = PaginatedResponse<Feature>;

export const FeatureQuerySchema = EnvironmentQuerySchema()
  .extend({
    view: z.string().optional(),
    sortBy: z.string().default("key"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
    sortType: sortTypeSchema.default("flat"),
    includeFeatureMetrics: booleanish.default(false),
    includeRolloutStatus: booleanish.default(false),
    includeGoals: booleanish.default(false),
    includeProductionEstimatedTargetAudience: booleanish.default(false),
    includeRemoteConfigs: booleanish.default(false),
    useTargetingRules: booleanish.default(false),
  })
  .strict();
export type FeaturesQuery = z.input<typeof FeatureQuerySchema>;

export async function listFeatures(
  appId: string,
  query: FeaturesQuery,
): Promise<FeaturesResponse> {
  return authRequest<FeaturesResponse>(`/apps/${appId}/features`, {
    params: FeatureQuerySchema.parse(query),
  });
}

type FeatureResponse = {
  feature: Feature;
};

export async function getFeature(
  appId: string,
  featureId: string,
): Promise<Feature> {
  return authRequest<FeatureResponse>(
    `/apps/${appId}/features/${featureId}`,
  ).then(({ feature }) => feature);
}

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
