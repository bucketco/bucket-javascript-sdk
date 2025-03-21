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

export async function handleMcpError(error: unknown): Promise<{
  isError: true;
  content: Array<{ type: "text"; text: string }>;
}> {
  let errorMessage: string;

  if (error instanceof Response) {
    try {
      const data = await error.json();
      errorMessage = data.error?.message ?? data.error?.code ?? "API Error";

      if (data.validationErrors) {
        const validationDetails = data.validationErrors
          .map(
            ({ path, message }: { path: string[]; message: string }) =>
              `- ${path.join(".")}: ${message}`,
          )
          .join("\n");
        errorMessage += "\nValidation Errors:\n" + validationDetails;
      }
    } catch {
      errorMessage = `API Error: ${error.statusText} (${error.status})`;
    }
  } else if (error instanceof Error) {
    errorMessage = error.message;
    if (error.cause) {
      errorMessage += `\nCause: ${JSON.stringify(error.cause)}`;
    }
  } else if (typeof error === "string") {
    errorMessage = error;
  } else {
    errorMessage = "An unknown error occurred: " + JSON.stringify(error);
  }

  return {
    isError: true,
    content: [{ type: "text", text: errorMessage }],
  };
}
