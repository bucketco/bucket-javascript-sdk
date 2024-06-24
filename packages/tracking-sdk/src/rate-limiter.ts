const oneMinute = 60 * 1000;

export default function rateLimited<T extends any[], R>(
  eventsPerMinute: number,
  func: (...args: T) => R,
): (...funcArgs: T) => R | void {
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
