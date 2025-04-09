import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import chalk from "chalk";
import { Command } from "commander";
import express from "express";
import { findUp } from "find-up";
import { readFile } from "node:fs/promises";
import ora, { Ora } from "ora";

import { registerMcpTools } from "../mcp/tools.js";
import { configStore } from "../stores/config.js";
import { handleError, MissingAppIdError } from "../utils/errors.js";
import { appIdOption, mcpSsePortOption } from "../utils/options.js";

type MCPArgs = {
  port?: "auto" | number;
};

export const mcpAction = async ({ port = 8050 }: MCPArgs) => {
  const { appId } = configStore.getConfig();
  let spinner: Ora | undefined;

  if (!appId) {
    return handleError(new MissingAppIdError(), "MCP");
  }

  try {
    const packageJSONPath = await findUp("package.json");
    if (!packageJSONPath) {
      throw new Error("Unable to determine version using package.json.");
    }
    const { version } = JSON.parse(
      (await readFile(packageJSONPath, "utf-8")) ?? "{}",
    );
    if (!version) {
      throw new Error("Unable to determine version using package.json.");
    }

    // Create an MCP server
    const mcp = new McpServer({
      name: "Bucket",
      version: version,
    });

    setInterval(async () => {
      try {
        await mcp.server.ping();
      } catch (error) {
        if (error instanceof Error) {
          console.error(`MCP server ping failed: ${error.message}`);
        } else {
          console.error(`MCP server ping failed: ${error}`);
        }
      }
    }, 10000);

    const app = express();
    const transportMap = new Map<string, SSEServerTransport>();

    app.get("/sse", async (_req, res) => {
      const transport = new SSEServerTransport("/messages", res);
      const sessionId = transport.sessionId;

      // Set the onclose handler to remove the transport from the transportMap
      transport.onclose = () => {
        transportMap.delete(sessionId);
        console.log(`Transport ${sessionId} has been closed.`);
      };

      // Set the onerror handler to log the error
      transport.onerror = (error) => {
        console.error(`Transport ${sessionId} error:`, error);
      };

      transportMap.set(sessionId, transport);
      await mcp.connect(transport);
      spinner?.succeed("Client connected to MCP server.");
    });

    app.post("/messages", async (req, res) => {
      const sessionId = req.query.sessionId?.toString();
      if (!sessionId) {
        res.status(400).json({ error: "SessionId is not found." });
        return;
      }

      const transport = transportMap.get(sessionId);
      if (!transport) {
        res.redirect("/sse");
        return;
      }

      await transport.handlePostMessage(req, res);
    });

    // Register tools and resources
    //registerMcpResources(mcp);
    await registerMcpTools(mcp, { appId });

    const server = app.listen(port !== "auto" ? port : 0, () => {
      // Get the port the server is listening on
      const address = server.address();
      const assignedPort =
        !!address && typeof address === "object" ? address.port : port;
      console.log(
        `\nMCP server listening at ${chalk.cyan(`http://localhost:${assignedPort}/sse.`)}`,
      );
      spinner = ora(`Waiting for connections...`).start();
    });
  } catch (error) {
    spinner?.fail("MCP server failed to start.");
    void handleError(error, "MCP");
  }
};

export function registerMcpCommand(cli: Command) {
  cli
    .command("mcp")
    .description(
      "Create an model context protocol (MCP) server between your AI assistant and the Bucket API (alpha).",
    )
    .action(mcpAction)
    .addOption(appIdOption)
    .addOption(mcpSsePortOption);

  // Update the config with the cli override values
  cli.hook("preAction", (_, command) => {
    const { appId } = command.opts();
    configStore.setConfig({
      appId,
    });
  });
}
