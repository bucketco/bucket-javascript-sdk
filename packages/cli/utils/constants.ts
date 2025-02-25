import { createRequire } from "module";
import { join } from "path";
import chalk from "chalk";

// https://github.com/nodejs/node/issues/51347#issuecomment-2111337854
const packageJson = createRequire(import.meta.url)("../../package.json");

export const CONFIG_FILE_NAME = "bucket.config.json";
export const AUTH_FILE = join(
  process.env.HOME ?? process.env.USERPROFILE ?? "",
  ".bucket-auth",
);
export const SCHEMA_URL = `https://unpkg.com/@bucketco/cli@${packageJson.version}/schema.json`;

export const DEFAULT_BASE_URL = "https://app.bucket.co";
export const DEFAULT_API_URL = `${DEFAULT_BASE_URL}/api`;
export const DEFAULT_TYPES_PATH = join("gen", "features.ts");

export const loginUrl = (baseUrl: string, localPort: number) =>
  `${baseUrl}/login?redirect_url=` +
  encodeURIComponent("/cli-login?port=" + localPort);

export const chalkBrand = chalk.hex("#847CFB");
