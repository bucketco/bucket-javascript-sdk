export interface Flag {
  value: boolean;
  key: string;
}
export type Flags = Record<string, Flag>;
