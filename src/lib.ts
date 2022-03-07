import main from "./main";
import { Key, Options } from "./types";

let instance: ReturnType<typeof main> | null = null;

export default function lib(key: Key, options?: Options) {
  if (!instance) {
    instance = main(key, options);
  }
  return instance;
}
