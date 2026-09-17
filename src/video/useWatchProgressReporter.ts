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
/** A fully resolved report — the episode is part of it, never re-derived later. */
interface ProgressReport {
  movieId: string;
  progress: number;
  lastPosition: number;
}

export function useWatchProgressReporter(movieId: string, durationSeconds: number) {
  const { mutate } = useReportWatchProgress();
  const positionRef = useRef(0);
  const isReportingRef = useRef(false);
  const pendingRef = useRef<ProgressReport | null>(null);

  /**
   * Queues one report, coalescing anything that arrives while a request is in
   * flight. What is parked is the WHOLE report, episode id included, because
   * this hook now outlives an episode: the player swaps episodes without
   * remounting, so a request started for the outgoing episode can still settle
   * after the incoming one has begun reporting. Parking a bare position and
   * resolving the episode at send time would replay the new episode's seconds
   * against the old episode's id — quietly destroying its resume point.
   */
  const send = useCallback(
    (payload: ProgressReport) => {
      if (isReportingRef.current) {
        pendingRef.current = payload;
        return;
      }
      isReportingRef.current = true;
      mutate(payload, {
        onSettled: () => {
          isReportingRef.current = false;
          const next = pendingRef.current;
          if (next) {
            pendingRef.current = null;
            send(next);
          }
        },
      });
    },
    [mutate],
  );

  const report = useCallback(
    (lastPosition: number) => {
      if (durationSeconds <= 0) return;
      const progress = Math.min(100, (lastPosition / durationSeconds) * 100);
      send({ movieId, progress, lastPosition });
    },
    [movieId, durationSeconds, send],
  );

  // Always call the latest `report` closure, even from a cleanup function
  // registered on an earlier render (e.g. the mount-only unmount effect).
  const reportRef = useRef(report);
  reportRef.current = report;

  const updatePosition = useCallback((seconds: number) => {
    positionRef.current = seconds;
  }, []);

  const reportNow = useCallback(() => reportRef.current(positionRef.current), []);

  /**
   * The last position this INTERVAL sent. Only the interval is gated by it:
   * every explicit flush (pause, seek, episode swap, background, unmount) goes
   * through `reportNow`, which does not consult it.
   *
   * The doc comment above promises "every 15s while playing", but the interval
   * has no play-state input and the Player is never unmounted while the app is
   * foregrounded — it even holds the screen awake — so a paused player used to
   * PATCH a byte-identical position forever: ~240 authenticated round trips an
   * hour, each one a Keystore read and a server-side write, saying nothing.
   * Comparing against the last sent position makes a still picture cost one
   * report instead of four a minute, and changes nothing during playback,
   * where the position moves every tick.
   */
  const lastSentPositionRef = useRef<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (lastSentPositionRef.current === positionRef.current) return;
      lastSentPositionRef.current = positionRef.current;
      reportRef.current(positionRef.current);
    }, REPORT_INTERVAL_MS);
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
