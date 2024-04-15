import fetch from "cross-fetch";

// Simple object check.
export function isObject(item: any): boolean {
  return item && typeof item === "object" && !Array.isArray(item);
}

// Deep merge two objects.
export function mergeDeep(
  target: Record<string, any>,
  ...sources: Record<string, any>[]
): Record<string, any> {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}

export async function getRequest(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error("Request failed, unexpected status code: " + res.status);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export interface Flag {
  value: boolean;
  key: string;
  reason?: string;
  missingContextFields?: string[];
}

export type Flags = Record<string, Flag>;

export type FeatureFlagsResponse = {
  success: boolean;
  flags: Flags;
};

const FLAG_FETCH_DEFAULT_TIMEOUT = 5000;

function flattenJSON(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key in obj) {
    if (typeof obj[key] === "object") {
      const flat = flattenJSON(obj[key]);
      for (const flatKey in flat) {
        result[`${key}.${flatKey}`] = flat[flatKey];
      }
    } else {
      result[key] = obj[key];
    }
  }
  return result;
}

const dedupeFetch: Record<string, Promise<Flags>> = {};

// fetch feature flags
// take care to avoid sending duplicate simultaneous requests
export async function getFlags({
  apiBaseUrl,
  context,
  timeoutMs,
  includeFlags,
}: {
  apiBaseUrl: string;
  context: object;
  timeoutMs?: number;
  includeFlags?: Flag[];
}): Promise<Flags> {
  const flattenedContext = flattenJSON({ context });

  const includeFlagsObj = includeFlags?.reduce((acc, flag) => {
    acc[flag.key] = flag;
    return acc;
  }, {} as Flags);

  const params = new URLSearchParams(flattenedContext);
  // sort the params to ensure that the URL is the same for the same context
  params.sort();
  const url = `${apiBaseUrl}/flags/evaluate?` + params.toString();

  if (!(url in dedupeFetch)) {
    dedupeFetch[url] = (async () => {
      try {
        const res = (await getRequest(
          url,
          timeoutMs || FLAG_FETCH_DEFAULT_TIMEOUT,
        )) as FeatureFlagsResponse;

        return {
          ...res.flags,
          ...includeFlagsObj,
        };
      } finally {
        delete dedupeFetch[url];
      }
    })();
  }

  return dedupeFetch[url];
}
