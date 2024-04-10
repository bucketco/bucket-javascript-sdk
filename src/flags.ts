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

async function getRequest(
  url: string,
  queryParams: Record<string, string>,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const params = new URLSearchParams(queryParams);
  params.sort();

  try {
    return fetch(url + "?" + params.toString(), {
      method: "GET",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export interface Flag {
  value: boolean;
  identifier: string;
  reason?: string;
  missingContextFields?: string[];
}

export type Flags = Record<string, Flag>;

type FeatureFlagsResponse = {
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

function wrapWithFlagAccessorInterceptor(flags: Flags) {
  const handler = (flagKey: string) => {
    console.log("Flag accessed: ", flagKey);
  };

  const interceptedFlags = new Proxy(flags, {
    get(target, prop, receiver) {
      handler(prop.toString());
      return Reflect.get(target, prop, receiver);
    },
  });
  return interceptedFlags;
}

// fetch feature flags
// take care to avoid sending duplicate simultaneous requests
export async function getFlags(
  apiBaseUrl: string,
  context: object,
  timeoutMs?: number,
): Promise<Flags> {
  const flattenedContext = flattenJSON({ context });

  const params = new URLSearchParams(flattenedContext);
  // sort the params to ensure that the URL is the same for the same context
  params.sort();
  const url = `${apiBaseUrl}/flags/evaluate?` + params.toString();

  if (!(url in dedupeFetch)) {
    dedupeFetch[url] = (async () => {
      try {
        const res = await getRequest(
          url,
          flattenedContext,
          timeoutMs || FLAG_FETCH_DEFAULT_TIMEOUT,
        );
        const typeRes = (await res.json()) as FeatureFlagsResponse;
        return wrapWithFlagAccessorInterceptor(typeRes.flags);
      } finally {
        delete dedupeFetch[url];
      }
    })();
  }

  return dedupeFetch[url];
}
