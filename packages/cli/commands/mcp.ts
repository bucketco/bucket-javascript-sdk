import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import chalk from "chalk";
import { Command } from "commander";
import express from "express";
import { findUp } from "find-up";
import { readFile } from "node:fs/promises";
import ora, { Ora } from "ora";

import { registerMcpFeatures } from "../mcp/features.js";
import { handleError } from "../utils/errors.js";

type MCPArgs = {
  port?: "auto" | number;
};

export const mcpAction = async ({ port = 8050 }: MCPArgs) => {
  let spinner: Ora | undefined;
  try {
    const packageJSONPath = await findUp("package.json");
    if (!packageJSONPath) {
      throw new Error("Unable to determine version using package.json");
    }
    const { version } = JSON.parse(
      (await readFile(packageJSONPath, "utf-8")) ?? "{}",
    );
    if (!version) {
      throw new Error("Unable to determine version using package.json");
    }

    // Create an MCP server
    const mcp = new McpServer({
      name: "Bucket",
      version: version,
    });

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

      transportMap.set(sessionId, transport);
      await mcp.connect(transport);
      spinner?.succeed("Client connected to MCP server");
    });

    app.post("/messages", async (req, res) => {
      const sessionId = req.query.sessionId?.toString();
      if (!sessionId) {
        res.status(400).json({ error: "SessionId is not found" });
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
    registerMcpFeatures(mcp);

    const server = app.listen(port !== "auto" ? port : 0, () => {
      // Get the port the server is listening on
      const address = server.address();
      const assignedPort =
        !!address && typeof address === "object" ? address.port : port;
      console.log(
        `\nMCP server listening at ${chalk.cyan(`http://localhost:${assignedPort}/sse`)}`,
      );
      spinner = ora(`Waiting for connections...`).start();
    });
  } catch (error) {
    spinner?.fail("MCP server failed to start");
    void handleError(error, "MCP");
  }
};

export function registerMcpCommand(cli: Command) {
  cli
    .command("mcp")
    .description(
      "Create an model context protocol (MCP) server between your AI assistant and the Bucket API.",
    )
    .action(mcpAction);
}
