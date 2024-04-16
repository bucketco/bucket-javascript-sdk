// Example of using the Bucket SDK to get feature flags in React with Vite
import { useEffect, useState } from "react";
import bucket, { Flags } from "@bucket/tracking-sdk";

bucket.init(import.meta.env["VITE_BUCKET_KEY"]);

// Feature flags can be enabled for everyone by adding the flag key to
// REACT_APP_FLAGS env var as a comma separated list
export function useFeatureFlags({ context }: { context: object }) {
  const [flags, setFlags] = useState({} as Flags);

  useEffect(() => {
    const envFlags =
      import.meta.env["VITE_FEATURE_FLAGS"]
        ?.split(",")
        .map((flag) => flag.trim()) || [];

    bucket
      .getFeatureFlags({
        includeFlags: envFlags,
        context,
      })
      .then(setFlags);
  }, []);

  return flags;
}

export function EnabledFeaturesDebug({ context }: { context: object }) {
  const flags = useFeatureFlags({ context });
  return (
    <div>
      <h3>Enabled Features</h3>
      <pre>{JSON.stringify(flags, null, 2)}</pre>
    </div>
  );
}
