import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dockClearance } from "@/theme";

/**
 * The exact bottom padding a scrolling tab-root screen needs on THIS device so
 * its last row clears the floating dock with 20pt of air (104pt above the
 * safe-area bottom inset).
 *
 * `theme.layout.tabBarClearance` is the static stand-in StyleSheets use; it
 * assumes the tallest common inset (48dp) so it never under-pads. Prefer this
 * hook where a screen can take its padding at render time.
 *
 * LAYOUT ONLY. This hook must never fetch, cache or derive data.
 */
export function useDockClearance(): number {
  const insets = useSafeAreaInsets();
  return dockClearance(insets.bottom);
}
