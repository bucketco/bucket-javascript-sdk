import { z } from "zod";

import { authRequest } from "../utils/auth.js";

import { getFeature, getFlag } from "./features.js";

export type Stage = {
  id: string;
  name: string;
  order: number;
};

type StagesResponse = {
  stages: Stage[];
};

export async function listStages(appId: string): Promise<Stage[]> {
  const response = await authRequest<StagesResponse>(`/apps/${appId}/stages`);
  return response.stages;
}

export const FeatureTargetingModes = ["none", "some", "everyone"] as const;
export type FeatureTargetingMode = (typeof FeatureTargetingModes)[number];
export const UpdateFeatureStageSchema = z.object({
  featureKey: z.string(),
  targetingMode: z.enum(FeatureTargetingModes).optional(),
});

export type UpdateFeatureStageArgs = {
  stageId: string;
  changeDescription: string;
  targetingMode: FeatureTargetingMode;
  featureId: string;
  envId: string;
};

export async function UpdateFeatureStage(
  appId: string,
  {
    stageId,
    targetingMode,
    featureId,
    envId,
    changeDescription,
  }: UpdateFeatureStageArgs,
) {
  const feature = await getFeature(appId, featureId, {
    envId,
  });

  if (!feature) {
    throw new Error(`Feature not found for ID ${featureId}`);
  }

  const flag = await getFlag(appId, feature.flagId!, {
    envId,
  });

  const currFlagVersion = flag.currentVersions;
  const envFlagVersion = currFlagVersion.find(
    (v) => v.environment.id === envId,
  );
  if (!envFlagVersion) {
    throw new Error(`Flag version not found for environment ${envId}`);
  }
  envFlagVersion.targetingMode = targetingMode;
  const body = {
    stageId,
    changeDescription,
    versions: [
      {
        environmentId: envId,
        targetingMode: envFlagVersion.targetingMode,
        segmentIds: envFlagVersion.segmentIds,
        companyIds: envFlagVersion.companyIds,
        userIds: envFlagVersion.userIds,
        customRules: envFlagVersion.customRules,
      },
    ],
  };

  await authRequest<void>(`/apps/${appId}/flags/${flag.id}/versions`, {
    method: "POST",
    params: {
      envId,
      "currentVersionIds[]": flag.currentVersions.map((v) => v.id),
    },

    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return {
    feature,
  };
}
