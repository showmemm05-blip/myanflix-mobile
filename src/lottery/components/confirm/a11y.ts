import { useEffect, useRef, type RefObject } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * The Confirm sheet's and Draw's "Your numbers" screen-reader helpers (moved
 * out of ConfirmSheet.tsx on 19 Oct 2026 so both lists speak the same way).
 */

/** One polite announcement (the boards' aria-live line). iOS queues it behind what VoiceOver is saying. */
export function announce(text: string): void {
  if (!text) return;
  if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true });
  else AccessibilityInfo.announceForAccessibility(text);
}

/**
 * Whether a screen reader is on, kept in a ref (read inside timers, never
 * drawn). With one on, the undo toasts do not time out: finding Undo by swipe
 * takes longer than 8 s.
 */
export function useScreenReaderOn(): RefObject<boolean> {
  const on = useRef(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (alive) on.current = value;
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", (value) => {
      on.current = value;
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}
