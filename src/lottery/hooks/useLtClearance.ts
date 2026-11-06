import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LT_LAYOUT } from "@/lottery/theme/tokens";

/**
 * The bottom padding a Lottery scroll view needs on THIS device (lt-base
 * `--lt-dock-clear` / `--lt-bar-clear`):
 *  - `dock`: the last content ends 16 above the dock — inset + 20 + 64 + 16
 *    (100 above the inset);
 *  - `bar`: Draw and DreamTickets, where the buy bar floats 12 above the
 *    dock — inset + 20 + 64 + 12 + 100 + 16 (212 above the inset).
 *
 * LAYOUT ONLY: never fetch or derive data here.
 */
export function useLtClearance(): { dock: number; bar: number } {
  const insets = useSafeAreaInsets();
  const dockTop = insets.bottom + LT_LAYOUT.dockLift + LT_LAYOUT.dockH;
  return {
    dock: dockTop + LT_LAYOUT.contentAir,
    bar: dockTop + LT_LAYOUT.barGap + LT_LAYOUT.barH + LT_LAYOUT.contentAir,
  };
}
