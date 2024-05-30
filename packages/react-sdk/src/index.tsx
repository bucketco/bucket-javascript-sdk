import BucketSingleton from "@bucketco/tracking-sdk";
import canonicalJSON from "canonical-json";
import type {
  Flags,
  Options as BucketSDKOptions,
  FeatureFlagsOptions,
} from "@bucketco/tracking-sdk";
import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

export type BucketInstance = typeof BucketSingleton;

type BucketContext = {
  bucket: BucketInstance;
  flags: Flags;
};

const Context = createContext<BucketContext>({
  bucket: BucketSingleton,
  flags: {},
});

export type BucketProps = BucketSDKOptions & {
  publishableKey: string;
  flags: FeatureFlagsOptions;
  children?: ReactNode;
  sdk?: BucketInstance;
};

export default function Bucket({ children, sdk, ...config }: BucketProps) {
  const [flags, setFlags] = useState<Flags>({});
  const [bucket] = useState(() => sdk ?? BucketSingleton);

  const contextKey = canonicalJSON(config);
  useEffect(() => {
    try {
      const { publishableKey, flags: flagOptions, ...options } = config;

      bucket.reset();
      bucket.init(publishableKey, options);
      bucket.getFeatureFlags(flagOptions).then((loadedFlags) => {
        setFlags(loadedFlags);
      });
    } catch (err) {
      console.error("[Bucket SDK]", err);
    }
  }, [contextKey]);

  const context: BucketContext = { bucket, flags };

  return <Context.Provider children={children} value={context} />;
}

export function useBucket() {
  return useContext<BucketContext>(Context).bucket;
}

export function useFeatureFlags() {
  return useContext<BucketContext>(Context).flags;
}

export function useFeatureFlag(key: string) {
  return useContext<BucketContext>(Context).flags[key]?.value ?? false;
}
