import { authRequest } from "../utils/auth.js";
import { KeyFormat } from "../utils/config.js";

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
  return response.org.apps.map(({ id, name, demo }) => ({
    id,
    name,
    demo,
    featureKeyFormat: org.featureKeyFormat ?? "custom",
  }));
}
