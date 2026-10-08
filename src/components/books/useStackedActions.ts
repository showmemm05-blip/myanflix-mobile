import { useWindowDimensions } from "react-native";

/**
 * Whether two side-by-side buttons should stack instead (LAYOUT ONLY).
 *
 * The shared Button keeps its label on one line, so a pair that shares a row
 * on the 390pt board would cut "စတင်ဖတ်မည်" short on a 320pt phone or at a
 * large OS text size. Key labels wrap or move — they are never truncated — so
 * below that room the pair goes one above the other.
 */
export function useStackedActions(): boolean {
  const { width, fontScale } = useWindowDimensions();
  return width < 360 || fontScale >= 1.3;
}
