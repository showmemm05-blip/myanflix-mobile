import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme, withAlpha } from "@/theme";
import { useLanguage } from "@/localization/LanguageProvider";

/**
 * The badge vocabulary: every non-null Game["badge"] value plus "online",
 * which marks a live player-count figure rather than a shelf state.
 */
export type ArcadeBadgeKind = "live" | "new" | "trending" | "limited" | "comingSoon" | "online";

interface Props {
  kind: ArcadeBadgeKind;
  style?: StyleProp<ViewStyle>;
}

/** Signage tone per badge — deliberately role colours, not the pill palette. */
const TONES: Record<ArcadeBadgeKind, string> = {
  live: theme.colors.danger,
  new: theme.colors.primary,
  trending: theme.colors.warning,
  limited: theme.colors.premium,
  comingSoon: theme.colors.info,
  online: theme.colors.finance,
};

/**
 * A ~1.8s opacity breath for the "live"/"online" dot. Under OS reduce motion
 * the loop never starts — the dot renders static at full opacity.
 */
export function PulseDot({ color }: { color: string }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return undefined;
    opacity.value = withRepeat(withTiming(0.45, { duration: 900 }), -1, true);
    return () => {
      cancelAnimation(opacity);
      opacity.value = 1;
    };
  }, [reduceMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, animatedStyle]} />;
}

/**
 * Sharp signage chip — deliberately NOT the app's rounded Pill. A figure that
 * belongs beside a badge (a player count next to "Online") is a sibling
 * SlugText at the call site, never part of the label.
 */
export function ArcadeBadge({ kind, style }: Props) {
  const { t } = useLanguage();
  const tone = TONES[kind];
  const pulses = kind === "live" || kind === "online";

  return (
    <View
      style={[
        styles.chip,
        { borderColor: withAlpha(tone, 0.4), backgroundColor: withAlpha(tone, 0.16) },
        style,
      ]}
    >
      {pulses && <PulseDot color={tone} />}
      <ThemedText variant="caption" weight="semibold" style={[styles.label, { color: tone }]}>
        {t.arcade.badge[kind]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  // 11pt sans label — no letterSpacing/uppercase: the label may be Burmese.
  label: { fontSize: 11, lineHeight: 15 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
