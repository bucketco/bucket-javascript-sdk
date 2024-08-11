import { inject } from "vue";
import { BucketInjectionKey } from "./BucketPlugin";
import type { BucketFeatures } from "./BucketPlugin";

export function useBucket() {
  const bucket = inject(BucketInjectionKey);
  if (!bucket) {
    throw new Error("Bucket not found. Make sure to provide the BucketPlugin.");
  }
  return bucket;
}

export function useFeature(key: BucketFeatures) {
  const bucket = useBucket();
  return {
    isLoading: bucket.state.isLoading,
    isEnabled: bucket.state.features[key] ?? false,
    track: () => bucket.track(key),
  };
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
