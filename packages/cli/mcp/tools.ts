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
import { listStages, UpdateFeatureStage } from "../services/stages.js";
import { configStore } from "../stores/config.js";
import {
  handleMcpError,
  MissingAppIdError,
  MissingEnvIdError,
} from "../utils/errors.js";
import { KeyFormatPatterns } from "../utils/gen.js";
import { featureUrl } from "../utils/path.js";
import {
  EnvironmentQuerySchema,
  withDefaults,
  withDescriptions,
} from "../utils/schemas.js";

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
    "Get user feedback for the features of the Bucket feature management service.",
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
        return {
          content: [
            {
              type: "text",
              text: `Feature created successfully. Show this link to the feature Bucket: ${featureLink}. Now run the Bucket CLI in a terminal:
\`shell
$ npx bucket features types
\`

After that we can feature flag some code. Use the following pattern for React:

\`\`\`typescript
import { useFeature } from "@bucketco/react-sdk";
function MyComponent() {
  const { isEnabled } = useFeature("${feature.key}");
  if (!isEnabled) {
    // feature is disabled
    return null;
  }
  return <div>Feature is disabled.</div>;
}
\`\`\`

For Node.js, the pattern is similar:
\`\`\`
// import the initialized bucket client
import { bucketClient } from "./bucket";

function myFunction() {
  const { isEnabled } = bucketClient.getFeature("${feature.key}");

  if (!isEnabled) {
    // feature is disabled
    return;
  }

  console.log("Feature is enabled!")
}
\`\`\`
`,
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
    "companies",
    "List of companies of the Bucket feature management service.",
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
    "Grant or revoke feature access for a specific company of the Bucket feature management service.",
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

  mcp.tool(
    "updateFeatureStage",
    "Update feature stage.",
    withDefaults(
      EnvironmentQuerySchema.extend({
        featureId: z.string(),
        stageName: z
          .enum(stages.map((s) => s.name) as [string, ...string[]])
          .describe(
            "The name of the stage. Must be one of the following: " +
              stages.map((s) => s.name).join(", "),
          ),
        targeting: z
          .enum(["none", "some", "everyone"])
          .describe("The overarching targeting mode for the feature."),
        changeDescription: z.string().describe("The reason for the change"),
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
        const { feature } = await UpdateFeatureStage(appId, {
          featureId: args.featureId,
          stageId: stage.id,
          targetingMode: args.targeting,
          envId: args.envId,
          changeDescription: args.changeDescription,
        });
        return {
          content: [
            {
              type: "text",
              text: `Updated flag targeting for feature '${feature.key}'.`,
            },
          ],
        };
      } catch (error) {
        return await handleMcpError(error);
      }
    },
  );
}
