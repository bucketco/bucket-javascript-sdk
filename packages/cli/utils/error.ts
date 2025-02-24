import { AxiosError } from "axios";
import chalk from "chalk";

export function handleError(error: unknown, tag: string) {
  tag = chalk.bold(`[${tag}] error:`);

  if (error instanceof AxiosError && error.response?.data) {
    const data = error.response.data;
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
  } else if (typeof error === "string") {
    console.error(chalk.red(tag, error));
  } else {
    console.error(chalk.red(tag ?? "An unknown error occurred:", error));
  }
  process.exit(1);
}
