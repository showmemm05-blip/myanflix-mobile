import { memo } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Chip } from "@/components/common/Chip";
import { theme, withAlpha } from "@/theme";
import type { MovieCategoryRef } from "@/types/category";

/*
 * The small building blocks of a title page's body (MovieDetail.dc.html /
 * SeriesDetail.dc.html), shared by MovieDetails and SeriesDetails so the two
 * pages can never drift: the stat strip, the quality + meta line, the tappable
 * category chips, the icon-over-label action row and the two access notes.
 */

/* ------------------------------------------------------------------ */

export interface StatItem {
  key: string;
  label: string;
  value: string;
  /** A gold star before the value (the rating cell). */
  star?: boolean;
}

/**
 * RATING · YEAR · LENGTH · AGE — overline labels over 18pt extra-bold values,
 * hairline-separated. Cells only exist for values the catalogue really has.
 * Cells wrap to a second row rather than squeezing a Burmese label or a
 * large-text value into an ellipsis.
 */
export function StatStrip({ items }: { items: StatItem[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.stats}>
      {items.map((item, index) => (
        <View
          key={item.key}
          style={[styles.statCell, index > 0 && styles.statCellDivided]}
          accessible
          accessibilityLabel={`${item.label}: ${item.value}`}
        >
          <ThemedText variant="overline" color={theme.colors.textFaint}>
            {item.label.toUpperCase()}
          </ThemedText>
          <View style={styles.statValueRow}>
            {item.star ? <Ionicons name="star" size={15} color={theme.colors.premium} /> : null}
            <ThemedText weight="extrabold" tabular style={styles.statValue}>
              {item.value}
            </ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The quiet line under the stats: an outlined quality tag ("1080p", only when
 * the API reports a rendition) and the meta parts joined with "·".
 */
export function MetaLine({ quality, parts }: { quality?: string | null; parts: Array<string | null | undefined> }) {
  const text = parts.filter((part): part is string => !!part && part.trim().length > 0).join(" · ");
  if (!quality && text.length === 0) return null;
  return (
    <View style={styles.metaLine}>
      {quality ? (
        <View style={styles.qualityTag}>
          <ThemedText variant="label" weight="bold" color={theme.colors.textBody} tabular style={styles.qualityText}>
            {quality}
          </ThemedText>
        </View>
      ) : null}
      {text.length > 0 ? (
        <ThemedText variant="caption" weight="regular" color={theme.colors.textMuted} style={styles.metaText}>
          {text}
        </ThemedText>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */

/** The title's categories as 34pt chips — each opens that category's page. */
export function CategoryChips({
  categories,
  onSelect,
  style,
}: {
  categories: MovieCategoryRef[];
  onSelect: (category: MovieCategoryRef) => void;
  style?: StyleProp<ViewStyle>;
}) {
  if (categories.length === 0) return null;
  return (
    <View style={[styles.chips, style]}>
      {categories.map((category) => (
        <Chip
          key={category.id}
          label={category.name}
          labelLines={2}
          onPress={() => onSelect(category)}
          style={styles.chipMax}
        />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */

export interface DetailAction {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  onPress: () => void;
  /** Spoken name — defaults to the visible label. */
  accessibilityLabel?: string;
  /** A toggle's state (the favourites heart). */
  selected?: boolean;
}

/**
 * The row of round-free icon-over-label actions under the synopsis
 * (Favorites · Episodes · Comments). 84pt-wide cells at least, 64pt tall; a
 * long Burmese label wraps under its icon rather than ellipsizing.
 */
export const DetailActions = memo(function DetailActions({ actions }: { actions: DetailAction[] }) {
  const reduceMotion = useReducedMotion();
  return (
    <View style={styles.actions}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          accessibilityState={action.selected !== undefined ? { selected: action.selected } : undefined}
          style={({ pressed }) => [styles.action, pressed && (reduceMotion ? styles.pressedStill : styles.pressed)]}
        >
          <Ionicons name={action.icon} size={24} color={action.iconColor ?? theme.colors.text} />
          <ThemedText variant="label" weight="semibold" color={theme.colors.textMuted} style={styles.actionLabel}>
            {action.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
});

/* ------------------------------------------------------------------ */

/** The gold "Subscribe to watch ›" strip a locked title shows above its stats. */
export function SubscribeBanner({ label, onPress }: { label: string; onPress: () => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.banner, pressed && (reduceMotion ? styles.pressedStill : styles.pressed)]}
    >
      <ThemedText variant="muted" weight="bold" color={theme.colors.premium} style={styles.bannerText}>
        {label}
      </ThemedText>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.premium} />
    </Pressable>
  );
}

/** The green-shield note a subscriber sees on a premium series. */
export function UnlockedNote({ text }: { text: string }) {
  return (
    <View style={styles.unlocked}>
      <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.finance} style={styles.unlockedIcon} />
      <ThemedText variant="caption" weight="regular" color={theme.colors.textMuted} style={styles.unlockedText}>
        {text}
      </ThemedText>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", rowGap: theme.spacing.md },
  statCell: { flexGrow: 1, flexBasis: "22%", minWidth: 64, paddingRight: 10 },
  statCellDivided: { paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: theme.colors.border },
  statValueRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  statValue: { fontSize: 18, lineHeight: 22, flexShrink: 1 },

  metaLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: 14 },
  qualityTag: {
    minHeight: 20,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.text, 0.35),
    justifyContent: "center",
  },
  qualityText: { fontSize: 11, letterSpacing: 0 },
  metaText: { flexShrink: 1 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: 20 },
  /** A long Burmese name wraps inside the row instead of running off it. */
  chipMax: { maxWidth: "100%" },

  actions: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 12, marginLeft: -10 },
  action: {
    minWidth: 84,
    minHeight: 64,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionLabel: { textAlign: "center", letterSpacing: 0, maxWidth: 120 },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.7 },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: theme.layout.minTouch,
    marginBottom: 20,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: withAlpha(theme.colors.premium, 0.12),
  },
  bannerText: { flex: 1 },

  unlocked: { flexDirection: "row", gap: 10, marginBottom: 20 },
  unlockedIcon: { marginTop: 1 },
  unlockedText: { flex: 1 },
});
