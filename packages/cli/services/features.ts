import { z } from "zod";

import { authRequest } from "../utils/auth.js";
import {
  booleanish,
  EnvironmentQuery,
  EnvironmentQuerySchema,
  sortTypeSchema,
} from "../utils/schemas.js";
import { PaginatedResponse } from "../utils/types.js";

import { Stage } from "./stages.js";

export type FeatureSourceType = "event" | "attribute";

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

export type FeatureName = {
  id: string;
  name: string;
  key: string;
  source: FeatureSourceType;
  parentFeatureId: string | null;
};

export type Flag = {
  id: string;
  currentVersions: {
    id: string;
    environment: {
      id: string;
    };
    targetingMode: string;
    segmentIds: string[];
    companyIds: string[];
    userIds: string[];
    customRules: any;
  }[];
};

export type Feature = FeatureName & {
  description: string | null;
  remoteConfigs: RemoteConfig[];
  stage: Stage | null;
  flagId: string | null;
};

export type FeaturesResponse = PaginatedResponse<Feature>;

export const FeaturesQuerySchema = EnvironmentQuerySchema.extend({
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
  useTargetingRules: booleanish.default(true).describe("Apply targeting rules"),
}).strict();

export type FeaturesQuery = z.input<typeof FeaturesQuerySchema>;

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

export async function listFeatures(appId: string, query: FeaturesQuery) {
  return authRequest<FeaturesResponse>(`/apps/${appId}/features`, {
    params: FeaturesQuerySchema.parse(query),
  });
}

export async function listFeatureNames(appId: string) {
  return authRequest<FeatureName[]>(`/apps/${appId}/features/names`);
}

type FeatureResponse = {
  feature: Feature;
};

export async function getFeature(
  appId: string,
  featureId: string,
  query: EnvironmentQuery,
) {
  return authRequest<FeatureResponse>(`/apps/${appId}/features/${featureId}`, {
    params: EnvironmentQuerySchema.parse(query),
  }).then(({ feature }) => feature);
}

export async function getFlag(
  appId: string,
  flagId: string,
  query: EnvironmentQuery,
) {
  return await authRequest<Flag>(`/apps/${appId}/flags/${flagId}`, {
    params: EnvironmentQuerySchema.parse(query),
  });
}

export async function createFeature(appId: string, featureData: FeatureCreate) {
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

export const FeatureAccessSchema = EnvironmentQuerySchema.extend({
  featureKey: z.string().describe("Feature key"),
  isEnabled: booleanish.describe(
    "Set feature to enabled or disabled for the targeted users, companies and segments.",
  ),
  userIds: z.array(z.string()).optional().describe("User IDs to target"),
  companyIds: z.array(z.string()).optional().describe("Company IDs to target"),
  segmentIds: z.array(z.string()).optional().describe("Segment IDs to target"),
}).strict();

export type FeatureAccess = z.input<typeof FeatureAccessSchema>;

export type FlagVersion = {
  id: string;
  version: number;
  changeDescription: string;
  targetingMode: string;
  userIds: string[];
  companyIds: string[];
  segmentIds: string[];
};

export type UpdateFeatureAccessResponse = {
  flagVersions: FlagVersion[];
};

export async function updateFeatureAccess(appId: string, query: FeatureAccess) {
  const {
    envId,
    featureKey,
    isEnabled,
    companyIds = [],
    segmentIds = [],
    userIds = [],
  } = FeatureAccessSchema.parse(query);

  const targets = [
    ...companyIds.map((id) => ({
      key: featureKey,
      companyId: id,
      enabled: isEnabled,
    })),
    ...segmentIds.map((id) => ({
      key: featureKey,
      segmentId: id,
      enabled: isEnabled,
    })),
    ...userIds.map((id) => ({
      key: featureKey,
      userId: id,
      enabled: isEnabled,
    })),
  ];

  return authRequest<UpdateFeatureAccessResponse>(
    `/apps/${appId}/features/targeting`,
    {
      method: "PATCH",
      params: {
        envId,
      },
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targets,
      }),
    },
  );
}
