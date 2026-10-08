import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/theme";

/**
 * How far the transparent AppTopBar reaches down over the hero: the status-bar
 * inset, the bar's 8pt top padding, and its 44pt control row — or the
 * wordmark's 28pt line once the OS text size grows it past 44.
 *
 * LAYOUT ONLY. Mirrors AppBar's geometry so Home can (a) keep hero copy clear
 * of the bar, (b) size the frosted glass that fades in behind the bar on
 * scroll (components/layout/GlassBar), and (c) land "All games" just below it.
 */
export function useArcadeTopBarHeight(): number {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return insets.top + theme.spacing.sm + Math.max(theme.layout.minTouch, 28 * fontScale);
}

/**
 * A text line's height at the current OS text size, with Marquee's +4 for
 * Burmese — the worst case, so a reservation built from it never clips.
 */
export function lineAt(lineHeight: number, fontScale: number): number {
  return (lineHeight + 4) * fontScale;
}
