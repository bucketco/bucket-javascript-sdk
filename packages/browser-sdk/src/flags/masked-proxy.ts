export default function maskedProxy<T extends object, K extends keyof T, O>(
  obj: T,
  valueFunc: (target: T, prop: K) => O,
) {
  return new Proxy(obj, {
    get(target: T, prop) {
      const val = target[prop as K];

      if (val !== undefined || prop === "constructor") {
        return valueFunc(target, prop as K);
      }

      return undefined;
    },
    set(_target, prop, _value) {
      console.error(`Cannot modify property '${String(prop)}' of the object.`);
      return true;
    },
  }) as Readonly<Record<K, O>>;
}
