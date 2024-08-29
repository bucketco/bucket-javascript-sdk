import { AxiosError } from "axios";
import chalk from "chalk";

import { authRequest } from "../utils/auth.js";
import { genDTS } from "../utils/gen.js";

type Feature = {
  name: string;
  createdAt: string;
};

export async function listFeatures(appId: string): Promise<Feature[]> {
  try {
    const response = await authRequest(
      `/apps/${appId}/features?envId=enPa3R6khIKcWA`,
    );
    return response.data.map(({ name, createdAt }: Feature) => ({
      name,
      createdAt,
    }));
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      console.dir(error.response.data, { depth: null });
    }
    throw error;
  }
}

export async function createFeature() {
  // Implement feature creation logic here
  console.log("Feature creation not implemented yet.");
}

export async function genFeatureTypes(appId: string) {
  try {
    const response = await authRequest(
      `/apps/${appId}/features?envId=enPa3R6khIKcWA`,
    );
    return genDTS(
      response.data.map(({ flagKey }: { flagKey: string }) => flagKey),
    ) as string;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      console.error(chalk.red("Authentication failed."), error.response.data);
    }
    throw error;
  }
}

export async function rolloutFeature() {
  // Implement feature rollout logic here
  console.log("Feature rollout not implemented yet.");
}
