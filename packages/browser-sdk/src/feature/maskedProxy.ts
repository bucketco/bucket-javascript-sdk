export default function maskedProxy<T extends object, K extends keyof T, O>(
  obj: T,
  valueFunc: (target: T, prop: K) => O,
) {
  return new Proxy(obj, {
    get(target: T, prop) {
      if (typeof prop === "symbol") {
        return target[prop as K];
      }
      return valueFunc(target, prop as K);
    },
    set(_target, prop, _value) {
      console.error(`Cannot modify property '${String(prop)}' of the object.`);
      return true;
    },
  }) as Readonly<Record<K, O>>;
}
