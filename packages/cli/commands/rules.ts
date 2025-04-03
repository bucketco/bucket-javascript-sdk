import chalk from "chalk";
import { Command } from "commander";
import { copyFile, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ora from "ora";

import { configStore } from "../stores/config.js";
import { handleError } from "../utils/errors.js";
import { rulesFormatOption } from "../utils/options.js";

type RulesArgs = {
  format?: string;
};

export const rulesAction = async ({ format = "cursor" }: RulesArgs = {}) => {
  const spinner = ora("Adding rules...").start();
  try {
    if (format === "cursor") {
      // Create .cursor/rules directory if it doesn't exist
      const projectPath = configStore.getProjectPath();
      const rulesDir = join(projectPath, ".cursor", "rules");
      await mkdir(rulesDir, { recursive: true });

      // Copy bucket.mdc to .cursor/rules/
      const filePath = fileURLToPath(import.meta.url);
      const rulesPath = join(
        filePath.substring(0, filePath.lastIndexOf("cli") + 3),
        "rules",
        "bucket.cursor.md",
      );
      const destPath = join(rulesDir, "bucket.mdc");
      await copyFile(rulesPath, destPath);

      spinner.succeed(
        `Rules added to ${chalk.cyan(relative(projectPath, destPath))}`,
      );
    } else {
      spinner.info(`No rules added. Invalid format ${chalk.cyan(format)}.`);
    }
  } catch (error) {
    spinner.fail("Failed to copy rules.");
    void handleError(error, "Rules");
  }
};

export function registerRulesCommand(cli: Command) {
  cli
    .command("rules")
    .description("Add Bucket LLM rules to your project.")
    .addOption(rulesFormatOption)
    .action(rulesAction);
}
