import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { lotteryService } from "@/services/lottery.service";
import { useAuthStore } from "@/store/authStore";

/** How often a foregrounded, signed-in customer says "still here" (the server keeps one row per hour). */
export const PRESENCE_INTERVAL_MS = 5 * 60_000;

/** Two pings closer than this are one: mount + an immediate "active" event, or a quick background/foreground. */
export const PRESENCE_MIN_GAP_MS = 30_000;

/**
 * The lottery presence ping (analytics 2026-10-23, contract §7): while a
 * signed-in user is inside the Lottery, `POST /lottery/activity` on entering,
 * on the app coming back to the foreground, and every five minutes while it
 * stays there — so the admin's "active users" series can count them. Guests
 * are never counted and never pinged.
 *
 * Fire-and-forget: every error is swallowed (no toast, no retry, at most one
 * `__DEV__` warning per mount), and nothing here renders. Mounted ONCE, in
 * LotteryNavigator, so every lottery screen counts without knowing about it.
 *
 * Lifecycle hygiene follows video/useWatchProgressReporter: the interval runs
 * only while the app is active and is cleared on background and on unmount;
 * the AppState subscription is removed on unmount; a ref timestamp stops a
 * double ping inside 30 s (mount fires, then AppState may report "active"
 * straight away); signing out mid-visit tears everything down, signing in
 * mid-visit starts it.
 */
export function useLotteryPresence(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const lastPingAtRef = useRef(0);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    let disposed = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const ping = () => {
      if (disposed) return;
      const now = Date.now();
      if (now - lastPingAtRef.current < PRESENCE_MIN_GAP_MS) return;
      lastPingAtRef.current = now;
      lotteryService.pingActivity().catch((err: unknown) => {
        if (__DEV__ && !warnedRef.current) {
          warnedRef.current = true;
          console.warn("[lottery] presence ping failed (ignored):", err);
        }
      });
    };

    const startInterval = () => {
      if (interval !== null) return;
      interval = setInterval(ping, PRESENCE_INTERVAL_MS);
    };
    const stopInterval = () => {
      if (interval === null) return;
      clearInterval(interval);
      interval = null;
    };

    const onAppState = (state: AppStateStatus) => {
      if (state === "active") {
        ping();
        startInterval();
      } else {
        stopInterval();
      }
    };

    // Entering the Lottery while the app is on screen: ping now and start the clock.
    // Mounting while backgrounded (rare, e.g. a deep link) waits for the first "active".
    if (AppState.currentState === "active" || AppState.currentState === "unknown") {
      ping();
      startInterval();
    }
    const subscription = AppState.addEventListener("change", onAppState);

    return () => {
      disposed = true;
      stopInterval();
      subscription.remove();
    };
  }, [isAuthenticated]);
}
