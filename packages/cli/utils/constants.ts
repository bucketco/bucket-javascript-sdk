import { join } from "path";

export const CONFIG_FILE_NAME = "bucket.config.json";
export const AUTH_FILE = join(
  process.env.HOME ?? process.env.USERPROFILE ?? "",
  ".bucket-auth",
);
export const SCHEMA_URL = `https://unpkg.com/@bucketco/cli@latest/schema.json`;

export const DEFAULT_BASE_URL = "https://app.bucket.co";
export const DEFAULT_API_URL = `${DEFAULT_BASE_URL}/api`;
export const DEFAULT_TYPES_OUTPUT = join("gen", "features.ts");

export const loginUrl = (baseUrl: string, localPort: number) =>
  `${baseUrl}/login?redirect_url=` +
  encodeURIComponent("/cli-login?port=" + localPort);
