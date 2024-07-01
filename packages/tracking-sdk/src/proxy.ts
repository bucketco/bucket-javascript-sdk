export function readonly<T extends object, K extends keyof T>(
  obj: T,
  callback?: (key: K, value: T[K]) => void,
): T {
  return new Proxy(obj, {
    get(target: T, prop) {
      const val = target[prop as K];

      if (val !== undefined) {
        callback?.(prop as K, val);
      }

      return target[prop as K];
    },
    set(_target, prop, _value) {
      console.error(`Cannot modify property '${String(prop)}' of the object.`);
      return true;
    },
  });
}
