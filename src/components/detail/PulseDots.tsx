import type { StyleProp, ViewStyle } from "react-native";
import { BusyDots } from "@/components/ui/BusyDots";
import { theme } from "@/theme";

interface Props {
  color?: string;
  /** Dot diameter. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Three pulsing dots for a busy CONTROL (the hero's Play while the episode
 * list loads, a "Show more" tile fetching its page) — Marquee never draws a
 * spinner. A thin wrapper over the shared BusyDots that keeps this folder's
 * 7pt default; decorative, so the hosting control carries the busy state and
 * the spoken label. Reduce motion holds the dots still.
 */
export function PulseDots({ color = theme.colors.text, size = 7, style }: Props) {
  return <BusyDots color={color} size={size} gap={Math.round(size * 0.7)} style={style} />;
}
