import main from "./main";

export type { FeatureFlagsOptions, Flag, Flags } from "./flags";
export type { Options } from "./types";

let instance: ReturnType<typeof main> | null = null;

if (!instance) {
  instance = main();
}

export default instance!;
