import os from "node:os";
import { join } from "node:path";

export const CLIENT_VERSION_HEADER_NAME = "bucket-sdk-version";
export const CLIENT_VERSION_HEADER_VALUE = (version: string) =>
  `cli/${version}`;

export const CONFIG_FILE_NAME = "bucket.config.json";
export const AUTH_FILE = join(os.homedir(), ".bucket-auth");
export const SCHEMA_URL = `https://unpkg.com/@bucketco/cli@latest/schema.json`;

export const DEFAULT_BASE_URL = "https://app.bucket.co";
export const DEFAULT_API_URL = `${DEFAULT_BASE_URL}/api`;
export const DEFAULT_TYPES_OUTPUT = join("gen", "features.d.ts");
