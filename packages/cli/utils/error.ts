import { AxiosError } from "axios";
import chalk from "chalk";

export function handleError(error: unknown, message?: string | null) {
  if (error instanceof AxiosError && error.response?.data) {
    const data = error.response.data;
    console.error(
      chalk.red(
        message ?? "Network request error:",
        data.error?.message ?? data.error?.code,
      ),
    );
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
    console.error(message, error.message);
  } else if (typeof error === "string") {
    console.error(message, error);
  } else {
    console.error(message ?? "An unknown error occurred:", error);
  }
  process.exit(1);
}
