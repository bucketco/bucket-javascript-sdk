export interface Flag {
  value: boolean;
  key: string;
}
export type Flags = Record<string, Flag | undefined>;

export type FeatureFlagsOptions = {
  context: Record<string, any>;
  fallbackFlags?: Flag[];
  timeoutMs?: number;
  staleWhileRevalidate?: boolean;
};
