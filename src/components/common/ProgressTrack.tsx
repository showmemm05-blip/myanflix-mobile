import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { clamp } from "@/utils/format";
import { theme } from "@/theme";

interface Props {
  /** 0–1. Values outside the range are clamped. */
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
}

/** Thin non-interactive progress line (continue-watching, upload, plan usage). */
export function ProgressTrack({ progress, height = 3, color = theme.colors.primary, trackColor, style }: Props) {
  const clamped = clamp(Number.isFinite(progress) ? progress : 0, 0, 1);

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height, backgroundColor: trackColor ?? theme.colors.overlay },
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color, borderRadius: height }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: "hidden", width: "100%" },
  fill: { height: "100%" },
});
