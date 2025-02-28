import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { AUTH_FILE } from "../utils/constants.js";

class AuthStore {
  protected tokens: Map<string, string> = new Map();

  async initialize() {
    await this.loadTokenFile();
  }

  protected async loadTokenFile() {
    try {
      const content = await readFile(AUTH_FILE, "utf-8");
      this.tokens = new Map(
        content
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [baseUrl, token] = line.split("|");
            return [baseUrl, token];
          }),
      );
    } catch {
      // No tokens file found
    }
  }

  protected async saveTokenFile(newTokens: Map<string, string>) {
    const content = Array.from(newTokens.entries())
      .map(([baseUrl, token]) => `${baseUrl}|${token}`)
      .join("\n");
    await mkdir(dirname(AUTH_FILE), { recursive: true });
    await writeFile(AUTH_FILE, content);
    this.tokens = newTokens;
  }

  getToken(baseUrl: string) {
    return this.tokens.get(baseUrl);
  }

  async setToken(baseUrl: string, newToken?: string) {
    if (newToken) {
      this.tokens.set(baseUrl, newToken);
    } else {
      this.tokens.delete(baseUrl);
    }
    await this.saveTokenFile(this.tokens);
  }
}

export const authStore = new AuthStore();
