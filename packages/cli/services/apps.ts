import { AxiosError } from "axios";
import chalk from "chalk";

import { authRequest } from "../utils/auth.js";

type App = {
  id: string;
  name: string;
  demo: boolean;
};

export async function listApps(): Promise<App[]> {
  try {
    const response = await authRequest(`/bootstrap`);
    return response.org.apps;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      console.error(chalk.red("Authentication failed."), error.response.data);
    }
    return [];
  }
}
