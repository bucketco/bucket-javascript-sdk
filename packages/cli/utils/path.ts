import chalk from "chalk";
import slugMod from "slug";

import { DEFAULT_BASE_URL } from "./constants.js";

export type UrlArgs = { id: string; name: string };

export function slug({ id, name }: UrlArgs) {
  return `${slugMod(name).substring(0, 15)}-${id}`;
}

export function stripTrailingSlash<T extends string | undefined>(str: T): T {
  return str?.endsWith("/") ? (str.slice(0, -1) as T) : str;
}

export const baseUrlSuffix = (baseUrl: string) => {
  return baseUrl !== DEFAULT_BASE_URL ? ` at ${chalk.cyan(baseUrl)}` : "";
};

export const loginUrl = (baseUrl: string, localPort: number) =>
  `${baseUrl}/login?redirect_url=` +
  encodeURIComponent("/cli-login?port=" + localPort);

export function environmentUrl(baseUrl: string, environment: UrlArgs): string {
  return `${baseUrl}/envs/${slug(environment)}`;
}

export function featureUrl(
  baseUrl: string,
  env: UrlArgs,
  feature: UrlArgs,
): string {
  return `${environmentUrl(baseUrl, env)}/features/${slug(feature)}`;
}
