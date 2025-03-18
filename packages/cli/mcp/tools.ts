import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getApp } from "../services/bootstrap.js";
import { FeatureQuerySchema, listFeatures } from "../services/features.js";
import { FeedbackQuerySchema, listFeedback } from "../services/feedback.js";
import { configStore } from "../stores/config.js";
import { MissingAppIdError, MissingEnvIdError } from "../utils/errors.js";
import { EnvironmentQuerySchema } from "../utils/schemas.js";

export function registerMcpTools(mcp: McpServer) {
  const appId = configStore.getConfig("appId");
  if (!appId) {
    throw new MissingAppIdError();
  }
  const app = getApp(appId);
  const production = app.environments.find((e) => e.isProduction);
  if (!production) {
    throw new MissingEnvIdError();
  }

  // Add features tool
  mcp.tool(
    "features",
    FeatureQuerySchema.merge(EnvironmentQuerySchema(production.id)).shape,
    async (args) => {
      try {
        const data = await listFeatures(appId, args);
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
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error}` }],
        };
      }
    },
  );

  // Add feedback tool
  mcp.tool(
    "feedback",
    FeedbackQuerySchema.merge(EnvironmentQuerySchema(production.id)).shape,
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
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error}` }],
        };
      }
    },
  );
}
