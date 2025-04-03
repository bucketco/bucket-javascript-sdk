import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import ora from "ora";
import { z } from "zod";

import { getApp, getOrg, listSegments } from "../services/bootstrap.js";
import { CompaniesQuerySchema, listCompanies } from "../services/companies.js";
import {
  createFeature,
  FeatureAccessSchema,
  FeatureCreateSchema,
  listFeatureNames,
  updateFeatureAccess,
} from "../services/features.js";
import { FeedbackQuerySchema, listFeedback } from "../services/feedback.js";
import {
  listStages,
  updateFeatureStage,
  UpdateFeatureStageSchema,
} from "../services/stages.js";
import { listUsers, UsersQuerySchema } from "../services/users.js";
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
  featureCreateResponse,
  featuresResponse,
  feedbackResponse,
  updateFeatureAccessResponse,
  updateFeatureStageResponse,
  usersResponse,
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
  const segments = listSegments(appId);
  const production = app.environments.find((e) => e.isProduction);
  if (!production) {
    throw new MissingEnvIdError();
  }

  // Extend bootstrap spinner for loading stages
  const spinner = ora("Bootstrapping...").start();
  const stages = await listStages(appId);
  spinner.stop();

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
        return featureCreateResponse(feature.key, featureLink, feature);
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

  // Add users tool
  mcp.tool(
    "users",
    "List of users of the Bucket feature management service.",
    withDefaults(UsersQuerySchema, {
      envId: production.id,
    }).shape,
    async (args) => {
      try {
        const data = await listUsers(appId, args);
        return usersResponse(data);
      } catch (error) {
        return await handleMcpError(error);
      }
    },
  );

  // Add company feature access tool
  const segmentNames = segments.map((s) => s.name);
  mcp.tool(
    "featureAccess",
    "Grant or revoke feature access to a specific user, company, or segment of the Bucket feature management service.",
    withDefaults(
      FeatureAccessSchema.omit({ segmentIds: true }).extend({
        segmentNames: z
          .array(z.enum(segmentNames as [string, ...string[]]))
          .optional()
          .describe(
            `Segment names to target. Must be one of the following: ${segmentNames.join(", ")}`,
          ),
      }),
      {
        envId: production.id,
      },
    ).shape,
    async (args) => {
      try {
        const { segmentNames: selectedSegmentNames, ...rest } = args;
        const segmentIds =
          selectedSegmentNames
            ?.map((name) => segments.find((s) => s.name === name)?.id)
            .filter((id) => id !== undefined) ?? [];
        const { flagVersions } = await updateFeatureAccess(appId, {
          ...rest,
          segmentIds,
        });
        return updateFeatureAccessResponse(flagVersions);
      } catch (error) {
        return await handleMcpError(error);
      }
    },
  );

  // Add update feature stage tool
  const stageNames = stages.map((s) => s.name);
  mcp.tool(
    "updateFeatureStage",
    "Update the stage of a feature of the Bucket feature management service.",
    withDefaults(
      UpdateFeatureStageSchema.omit({
        stageId: true,
      }).extend({
        stageName: z
          .enum(stageNames as [string, ...string[]])
          .describe(
            `The name of the stage. Must be one of the following: ${stageNames.join(", ")}`,
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
