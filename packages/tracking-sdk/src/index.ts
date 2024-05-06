import main from "./main";

export { Flags, Flag, queryStringFromContext } from "./flags";

let instance: ReturnType<typeof main> | null = null;

if (!instance) {
  instance = main();
}

export default instance!;
