import { Logger } from "./logger";

const oneMinute = 60 * 1000;

export default class RateLimiter {
  private eventsByKey: Record<string, number[]> = {};

  constructor(
    private eventsPerMinute: number,
    private logger: Logger,
  ) {}

  public rateLimited<R>(key: string, func: () => R): R | undefined {
    const now = Date.now();

    if (!this.eventsByKey[key]) {
      this.eventsByKey[key] = [];
    }

    const events = this.eventsByKey[key];

    while (events.length && now - events[0] > oneMinute) {
      events.shift();
    }

    const limitExceeded = events.length >= this.eventsPerMinute;
    if (limitExceeded) {
      this.logger.debug("Rate limit exceeded", { key });
      return;
    }

    events.push(now);
    return func();
  }
}
