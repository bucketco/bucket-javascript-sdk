export interface Flag {
  value: boolean;
  key: string;
}

export type FlagsResponse = Record<string, Flag>;

export type FeatureFlagsOptions = {
  context: Record<string, any>;
  fallbackFlags?: string[];
  timeoutMs?: number;
  staleWhileRevalidate?: boolean;
};
