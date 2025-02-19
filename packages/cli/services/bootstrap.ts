import { authRequest } from "../utils/auth.js";

type Environment = {
  id: string;
  name: string;
  isProduction: boolean;
  order: number;
};

type App = {
  id: string;
  name: string;
  demo: boolean;
  environments: Environment[];
};

type BootstrapResponse = {
  org: {
    apps: App[];
  };
};

export async function listApps() {
  const response = await authRequest<BootstrapResponse>(`/bootstrap`);
  return response.org.apps.map(({ id, name, demo }) => ({ id, name, demo }));
}

export async function listEnvs(appId: string) {
  const response = await authRequest<BootstrapResponse>(`/bootstrap`);
  return response.org.apps.find(({ id }) => id === appId)?.environments ?? [];
}
