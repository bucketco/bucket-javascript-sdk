import main from "./main";

let instance: ReturnType<typeof main> | null = null;

if (!instance) {
  instance = main();
}

export default instance!;
