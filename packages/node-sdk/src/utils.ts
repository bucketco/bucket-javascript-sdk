const oneMinute = 60 * 1000;

/**
 * Create a rate-limited function that calls the given function at most `eventsPerMinute` times per minute.
 *
 * @param eventsPerMinute - The maximum number of events per minute.
 * @param func - The function to call.
 * @returns The rate-limited function.
 **/
export function rateLimited<T extends any[], R>(
  eventsPerMinute: number,
  func: (...args: T) => R,
): (...funcArgs: T) => R | void {
  ok(
    typeof eventsPerMinute === "number" && eventsPerMinute > 0,
    "eventsPerMinute must be a positive number",
  );
  ok(typeof func === "function", "func must be a function");

  const events: number[] = [];
  return function (...funcArgs: T): R | void {
    const now = Date.now();

    while (events.length && now - events[0] > oneMinute) {
      events.shift();
    }

    if (events.length >= eventsPerMinute) {
      return;
    }

    events.push(now);
    return func(...funcArgs);
  };
}

/**
 * Create a read-only proxy for the given object that notifies a callback when a property is accessed.
 *
 * @param obj - The object to proxy.
 * @param callback - The callback to notify.
 * @returns The proxy object.
 **/
export function readNotifyProxy<T extends object, K extends keyof T>(
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
      throw new Error(
        `Cannot modify property '${String(prop)}' of the object.`,
      );
    },
  });
}

/**
 * Assert that the given condition is `true`.
 *
 * @param condition - The condition to check.
 * @param message - The error message to throw.
 **/
export function ok(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Check if the given item is an object.
 *
 * @param item - The item to check.
 * @returns `true` if the item is an object, `false` otherwise.
 **/
export function isObject(item: any) {
  return (item && typeof item === "object" && !Array.isArray(item)) || false;
}

/**
 * Deep merge two objects.
 *
 * @param target - The target object.
 * @param sources - The source objects.
 * @returns The merged object.
 **/
export function mergeDeep(
  target: Record<string, any>,
  ...sources: Record<string, any>[]
): Record<string, any> {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}
