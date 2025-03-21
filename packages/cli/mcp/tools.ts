import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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
import { configStore } from "../stores/config.js";
import {
  handleMcpError,
  MissingAppIdError,
  MissingEnvIdError,
} from "../utils/errors.js";
import { KeyFormatPatterns } from "../utils/gen.js";
import { withDefaults, withDescriptions } from "../utils/schemas.js";

export function registerMcpTools(mcp: McpServer) {
  const appId = configStore.getConfig("appId");
  if (!appId) {
    throw new MissingAppIdError();
  }
  const org = getOrg();
  const app = getApp(appId);
  const production = app.environments.find((e) => e.isProduction);
  if (!production) {
    throw new MissingEnvIdError();
  }

  // Add features tool
  mcp.tool(
    "features",
    "List all feature flags on the Bucket feature management service.",
    async () => {
      try {
        const data = await listFeatureNames(appId);
        return {
          content: [
            {
              type: "text",
              text: `
List of features.
>>> JSON Response >>>
 ${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return await handleMcpError(error);
      }
    },
  );

  // Add feedback tool
  mcp.tool(
    "feedback",
    "Get user feedback for the features on the Bucket feature management service.",
    withDefaults(FeedbackQuerySchema, {
      envId: production.id,
    }).shape,
    async (args) => {
      try {
        const data = await listFeedback(appId, args);
        return {
          content: [
            {
              type: "text",
              text: `
Feedback is returned in a JSON format with pages.
Feedback score is between 1 and 5, with 0 being unknown.
>>> JSON Response >>>
${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return await handleMcpError(error);
      }
    },
  );

  // Add create feature tool
  const keyFormatRules = KeyFormatPatterns[org.featureKeyFormat].message;
  mcp.tool(
    "createFeature",
    "Creates a new feature flag on the Bucket feature management service.",
    withDescriptions(FeatureCreateSchema, {
      key: `Feature key specified in ${org.featureKeyFormat} format:\n${keyFormatRules}`,
    }).shape,
    async (args) => {
      try {
        const feature = await createFeature(appId, args);
        return {
          content: [
            {
              type: "text",
              text: `
Feature created successfully.
>>> JSON Response >>>
${JSON.stringify(feature, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return await handleMcpError(error);
      }
    },
  );

  // Add companies tool
  mcp.tool(
    "listCompanies",
    "List of companies on the Bucket feature management service.",
    withDefaults(CompaniesQuerySchema, {
      envId: production.id,
    }).shape,
    async (args) => {
      try {
        const data = await listCompanies(appId, args);
        return {
          content: [
            {
              type: "text",
              text: `
List of companies.
>>> JSON Response >>>
${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return await handleMcpError(error);
      }
    },
  );

  // Add company feature access tool
  mcp.tool(
    "companyFeatureAccess",
    "Grant or revoke feature access for a specific company on the Bucket feature management service.",
    withDefaults(CompanyFeatureAccessSchema, {
      envId: production.id,
    }).shape,
    async (args) => {
      try {
        await companyFeatureAccess(appId, args);
        return {
          content: [
            {
              type: "text",
              text: `${args.isEnabled ? "Granted" : "Revoked"} access to feature '${args.featureKey}' for company ID '${args.companyId}'.`,
            },
          ],
        };
      } catch (error) {
        return await handleMcpError(error);
      }
    },
  );
}
