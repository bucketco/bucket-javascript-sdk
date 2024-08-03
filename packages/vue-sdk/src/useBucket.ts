import { computed, inject } from "vue";
import { BucketInjectionKey } from "./BucketPlugin";
import type { BucketFlags } from "./BucketPlugin";

export function useBucket() {
  const bucket = inject(BucketInjectionKey);
  if (!bucket) {
    throw new Error("Bucket not found. Make sure to provide the BucketPlugin.");
  }
  return bucket
}

export function useFlagIsEnabled(flagKey: BucketFlags) {
  const bucket = useBucket();
  return computed(() => bucket.state.flags[flagKey] ?? false);
}

export function useFlag(key: BucketFlags) {
  const bucket = useBucket();
  return computed(() => ({
    isLoading: bucket.state.isLoading,
    isEnabled: bucket.state.flags[key] ?? false,
  }));
}

export function useFlags() {
  const bucket = useBucket();
  return computed(() => ({
    isLoading: bucket.state.isLoading,
    flags: bucket.state.flags,
  }));
}

export function useTrack() {
  const bucket = useBucket();
  return bucket.track;
}

export function useRequestFeedback() {
  const bucket = useBucket();
  return bucket.requestFeedback;
}

export function useSendFeedback() {
  const bucket = useBucket();
  return bucket.sendFeedback;
}
