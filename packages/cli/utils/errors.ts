import { ExitPromptError } from "@inquirer/core";
import { ErrorObject } from "ajv";
import chalk from "chalk";

export class MissingAppIdError extends Error {
  constructor() {
    super(
      "App ID is required. Please provide it with --appId or in the config file. Use `bucket apps list` to see available apps.",
    );
    this.name = "MissingAppIdError";
  }
}

export class MissingEnvIdError extends Error {
  constructor() {
    super("Environment ID is required.");
    this.name = "MissingEnvIdError";
  }
}

export class ConfigValidationError extends Error {
  constructor(errors?: ErrorObject[] | null) {
    const messages = errors
      ?.map((e) => {
        const path = e.instancePath || "config";
        const value = e.params?.allowedValues
          ? `: ${e.params.allowedValues.join(", ")}`
          : "";
        return `${path}: ${e.message}${value}`;
      })
      .join("\n");
    super(messages);
    this.name = "ConfigValidationError";
  }
}

export async function handleError(error: unknown, tag: string) {
  tag = chalk.bold(`\n[${tag}] error:`);

  if (error instanceof ExitPromptError) {
    process.exit(0);
  } else if (error instanceof Response) {
    const data = await error.json();
    console.error(chalk.red(tag, data.error?.message ?? data.error?.code));
    if (data.validationErrors) {
      console.table(
        data.validationErrors.map(
          ({ path, message }: { path: string[]; message: string }) => ({
            path: path.join("."),
            error: message,
          }),
        ),
      );
    }
  } else if (error instanceof Error) {
    console.error(chalk.red(tag, error.message));
    if (error.cause) console.error(error.cause);
  } else if (typeof error === "string") {
    console.error(chalk.red(tag, error));
  } else {
    console.error(chalk.red(tag ?? "An unknown error occurred:", error));
  }
  process.exit(1);
}
