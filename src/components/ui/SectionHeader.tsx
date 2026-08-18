import type { ReactNode } from "react";
import { Pressable, View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

interface Props {
  title: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  /** Small uppercase eyebrow above the title. */
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
  /** Leading accent icon rendered in a tinted tile. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Colour of the accent rule / icon tile — defaults to violet. */
  accent?: string;
  /** Arbitrary right-hand accessory (used instead of the see-all link). */
  accessory?: ReactNode;
  /** Set false for headers inside an already-padded container. */
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The one heading used above every rail, grid and grouped list. A short violet
 * rule on the left ties sections together down a long scroll.
 */
export function SectionHeader({
  title,
  onSeeAll,
  seeAllLabel = "See all",
  eyebrow,
  subtitle,
  titleLines = 1,
  subtitleLines = 2,
  icon,
  accent = theme.colors.primary,
  accessory,
  inset = true,
  style,
}: Props) {
  return (
    <View style={[styles.container, inset && styles.inset, style]}>
      <View style={styles.left}>
        {icon ? (
          <View style={[styles.iconTile, { backgroundColor: accent + "1F", borderColor: accent + "33" }]}>
            <Ionicons name={icon} size={16} color={accent} />
          </View>
        ) : (
          <View style={[styles.rule, { backgroundColor: accent }]} />
        )}
        <View style={styles.titleBlock}>
          {eyebrow && (
            <ThemedText variant="overline" numberOfLines={1} style={{ color: accent }}>
              {eyebrow.toUpperCase()}
            </ThemedText>
          )}
          <ThemedText variant="section" numberOfLines={titleLines}>
            {title}
          </ThemedText>
          {subtitle && (
            <ThemedText variant="caption" numberOfLines={subtitleLines}>
              {subtitle}
            </ThemedText>
          )}
        </View>
      </View>

      {accessory ??
        (onSeeAll ? (
          <Pressable onPress={onSeeAll} style={styles.seeAllButton} hitSlop={8} accessibilityRole="button" accessibilityLabel={seeAllLabel}>
            <ThemedText variant="caption" weight="semibold" style={styles.seeAll}>
              {seeAllLabel}
            </ThemedText>
            <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
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
    marginBottom: theme.spacing.sm,
  },
  inset: { paddingHorizontal: theme.layout.screenPadding },
  left: { flex: 1, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  rule: { width: 3, height: 18, borderRadius: theme.radius.pill },
  iconTile: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: { flex: 1, gap: 2 },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: theme.layout.minTouch,
    paddingLeft: theme.spacing.sm,
    justifyContent: "flex-end",
  },
  seeAll: { color: theme.colors.primary },
});
