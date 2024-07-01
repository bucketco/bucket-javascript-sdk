const oneMinute = 60 * 1000;

const eventsByKey: Record<string, number[]> = {};

export default function rateLimited<T extends any[], R>(
  eventsPerMinute: number,
  key: string,
  func: (...args: T) => R,
): (...funcArgs: T) => R | void {
  return function (...funcArgs: T): R | void {
    const now = Date.now();

    if (!eventsByKey[key]) {
      eventsByKey[key] = [];
    }

    const events = eventsByKey[key];

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
