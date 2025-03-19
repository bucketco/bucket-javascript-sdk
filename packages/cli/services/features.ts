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

export const FeatureQuerySchema = EnvironmentQuerySchema.extend({
  view: z.string().optional().describe("View filter for features"),
  sortBy: z.string().default("key").describe("Field to sort features by"),
  sortOrder: z
    .enum(["asc", "desc"])
    .default("asc")
    .describe("Sort direction (ascending or descending)"),
  sortType: sortTypeSchema
    .default("flat")
    .describe("Type of sorting to apply (flat or hierarchical)"),
  includeFeatureMetrics: booleanish
    .default(false)
    .describe("Include metrics data with features"),
  includeRolloutStatus: booleanish
    .default(false)
    .describe("Include rollout status information"),
  includeGoals: booleanish.default(false).describe("Include associated goals"),
  includeProductionEstimatedTargetAudience: booleanish
    .default(false)
    .describe("Include estimated production target audience data"),
  includeRemoteConfigs: booleanish
    .default(false)
    .describe("Include remote configuration data"),
  useTargetingRules: booleanish
    .default(false)
    .describe("Apply targeting rules"),
}).strict();

export type FeaturesQuery = z.input<typeof FeatureQuerySchema>;

export const FeatureCreateSchema = z
  .object({
    name: z
      .string()
      .min(1, "Feature name is required")
      .describe("Name of the feature"),
    key: z
      .string()
      .min(1, "Feature key is required")
      .describe("Unique identifier key for the feature"),
    description: z
      .string()
      .optional()
      .describe("Optional description of the feature"),
  })
  .strict();

export type FeatureCreate = z.input<typeof FeatureCreateSchema>;

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
  featureData: FeatureCreate,
): Promise<Feature> {
  return authRequest<FeatureResponse>(`/apps/${appId}/features`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "event",
      ...FeatureCreateSchema.parse(featureData),
    }),
  }).then(({ feature }) => feature);
}
