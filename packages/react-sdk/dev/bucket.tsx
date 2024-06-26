import { TypedBucket } from "../src";

const flags = {
  huddle: false,
};

export const MyBucket = TypedBucket(flags);

// must manually export each hook unfortunately
export const {
  useFlag,
  useFlags,
  useRequestFeedback,
  useCompany,
  useUser,
  useOtherContext,
  useTrack,
} = MyBucket;
