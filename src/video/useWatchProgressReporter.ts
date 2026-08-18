import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useReportWatchProgress } from "@/hooks/useVideo";

const REPORT_INTERVAL_MS = 15000;

/**
 * Reports watch progress every 15s while playing, plus immediately on
 * pause/seek/unmount/app-background — not on every onProgress tick (~500ms),
 * which would hammer the backend. Coalesces overlapping reports so a fast
 * pause-then-unmount only sends the latest position, not both.
 */
export function useWatchProgressReporter(movieId: string, durationSeconds: number) {
  const { mutate } = useReportWatchProgress();
  const positionRef = useRef(0);
  const isReportingRef = useRef(false);
  const pendingRef = useRef<number | null>(null);

  const report = useCallback(
    (lastPosition: number) => {
      if (durationSeconds <= 0) return;
      const progress = Math.min(100, (lastPosition / durationSeconds) * 100);

      if (isReportingRef.current) {
        pendingRef.current = lastPosition;
        return;
      }
      isReportingRef.current = true;
      mutate(
        { movieId, progress, lastPosition },
        {
          onSettled: () => {
            isReportingRef.current = false;
            const next = pendingRef.current;
            if (next !== null) {
              pendingRef.current = null;
              report(next);
            }
          },
        },
      );
    },
    [movieId, durationSeconds, mutate],
  );

  // Always call the latest `report` closure, even from a cleanup function
  // registered on an earlier render (e.g. the mount-only unmount effect).
  const reportRef = useRef(report);
  reportRef.current = report;

  const updatePosition = useCallback((seconds: number) => {
    positionRef.current = seconds;
  }, []);

  const reportNow = useCallback(() => reportRef.current(positionRef.current), []);

  useEffect(() => {
    const interval = setInterval(() => reportRef.current(positionRef.current), REPORT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") reportRef.current(positionRef.current);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    return () => reportRef.current(positionRef.current);
  }, []);

  return { updatePosition, reportNow };
}
