const oneMinute = 60 * 1000;

const eventsByKey: Record<string, number[]> = {};

export default function rateLimited<T extends any[], R>(
  eventsPerMinute: number,
  keyFunc: (...args: T) => string,
  func: (limitExceeded: boolean, ...args: T) => R,
): (...funcArgs: T) => R {
  return function (...funcArgs: T): R {
    const now = Date.now();

    const key = keyFunc(...funcArgs);

    if (!eventsByKey[key]) {
      eventsByKey[key] = [];
    }

    const events = eventsByKey[key];

    while (events.length && now - events[0] > oneMinute) {
      events.shift();
    }

    const limitExceeded = events.length >= eventsPerMinute;
    const res = func(limitExceeded, ...funcArgs);

    if (!limitExceeded) {
      events.push(now);
    }

    return res;
  };
}
