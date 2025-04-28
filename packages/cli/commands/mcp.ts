import { confirm, input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { Command } from "commander";
import JSON5 from "json5";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import ora, { type Ora } from "ora";

import { listApps } from "../services/bootstrap.js";
import {
  resolveConfigPath,
  SupportedEditor,
  SupportedEditors,
} from "../services/mcp.js";
import { configStore } from "../stores/config.js";
import { handleError, MissingAppIdError } from "../utils/errors.js";
import { fileExists } from "../utils/file.js";
import { appIdOption, editorOption } from "../utils/options.js";

export const mcpAction = async (options: {
  editor?: SupportedEditor;
  appId?: string;
}) => {
  let spinner: Ora | undefined;
  const config = configStore.getConfig();
  let selectedAppId = options.appId || config.appId;
  let selectedAppName = "Default"; // Placeholder, will be fetched

  try {
    // 1. Select Editor
    let editor = options.editor;
    if (!editor) {
      editor = await select({
        message: "Which editor do you want to configure?",
        choices: SupportedEditors.map((name) => ({ name, value: name })),
      });
    }
    if (!editor || !SupportedEditors.includes(editor)) {
      throw new Error(`Unsupported editor: ${editor}`);
    }

    // 2. Select App ID (if not provided/in config)
    if (!selectedAppId) {
      spinner = ora("Loading apps...").start();
      const apps = await listApps();
      spinner.succeed("Apps loaded.");

      const nonDemoApps = apps.filter((app) => !app.demo);

      if (nonDemoApps.length === 0) {
        throw new Error(
          "No non-demo apps found. Please create an app in Bucket first.",
        );
      } else if (nonDemoApps.length === 1) {
        selectedAppId = nonDemoApps[0].id;
        selectedAppName = nonDemoApps[0].name;
        console.log(
          `Automatically selected app ${chalk.cyan(selectedAppName)} (${chalk.cyan(selectedAppId)}).`,
        );
      } else {
        const longestName = Math.max(
          ...nonDemoApps.map((app) => app.name.length),
        );
        selectedAppId = await select({
          message: "Select the Bucket app to use:",
          choices: nonDemoApps.map((app) => ({
            name: `${app.name.padEnd(longestName, " ")} (${app.id})`,
            value: app.id,
          })),
        });
        const selectedApp = nonDemoApps.find((app) => app.id === selectedAppId);
        if (!selectedApp) throw new Error("App selection failed."); // Should not happen
        selectedAppName = selectedApp.name;
      }
    } else {
      // If appId was provided or from config, try to find its name
      try {
        spinner = ora("Fetching app details...").start();
        const apps = await listApps(); // Consider caching or a dedicated getApp(id) service call
        const foundApp = apps.find((app) => app.id === selectedAppId);
        if (foundApp) selectedAppName = foundApp.name;
        else
          console.warn(
            chalk.yellow(`Could not verify app name for ID: ${selectedAppId}`),
          );
        spinner.succeed("App details fetched.");
      } catch {
        spinner?.fail("Failed to fetch app details.");
        // Non-fatal, continue with default name or just ID
        console.warn(
          chalk.yellow("Could not fetch app details, using default name."),
        );
      }
    }

    if (!selectedAppId) {
      // This handles the case where appId wasn't provided, wasn't in config, and couldn't be selected
      return handleError(new MissingAppIdError(), "MCP Configuration");
    }

    // 3. Determine Config Path
    const projectPath = configStore.getProjectPath();
    const globalPath = resolveConfigPath(editor, false);
    const localPath = resolveConfigPath(editor, true);
    const fullLocalPath = localPath ? join(projectPath, localPath) : undefined;

    if (!globalPath) {
      throw new Error(`Unsupported platform for editor: ${editor}`);
    }

    const targetConfigPath = await select({
      message: "Configure global or project-local settings?",
      choices: [
        { name: `Global (${globalPath})`, value: globalPath },
        ...(fullLocalPath
          ? [
              {
                name: `Local (${relative(projectPath, fullLocalPath)})`,
                value: fullLocalPath,
              },
            ]
          : []),
      ],
    });

    // 4. Read/Parse Config File
    spinner = ora(
      `Reading configuration file: ${chalk.cyan(targetConfigPath)}...`,
    ).start();
    let editorConfig: any = {};
    try {
      if (await fileExists(targetConfigPath)) {
        const content = await readFile(targetConfigPath, "utf-8");
        // Attempt to parse JSON, handle potential comments if needed (though standard settings.json shouldn't have them)
        try {
          editorConfig = JSON5.parse(content);
        } catch (parseError) {
          spinner.fail(
            `Failed to parse configuration file ${chalk.cyan(targetConfigPath)}.`,
          );
          throw parseError; // Re-throw original error if cleaning fails
        }
        spinner.succeed("Configuration file read.");
      } else {
        spinner.info("Configuration file not found, will create a new one.");
        editorConfig = {}; // Initialize empty config if file doesn't exist
      }
    } catch (error: any) {
      // Handle file access errors separately from parsing errors
      if (error.code !== "ENOENT") {
        // ENOENT means file not found, which is handled above
        spinner.fail("Failed to read configuration file.");
        console.error(
          chalk.red(`Error reading ${targetConfigPath}: ${error.message}`),
        );
        const proceed = await confirm({
          message: "Reading failed. Attempt to overwrite the file?",
          default: false,
        });
        if (!proceed) return;
        editorConfig = {}; // Start fresh if reading failed and user agreed
      } else {
        // This case should ideally be caught by the fileExists check, but handle defensively
        spinner.info("Configuration file not found, creating a new one.");
        editorConfig = {};
      }
    }

    // Ensure mcpServers object exists
    editorConfig.mcpServers = editorConfig.mcpServers || {};

    // 5. Identify existing Bucket entries
    const existingBucketEntries = Object.keys(editorConfig.mcpServers).filter(
      (key) => /bucket/i.test(key),
    );

    // 6. Prompt for Add/Update
    let targetEntryKey: string;
    const defaultNewKey = `Bucket - ${selectedAppName}`; // Add part of ID for uniqueness

    if (existingBucketEntries.length === 0) {
      targetEntryKey = defaultNewKey;
      console.log(`Adding new MCP server entry: ${chalk.cyan(targetEntryKey)}`);
    } else if (existingBucketEntries.length === 1) {
      const existingKey = existingBucketEntries[0];
      const shouldUpdate = await confirm({
        message: `Found existing entry: ${chalk.cyan(existingKey)}. Update it? (Choosing 'No' will prompt for a new name)`,
        default: true,
      });
      if (shouldUpdate) {
        targetEntryKey = existingKey;
        console.log(
          `Updating existing MCP server entry: ${chalk.cyan(targetEntryKey)}`,
        );
      } else {
        targetEntryKey = await input({
          message: "Enter a name for the new Bucket MCP server entry:",
          default: defaultNewKey,
          // Basic validation to prevent empty names
          validate: (value) =>
            value.trim().length > 0 ? true : "Name cannot be empty.",
        });
      }
    } else {
      // Multiple existing entries
      const choices = [
        ...existingBucketEntries.map((key) => ({
          name: `Update: ${key}`,
          value: key,
        })),
        { name: "Add new entry", value: "add_new" }, // Add a new entry explicitly
        { name: "Cancel", value: "cancel" }, // Allow user to back out
      ];
      const choice = await select({
        message: "Multiple Bucket MCP entries found. Choose an action:",
        choices,
      });

      if (choice === "cancel") {
        console.log("Operation cancelled.");
        return;
      } else if (choice === "add_new") {
        targetEntryKey = await input({
          message: "Enter a name for the new Bucket MCP server entry:",
          default: defaultNewKey,
          validate: (value) =>
            value.trim().length > 0 ? true : "Name cannot be empty.",
        });
      } else {
        // User chose an existing key to update
        targetEntryKey = choice;
        console.log(
          `Updating existing MCP server entry: ${chalk.cyan(targetEntryKey)}`,
        );
      }
    }

    // 7. Construct MCP Entry Value
    const apiUrl = configStore.getConfig("apiUrl"); // Get configured API URL
    if (!apiUrl) {
      throw new Error(
        "API URL is not configured. Run `bucket init` or set it in the config file.",
      );
    }
    // Construct the MCP endpoint URL, ensuring no double slashes and adding /mcp
    const mcpUrlBase = apiUrl.replace(/\/$/, "") + "/mcp";
    const mcpUrlWithAppId = `${mcpUrlBase}?appId=${selectedAppId}`;

    const newEntryValue = {
      type: "stdio",
      command: "npx", // Assuming npx is standard
      args: [
        "mcp-remote@next", // Use the specified package
        mcpUrlWithAppId, // Always include appId explicitly
      ],
    };

    // 8. Update Config Object
    editorConfig.mcpServers[targetEntryKey] = newEntryValue;

    // 9. Write Config File
    spinner = ora(
      `Writing configuration to ${chalk.cyan(targetConfigPath)}...`,
    ).start();
    try {
      // Ensure the directory exists before writing
      await mkdir(dirname(targetConfigPath), { recursive: true });
      const configString = JSON.stringify(editorConfig, null, 2); // Pretty print JSON
      await writeFile(targetConfigPath, configString);
      spinner.succeed(
        `Configuration updated successfully in ${chalk.cyan(targetConfigPath)}.`,
      );
      console.log(
        chalk.grey(
          "You may need to restart your editor for changes to take effect.",
        ),
      );
    } catch (error) {
      spinner.fail("Failed to write configuration file.");
      void handleError(error, "MCP Configuration");
    }
  } catch (error) {
    spinner?.fail("MCP configuration failed.");
    void handleError(error, "MCP Configuration");
  }
};

export function registerMcpCommand(cli: Command) {
  cli
    .command("mcp")
    .description("Configure Bucket's remote MCP server for your AI assistant.")
    .addOption(appIdOption) // Keep existing appId option
    .addOption(editorOption) // Add new editor option
    .action(mcpAction);

  // Update the config with the cli override values
  cli.hook("preAction", (_, command) => {
    const { appId } = command.opts();
    configStore.setConfig({
      appId,
    });
  });
}
