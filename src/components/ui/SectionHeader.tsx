import type { ReactNode } from "react";
import { Pressable, View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

interface Props {
  title: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  /**
   * Ink of the "See all" link. The boards differ by area, so the caller says:
   * "link" (default) — crimson-as-text, as Profile and Wallet draw it;
   * "text" — white, as Search draws it;
   * "muted" — #B3B3BD, as Books and BookDetail draw it.
   */
  seeAllTone?: "link" | "text" | "muted";
  /** Small quiet line above the title ("The shelf"). */
  eyebrow?: string;
  /** One quiet line under the title. */
  subtitle?: string;
  /**
   * Lines the title may wrap to before it ellipsizes. Defaults to 1, which is
   * right above a rail; a heading in a free-height column should raise it —
   * Burmese headings run ~50% longer than their English source and a clamped
   * one loses its last clause.
   */
  titleLines?: number;
  /** Same, for the subtitle. Defaults to 2. */
  subtitleLines?: number;
  /** Leading glyph, drawn plain beside the title (no tile). */
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * Role colour for the leading glyph and the eyebrow. Unset, both stay
   * neutral — Marquee headings carry no colour of their own.
   */
  accent?: string;
  /** Arbitrary right-hand accessory (used instead of the see-all link). */
  accessory?: ReactNode;
  /** Set false for headers inside an already-padded container. */
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SEE_ALL_INK = {
  link: theme.colors.link,
  text: theme.colors.text,
  muted: theme.colors.textMuted,
} as const;

/** A role colour used as WORDS: crimson reads as `link` (crimson text is only 4.1:1). */
function textInk(color: string): string {
  return color === theme.colors.primary || color === theme.colors.brand ? theme.colors.link : color;
}

/**
 * The one heading used above every rail, grid and grouped list — Marquee's
 * section type (19/26, extra-bold) with an optional quiet eyebrow above and a
 * "See all" on the right (crimson-text unless `seeAllTone` says otherwise).
 * No rule, no tile, no border.
 */
export function SectionHeader({
  title,
  onSeeAll,
  seeAllLabel = "See all",
  seeAllTone = "link",
  eyebrow,
  subtitle,
  titleLines = 1,
  subtitleLines = 2,
  icon,
  accent,
  accessory,
  inset = true,
  style,
}: Props) {
  return (
    <View style={[styles.container, inset && styles.inset, style]}>
      <View style={styles.left}>
        {icon ? <Ionicons name={icon} size={18} color={accent ?? theme.colors.textMuted} /> : null}
        <View style={styles.titleBlock}>
          {eyebrow && (
            <ThemedText
              variant="caption"
              weight="semibold"
              numberOfLines={1}
              color={accent ? textInk(accent) : theme.colors.textFaint}
            >
              {eyebrow}
            </ThemedText>
          )}
          <ThemedText variant="section" numberOfLines={titleLines} accessibilityRole="header">
            {title}
          </ThemedText>
          {subtitle && (
            <ThemedText variant="caption" numberOfLines={subtitleLines} color={theme.colors.textFaint}>
              {subtitle}
            </ThemedText>
          )}
        </View>
      </View>

      {accessory ??
        (onSeeAll ? (
          <Pressable
            onPress={onSeeAll}
            style={({ pressed }) => [styles.seeAllButton, pressed && styles.pressed]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={seeAllLabel}
          >
            <ThemedText variant="muted" weight="extrabold" color={SEE_ALL_INK[seeAllTone]}>
              {seeAllLabel}
            </ThemedText>
            <Ionicons name="chevron-forward" size={14} color={SEE_ALL_INK[seeAllTone]} />
          </Pressable>
        ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    marginBottom: 14,
  },
  inset: { paddingHorizontal: theme.layout.screenPadding },
  left: { flex: 1, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  titleBlock: { flex: 1, gap: 2 },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: theme.layout.minTouch,
    paddingLeft: theme.spacing.sm,
    justifyContent: "flex-end",
  },
  pressed: { opacity: 0.7 },
});
