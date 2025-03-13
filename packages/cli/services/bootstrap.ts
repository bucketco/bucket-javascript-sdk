import { KeyFormat } from "../stores/config.js";
import { authRequest } from "../utils/auth.js";

export type BootstrapResponse = {
  org: OrgResponse;
  user: UserResponse;
};

export type OrgResponse = {
  id: string;
  name: string;
  logoUrl: string;
  apps: AppResponse[];
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

export type AppResponse = {
  id: string;
  name: string;
  demo: boolean;
};

export type UserResponse = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  avatarUrl: string;
  isAdmin: boolean;
};

export type App = {
  id: string;
  name: string;
  demo: boolean;
  featureKeyFormat: KeyFormat;
};

let bootstrapResponse: BootstrapResponse | null = null;

export async function bootstrap(): Promise<BootstrapResponse> {
  if (!bootstrapResponse) {
    bootstrapResponse = await authRequest<BootstrapResponse>(`/bootstrap`);
  }
  return bootstrapResponse;
}

export function listApps(): App[] {
  if (!bootstrapResponse) {
    throw new Error("Failed to load bootstrap response");
  }
  const org = bootstrapResponse.org;
  if (!org) {
    throw new Error("No organization found");
  }
  if (!org.apps?.length) {
    throw new Error("No apps found");
  }
  return bootstrapResponse.org.apps.map(({ id, name, demo }) => ({
    name,
    id,
    featureKeyFormat: org.featureKeyFormat ?? "custom",
    demo,
  }));
}

export function getApp(id: string): App {
  const apps = listApps();
  const app = apps.find((a) => a.id === id);
  if (!app) {
    throw new Error(`App with id ${id} not found`);
  }
  return app;
}

export function getUser(): UserResponse {
  if (!bootstrapResponse) {
    throw new Error("Failed to load bootstrap response");
  }
  return bootstrapResponse.user;
}
