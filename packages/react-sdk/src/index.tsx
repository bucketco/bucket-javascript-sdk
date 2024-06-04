import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import canonicalJSON from "canonical-json";

import type {
  FeatureFlagsOptions,
  Flags,
  Options as BucketSDKOptions,
} from "@bucketco/tracking-sdk";
import BucketSingleton from "@bucketco/tracking-sdk";

export type BucketInstance = typeof BucketSingleton;

type BucketContext = {
  bucket: BucketInstance;
  flags: {
    flags: Flags;
    isLoading: boolean;
  };
};

const Context = createContext<BucketContext>({
  bucket: BucketSingleton,
  flags: {
    flags: {},
    isLoading: true,
  },
});

export type BucketProps = BucketSDKOptions & {
  publishableKey: string;
  flags: FeatureFlagsOptions;
  children?: ReactNode;
  sdk?: BucketInstance;
};

export default function Bucket({ children, sdk, ...config }: BucketProps) {
  const [flags, setFlags] = useState<Flags>({});
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [bucket] = useState(() => sdk ?? BucketSingleton);

  const contextKey = canonicalJSON(config);
  useEffect(() => {
    try {
      const { publishableKey, flags: flagOptions, ...options } = config;

      bucket.reset();
      bucket.init(publishableKey, options);

      setFlagsLoading(true);

      bucket
        .getFeatureFlags(flagOptions)
        .then((loadedFlags) => {
          setFlags(loadedFlags);
          setFlagsLoading(false);
        })
        .catch((err) => {
          console.error("[Bucket SDK] Error fetching flags:", err);
        });
    } catch (err) {
      console.error("[Bucket SDK] Unknown error:", err);
    }
  }, [contextKey]);

  const context: BucketContext = {
    bucket,
    flags: { flags, isLoading: flagsLoading },
  };

  return <Context.Provider children={children} value={context} />;
}

export function useBucket() {
  return useContext<BucketContext>(Context).bucket;
}

export function useFeatureFlags() {
  const { isLoading, flags } = useContext<BucketContext>(Context).flags;
  return { isLoading, flags };
}

export function useFeatureFlag(key: string) {
  const flags = useContext<BucketContext>(Context).flags;
  const flag = flags.flags[key];

  if (!flags.isLoading && flag === undefined) {
    console.error(`[Bucket SDK] The feature flag "${key}" was not found`);
  }

  const value = flag?.value ?? null;

  return { isLoading: flags.isLoading, value: value };
}
