export function readonly<T extends object, K extends keyof T>(
  obj: T,
  properties?: K[],
  callback?: (target: T, property: K) => void,
): T {
  return new Proxy(obj, {
    get(target: T, prop) {
      if (!properties || properties.includes(prop as K)) {
        callback?.(target, prop as K);
      }

      return target[prop as K];
    },
    set(_target, prop, _value) {
      throw new Error(
        `Cannot modify property '${String(prop)}' of the object.`,
      );
    },
  });
}
