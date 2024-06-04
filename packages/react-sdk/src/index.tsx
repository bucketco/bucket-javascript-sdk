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

/**
 * Returns the instance of the Bucket Tracking SDK in use. This can be used to make calls to Bucket, including `track` and `feedback` calls, e.g.
 *
 * ```ts
 * const bucket = useBucket();
 *
 * bucket.track("sent_message", { foo: "bar" }, "john_doe", "company_id");
 * ```
 *
 * See the [Tracking SDK documentation](https://github.com/bucketco/bucket-tracking-sdk/blob/main/packages/tracking-sdk/README.md) for usage information.
 */
export function useBucket() {
  return useContext<BucketContext>(Context).bucket;
}

/**
 * Returns feature flags as an object, e.g.
 *
 * ```ts
 * const featureFlags = useFeatureFlags();
 * // {
 * //   "isLoading": false,
 * //   "flags: {
 * //     "join-huddle": {
 * //       "key": "join-huddle",
 * //       "value": true
 * //     },
 * //     "post-message": {
 * //       "key": "post-message",
 * //       "value": true
 * //     }
 * //   }
 * // }
 * ```
 */
export function useFeatureFlags() {
  const { isLoading, flags } = useContext<BucketContext>(Context).flags;
  return { isLoading, flags };
}

/**
 * Returns the state of a given feature flag for the current context, e.g.
 *
 * ```ts
 * const joinHuddleFlag = useFeatureFlag("join-huddle");
 * // {
 * //   "isLoading": false,
 * //   "value": true,
 * // }
 * ```
 */
export function useFeatureFlag(key: string) {
  const flags = useContext<BucketContext>(Context).flags;
  const flag = flags.flags[key];

  if (!flags.isLoading && flag === undefined) {
    console.error(`[Bucket SDK] The feature flag "${key}" was not found`);
  }

  const value = flag?.value ?? null;

  return { isLoading: flags.isLoading, value: value };
}
