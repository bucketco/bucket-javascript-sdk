import { authRequest } from "../utils/auth.js";
import { KeyFormat } from "../utils/gen.js";

export type BootstrapResponse = {
  org: Org;
  user: User;
};

export type Org = {
  id: string;
  name: string;
  logoUrl: string;
  apps: App[];
  inviteKey: string;
  createdAt: Date;
  updatedAt: Date;
  trialEndsAt: null;
  suspendedAt: null;
  accessLevel: string;
  domain: null;
  domainAutoJoin: boolean;
  isGlobal: boolean;
  featureKeyFormat: KeyFormat;
};

export type Environment = {
  id: string;
  name: string;
  isProduction: boolean;
  order: number;
};

export type App = {
  id: string;
  name: string;
  demo: boolean;
  environments: Environment[];
};

export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  avatarUrl: string;
  isAdmin: boolean;
};

let bootstrapResponse: BootstrapResponse | null = null;

export async function bootstrap(): Promise<BootstrapResponse> {
  if (!bootstrapResponse) {
    bootstrapResponse = await authRequest<BootstrapResponse>(`/bootstrap`);
  }
  return bootstrapResponse;
}

export function getOrg(): Org {
  if (!bootstrapResponse) {
    throw new Error("CLI has not been bootstrapped.");
  }
  if (!bootstrapResponse.org) {
    throw new Error("No organization found.");
  }
  return bootstrapResponse.org;
}

export function listApps(): App[] {
  if (!bootstrapResponse) {
    throw new Error("CLI has not been bootstrapped.");
  }
  const org = bootstrapResponse.org;
  if (!org) {
    throw new Error("No organization found.");
  }
  if (!org.apps?.length) {
    throw new Error("No apps found.");
  }
  return bootstrapResponse.org.apps;
}

export function getApp(id: string): App {
  const apps = listApps();
  const app = apps.find((a) => a.id === id);
  if (!app) {
    throw new Error(`App with id ${id} not found`);
  }
  return app;
}

export function getUser(): User {
  if (!bootstrapResponse) {
    throw new Error("CLI has not been bootstrapped.");
  }
  if (!bootstrapResponse.user) {
    throw new Error("No user found.");
  }
  return bootstrapResponse.user;
}
