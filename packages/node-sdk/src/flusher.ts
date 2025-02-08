import { constants } from "os";

import { END_FLUSH_TIMEOUT_MS } from "./config";

type Callback = () => Promise<void>;

const killSignals = ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"] as const;

export function subscribe(
  callback: Callback,
  timeout: number = END_FLUSH_TIMEOUT_MS,
) {
  let state: boolean | undefined;

  const wrappedCallback = async () => {
    if (state !== undefined) {
      return;
    }

    state = false;

    try {
      const result = await Promise.race([
        new Promise((resolve) => setTimeout(() => resolve(true), timeout)),
        callback(),
      ]);

      if (result === true) {
        console.error(
          "[Bucket SDK] Timeout while flushing events on process exit.",
        );
      }
    } catch (error) {
      console.error(
        "[Bucket SDK] An error occurred while flushing events on process exit.",
        error,
      );
    }

    state = true;
  };

  killSignals.forEach((signal) => {
    const hasListeners = process.listenerCount(signal) > 0;

    if (hasListeners) {
      process.prependListener(signal, wrappedCallback);
    } else {
      process.on(signal, async () => {
        await wrappedCallback();
        process.exit(0x100 + constants.signals[signal]);
      });
    }
  });

  process.on("beforeExit", wrappedCallback);
  process.on("exit", () => {
    if (!state) {
      console.error(
        "[Bucket SDK] Failed to finalize the flushing of events on process exit.",
      );
    }
  });
}
