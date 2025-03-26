import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";

import { getApp } from "../services/bootstrap.js";
import { getFeature, listFeatureNames } from "../services/features.js";
import { configStore } from "../stores/config.js";
import { MissingAppIdError, MissingEnvIdError } from "../utils/errors.js";

export function registerMcpResources(mcp: McpServer) {
  const appId = configStore.getConfig("appId");
  if (!appId) {
    throw new MissingAppIdError();
  }
  const app = getApp(appId);
  const production = app.environments.find((e) => e.isProduction);
  if (!production) {
    throw new MissingEnvIdError();
  }

  mcp.resource(
    "feature",
    new ResourceTemplate("features://{featureId}", {
      list: async () => {
        const response = await listFeatureNames(appId);
        return {
          resources: response.map(({ id, name }) => ({
            name,
            uri: `features://${id}`,
            description: `Feature ${name} of the app ${app.name}.`,
            mimeType: "application/json",
          })),
        };
      },
    }),
    {
      description: "Returns a specific feature by ID.",
      mimeType: "application/json",
    },
    async (uri, { featureId }) => {
      const data = await getFeature(appId, featureId.toString(), {
        envId: production.id,
      });
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  );
}
