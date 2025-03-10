import { KeyFormat } from "../stores/config.js";
import { authRequest } from "../utils/auth.js";

type BootstrapResponse = {
  org: {
    apps: {
      id: string;
      name: string;
      demo: boolean;
    }[];
    featureKeyFormat?: KeyFormat;
  };
};

export type App = {
  id: string;
  name: string;
  demo: boolean;
  featureKeyFormat: KeyFormat;
};

export async function listApps(): Promise<App[]> {
  const response = await authRequest<BootstrapResponse>(`/bootstrap`);
  const org = response.org;
  if (!org) {
    throw new Error("No organization found");
  }
  if (!org.apps?.length) {
    throw new Error("No apps found");
  }
  return response.org.apps.map((app) => ({
    ...app,
    featureKeyFormat: org.featureKeyFormat ?? "custom",
  }));
}
