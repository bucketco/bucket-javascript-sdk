import { useState, useEffect, useCallback } from "preact/hooks";

export const useAutoClose = ({
  initialDuration,
  enabled,
  onEnd,
}: {
  initialDuration: number;
  enabled: boolean;
  onEnd: () => void;
}): {
  duration: number;
  elapsedFraction: number;
  startTime: number;
  endTime: number;
  stopped: boolean;
  startWithDuration: (duration: number) => void;
  stop: () => void;
} => {
  const [stopped, setStopped] = useState(!enabled);
  const [duration, setDuration] = useState(initialDuration);
  const [startTime, setStartTime] = useState(Date.now());
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (stopped) return;

    const t = setInterval(() => {
      setCurrentTime(Date.now());

      if (Date.now() >= startTime + duration) {
        clearTimeout(t);
        setStopped(true);
        onEnd();
      }
    }, 25);

    return () => {
      clearTimeout(t);
    };
  }, [stopped]);

  const stop = useCallback(() => {
    setStopped(true);
  }, []);

  const startWithDuration = useCallback((nextDuration: number) => {
    setStartTime(Date.now());
    setDuration(nextDuration);
    setStopped(false);
  }, []);

  const endTime = startTime + duration;
  const elapsedMs = stopped ? 0 : currentTime - startTime;
  const elapsedFraction = elapsedMs / duration;

  return {
    duration,
    elapsedFraction,
    startTime,
    endTime,
    stopped,
    startWithDuration,
    stop,
  };
};
