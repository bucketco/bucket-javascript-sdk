import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { listFeatures } from "../services/features.js";
import { configStore } from "../stores/config.js";

export function registerMcpFeatures(mcp: McpServer) {
  // Add an addition tool
  mcp.tool("features", {}, async () => {
    const appId = configStore.getConfig("appId");
    if (!appId) {
      return {
        isError: true,
        content: [{ type: "text", text: "Error: appId in config missing" }],
      };
    }
    try {
      const features = await listFeatures(appId);
      return {
        content: [{ type: "text", text: JSON.stringify(features, null, 2) }],
      };
    } catch (error) {
      console.error(error);
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${error}` }],
      };
    }
  });
}
