import { queryStringFromContext, Flags } from "@bucketco/js-sdk";
import bucket from "@bucketco/js-sdk";
import { Flag } from "@bucketco/js-sdk/src/flags";
import React, { createContext, useEffect, useState } from "react";

export default bucket;

export interface FlagsContext {
  flags?: Flags;
  isLoading: boolean;
}

export const FlagsContext = createContext<FlagsContext>({ isLoading: true });

const DEFAULT_FEATURE_FLAG_TIMEOUT_MS = 4000;

export function FeatureFlagProvider({
  context,
  staleWhileRevalidate = true,
  timeoutMs = DEFAULT_FEATURE_FLAG_TIMEOUT_MS,
  fallbackFlags = [],
}: {
  context: object;
  staleWhileRevalidate?: boolean;
  timeoutMs?: number;
  fallbackFlags?: Flag[];
}) {
  const [flags, setFlags] = useState<Flags | undefined>(undefined);

  const fallbackFlagsKey = fallbackFlags
    .map((flag) => [flag.key, flag.value])
    .join(",");

  useEffect(() => {
    bucket
      .getFeatureFlags({
        context,
        fallbackFlags,
        staleWhileRevalidate,
        timeoutMs,
      })
      .then(setFlags);
  }, [
    queryStringFromContext(context),
    staleWhileRevalidate,
    timeoutMs,
    fallbackFlagsKey,
  ]);

  return (
    <FlagsContext.Provider value={{ flags, isLoading: flags === undefined }} />
  );
}

export function useFeatureFlag(key: string): boolean {
  const { flags } = React.useContext(FlagsContext);
  return flags?.[key]?.value ?? false;
}

export function useFeatureFlags(): Flags | undefined {
  const { flags } = React.useContext(FlagsContext);
  return flags;
}
