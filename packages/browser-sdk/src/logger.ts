export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export const quietConsoleLogger = {
  debug(_: string) {},
  info(_: string) {},
  warn(message: string, ...args: any[]) {
    console.warn(message, ...args);
  },
  error(message: string, ...args: any[]) {
    console.error(message, ...args);
  },
};

export function loggerWithPrefix(logger: Logger, prefix: string): Logger {
  return {
    debug(message: string, ...args: any[]) {
      logger.debug(`${prefix} ${message}`, ...args);
    },
    info(message: string, ...args: any[]) {
      logger.info(`${prefix} ${message}`, ...args);
    },
    warn(message: string, ...args: any[]) {
      logger.warn(`${prefix} ${message}`, ...args);
    },
    error(message: string, ...args: any[]) {
      logger.error(`${prefix} ${message}`, ...args);
    },
  };
}
