import { useSyncExternalStore } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * iOS "Reduce Transparency" (Settings → Accessibility → Display & Text Size),
 * shared by every glass control in the top bars (GlassFace) and the top
 * scroll-edge fade (GlassBar). There can be dozens of glass buttons on screen
 * at once, so the setting is read ONCE for the whole app and followed by ONE
 * listener here, instead of one listener per button.
 *
 * iOS only: React Native cannot read Android's equivalent (e.g. Samsung One
 * UI's "Reduce transparency and blur") and reports false there, so on Android
 * this stays false. The bottom bar (TabBar.tsx) keeps its own private copy of
 * the same rule; switching it to this hook is a possible later tidy-up.
 */

/** The last known value; false until iOS has answered, so the glass shows first. */
let current = false;
let started = false;
const listeners = new Set<() => void>();

function publish(value: boolean) {
  if (value === current) return;
  current = value;
  listeners.forEach((listener) => listener());
}

/**
 * Starts reading on the first subscriber and then keeps following the setting
 * for the app's whole life: it is one cheap listener, and a later screen then
 * gets the right answer on its first frame.
 */
function start() {
  if (started || Platform.OS !== "ios") return;
  started = true;
  // A change event is newer than the first read, whichever arrives first.
  let settled = false;
  AccessibilityInfo.addEventListener("reduceTransparencyChanged", (value) => {
    settled = true;
    publish(value);
  });
  AccessibilityInfo.isReduceTransparencyEnabled()
    .then((value) => {
      if (!settled) publish(value);
    })
    .catch(() => {
      // Unknown: keep the glass.
    });
}

function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return current;
}

/** True while iOS Reduce Transparency is on; always false on Android. */
export function useReduceTransparency(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
