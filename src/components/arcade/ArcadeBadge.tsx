import { useEffect, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useIsFocused } from "@react-navigation/native";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme, withAlpha } from "@/theme";
import { useLanguage } from "@/localization/LanguageProvider";

/**
 * The badge vocabulary: every non-null Game["badge"] value plus "online",
 * which marks a live player-count figure rather than a shelf state.
 */
export type ArcadeBadgeKind = "live" | "new" | "trending" | "limited" | "comingSoon" | "online";

/**
 * Where a chip sits (Main.dc.html):
 * - `art` — stamped ON artwork: dark glass with role-coloured words.
 * - `tint` — on the page or a scrim: the role's own soft tint.
 * "new" is always the solid crimson tab, wherever it sits.
 */
export type ArcadeChipSurface = "art" | "tint";

/** Signage tone per badge — role colours as WORDS (crimson words read as `link`). */
const TONES: Record<ArcadeBadgeKind, string> = {
  live: theme.colors.danger,
  new: theme.colors.link,
  trending: theme.colors.warning,
  limited: theme.colors.premium,
  comingSoon: theme.colors.info,
  online: theme.colors.finance,
};

/**
 * The board's `beat`: a 1.8s opacity breath (1 → 0.35 → 1) for the live and
 * online dots. Under OS reduce motion the loop never starts — the dot renders
 * static at full opacity.
 */
export function PulseDot({ color, size = 6, ring = false }: { color: string; size?: number; ring?: boolean }) {
  const reduceMotion = useReducedMotion();
  // Home stays mounted behind the dock and under the Player, so without this
  // the dots on that screen keep breathing on the UI thread for the rest of
  // the session — including while the viewer is watching a film. Same guard
  // StoreHero applies to its auto-advance timer.
  const isFocused = useIsFocused();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion || !isFocused) return undefined;
    opacity.value = withRepeat(withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => {
      cancelAnimation(opacity);
      opacity.value = 1;
    };
  }, [reduceMotion, isFocused, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const dot = { width: size, height: size, borderRadius: size / 2, backgroundColor: color };

  if (ring) {
    // The board's `box-shadow: 0 0 0 4px` halo — breathes with the dot.
    const outer = size + 8;
    return (
      <Animated.View
        style={[
          styles.ring,
          { width: outer, height: outer, borderRadius: outer / 2, backgroundColor: withAlpha(color, 0.18) },
          animatedStyle,
        ]}
      >
        <View style={dot} />
      </Animated.View>
    );
  }
  return <Animated.View style={[dot, animatedStyle]} />;
}

/**
 * The arcade's label chip — 24pt (22pt `compact`), radius 6, a 12pt
 * extra-bold label. No border, no uppercase, no tracking: the label is
 * translated and may be Burmese.
 */
export function ArcadeChip({
  tone,
  surface = "art",
  solid,
  compact = false,
  children,
  style,
}: {
  /** Role colour of the words (and of the tint, on `tint`). */
  tone: string;
  surface?: ArcadeChipSurface;
  /** A solid fill instead (the crimson "New" tab); the words go white. */
  solid?: string;
  compact?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const fill = solid ?? (surface === "art" ? theme.colors.artBadge : withAlpha(tone, 0.16));
  return (
    <View style={[styles.chip, compact && styles.chipCompact, { backgroundColor: fill }, style]}>{children}</View>
  );
}

/** A chip's words — kept apart from any figure beside them, so the label stays one translated string. */
export function ChipLabel({ color, children }: { color: string; children: ReactNode }) {
  return (
    <ThemedText variant="label" weight="extrabold" color={color} style={styles.label}>
      {children}
    </ThemedText>
  );
}

interface Props {
  kind: ArcadeBadgeKind;
  surface?: ArcadeChipSurface;
  compact?: boolean;
  /**
   * A figure that belongs to the badge ("Online 3.2K"): drawn in white,
   * tabular, after the label — a sibling text node, never part of the
   * translated label.
   */
  count?: string;
  style?: StyleProp<ViewStyle>;
}

/** A shelf state as signage: Live, New, Trending, Limited, Coming soon, Online. */
export function ArcadeBadge({ kind, surface = "art", compact, count, style }: Props) {
  const { t } = useLanguage();
  const isNew = kind === "new";
  const tone = TONES[kind];
  const ink = isNew ? theme.colors.onPrimary : tone;
  const pulses = kind === "live" || kind === "online";

  return (
    <ArcadeChip
      tone={tone}
      surface={surface}
      solid={isNew ? theme.colors.primary : undefined}
      compact={compact}
      style={style}
    >
      {pulses && <PulseDot color={tone} />}
      <ChipLabel color={ink}>{t.arcade.badge[kind]}</ChipLabel>
      {count !== undefined && (
        <ThemedText variant="label" weight="extrabold" color={theme.colors.text} tabular style={styles.label}>
          {count}
        </ThemedText>
      )}
    </ArcadeChip>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    minHeight: 24,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  chipCompact: { minHeight: 22, paddingVertical: 1 },
  ring: { alignItems: "center", justifyContent: "center" },
  // 12pt extra-bold, no tracking: the label may be Burmese.
  label: { letterSpacing: 0 },
});
