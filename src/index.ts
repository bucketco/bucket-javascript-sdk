import main from "./main";

export type { Flags } from "./flags";

let instance: ReturnType<typeof main> | null = null;

if (!instance) {
  instance = main();
}

export default instance!;
