import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getApp, getOrg } from "../services/bootstrap.js";
import {
  CompaniesQuerySchema,
  companyFeatureAccess,
  CompanyFeatureAccessSchema,
  listCompanies,
} from "../services/companies.js";
import {
  createFeature,
  FeatureCreateSchema,
  listFeatureNames,
} from "../services/features.js";
import { FeedbackQuerySchema, listFeedback } from "../services/feedback.js";
import {
  listStages,
  updateFeatureStage,
  UpdateFeatureStageSchema,
} from "../services/stages.js";
import { configStore } from "../stores/config.js";
import {
  handleMcpError,
  MissingAppIdError,
  MissingEnvIdError,
} from "../utils/errors.js";
import { KeyFormatPatterns } from "../utils/gen.js";
import { featureUrl } from "../utils/path.js";
import { withDefaults, withDescriptions } from "../utils/schemas.js";

import {
  companiesResponse,
  companyFeatureAccessResponse,
  featureCreateResponse,
  featuresResponse,
  feedbackResponse,
  updateFeatureStageResponse,
} from "./responses.js";

export async function registerMcpTools(
  mcp: McpServer,
  { appId }: { appId?: string },
) {
  // const projectPath = configStore.getProjectPath();
  const { appId: configAppId, typesOutput: _ } = configStore.getConfig();
  appId = appId || configAppId;
  if (!appId) {
    throw new MissingAppIdError();
  }
  const org = getOrg();
  const app = getApp(appId);
  const production = app.environments.find((e) => e.isProduction);
  if (!production) {
    throw new MissingEnvIdError();
  }

  const stages = await listStages(appId);

  // Add features tool
  mcp.tool(
    "features",
    "List all feature flags of the Bucket feature management service.",
    async () => {
      try {
        const data = await listFeatureNames(appId);
        return featuresResponse(data);
      } catch (error) {
        return await handleMcpError(error);
      }
    },
  );

  // Add feedback tool
  mcp.tool(
    "feedback",
    "Get user feedback for the features of the Bucket feature management service.",
    withDefaults(FeedbackQuerySchema, {
      envId: production.id,
    }).shape,
    async (args) => {
      try {
        const data = await listFeedback(appId, args);
        return feedbackResponse(data);
      } catch (error) {
        return await handleMcpError(error);
      }
    },
  );

  // Add create feature tool
  const keyFormatRules = KeyFormatPatterns[org.featureKeyFormat].message;
  mcp.tool(
    "featureCreate",
    "Creates a new feature flag of the Bucket feature management service.",
    withDescriptions(FeatureCreateSchema, {
      key: `Feature key specified in ${org.featureKeyFormat} format:\n${keyFormatRules}`,
    }).shape,
    async (args) => {
      try {
        const feature = await createFeature(appId, args);
        const featureLink = featureUrl(
          configStore.getConfig("baseUrl"),
          production,
          feature,
        );
        return featureCreateResponse(feature.key, featureLink);
      } catch (error) {
        return await handleMcpError(error);
      }
    },
  );

  // Add companies tool
  mcp.tool(
    "companies",
    "List of companies of the Bucket feature management service.",
    withDefaults(CompaniesQuerySchema, {
      envId: production.id,
    }).shape,
    async (args) => {
      try {
        const data = await listCompanies(appId, args);
        return companiesResponse(data);
      } catch (error) {
        return await handleMcpError(error);
      }
    },
  );

  // Add company feature access tool
  mcp.tool(
    "companyFeatureAccess",
    "Grant or revoke feature access for a specific company of the Bucket feature management service.",
    withDefaults(CompanyFeatureAccessSchema, {
      envId: production.id,
    }).shape,
    async (args) => {
      try {
        await companyFeatureAccess(appId, args);
        return companyFeatureAccessResponse(
          args.isEnabled,
          args.featureKey,
          args.companyId,
        );
      } catch (error) {
        return await handleMcpError(error);
      }
    },
  );

  mcp.tool(
    "updateFeatureStage",
    "Update the stage of a feature of the Bucket feature management service.",
    withDefaults(
      UpdateFeatureStageSchema.omit({
        stageId: true,
      }).extend({
        stageName: z
          .enum(stages.map((s) => s.name) as [string, ...string[]])
          .describe(
            `The name of the stage. Must be one of the following: ${stages.map((s) => s.name).join(", ")}`,
          ),
      }),
      {
        envId: production.id,
      },
    ).shape,
    async (args) => {
      const stage = stages.find((s) => s.name === args.stageName);
      if (!stage) {
        throw new Error(`Stage '${args.stageName}' not found.`);
      }

      try {
        const { feature } = await updateFeatureStage(appId, {
          featureId: args.featureId,
          stageId: stage.id,
          targetingMode: args.targetingMode,
          envId: args.envId,
          changeDescription: args.changeDescription,
        });
        return updateFeatureStageResponse(feature.key);
      } catch (error) {
        return await handleMcpError(error);
      }
    },
  );
}
