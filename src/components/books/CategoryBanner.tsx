import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { BookCover } from "@/components/books/BookCover";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";
import type { Book } from "@/types/book";

/** Books.dc.html: the ground at 84% on the left, clear by 76% across. */
const SIDE_SCRIM = [
  withAlpha(theme.colors.background, 0.84),
  withAlpha(theme.colors.background, 0.42),
  withAlpha(theme.colors.background, 0),
] as const;
const LEFT = { x: 0, y: 0.5 } as const;
const RIGHT = { x: 1, y: 0.5 } as const;
/** The standing cover at the banner's right. */
const COVER_WIDTH = 64;

interface Props {
  name: string;
  /** The category's newest book — its cover is the banner's art. */
  lead?: Book | null;
  /** The quiet count under the name ("12 books") — the shelf response's own total. */
  count?: string | null;
  /** Books hub: the board's "See all" pill in the banner's corner. */
  onSeeAll?: () => void;
  /** Visible words on the pill. Defaults to the localized "See all". */
  seeAllLabel?: string;
  /** Spoken name of the pill ("See all, Myanmar classics"). Defaults to the visible words. */
  seeAllAccessibilityLabel?: string;
}

/**
 * The heading of the first category shelf on Books: a 148pt banner with a
 * gold CATEGORY overline, the category's name and its book count, and — on
 * the hub — a "See all" pill in the corner. Book categories carry no artwork
 * of their own, so the art is borrowed from the category's newest book: its
 * cover blurred across the banner, the cover itself standing at the right; a
 * coverless category falls back to the plain surface.
 *
 * A flex row, not stacked absolutes: the words column and the cover/pill
 * column share the width, so a long Burmese name or a 2× text size grows the
 * banner instead of running under the cover or the pill.
 */
export function CategoryBanner({ name, lead, count, onSeeAll, seeAllLabel, seeAllAccessibilityLabel }: Props) {
  const { t } = useLanguage();
  const { width, fontScale } = useWindowDimensions();
  const pillLabel = seeAllLabel ?? t.common.seeAll;
  // A narrow phone or a large text size: the pill moves under the count
  // instead of taking width from the name (the hero's own "stacked" rule).
  const stacked = width < 360 || fontScale >= 1.3;
  const pill = onSeeAll ? (
    <PressableScale
      onPress={onSeeAll}
      dimOnPress
      accessibilityLabel={seeAllAccessibilityLabel ?? pillLabel}
      style={[styles.pillTarget, stacked && styles.pillTargetStacked]}
    >
      <View style={styles.pill}>
        <ThemedText variant="muted" weight="bold" color={theme.colors.text}>
          {pillLabel}
        </ThemedText>
      </View>
    </PressableScale>
  ) : null;
  const sidePill = stacked ? null : pill;
  return (
    <View style={styles.banner}>
      {lead?.coverUrl ? (
        <Image
          source={{ uri: lead.coverUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={24}
          cachePolicy="memory-disk"
          accessible={false}
        />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={SIDE_SCRIM}
        locations={[0, 0.52, 0.76]}
        start={LEFT}
        end={RIGHT}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.text}>
        <ThemedText variant="overline" color={theme.colors.premium}>
          {t.books.category.toUpperCase()}
        </ThemedText>
        {/* Never capped: this is the shelf's only heading, and the banner grows (minHeight). */}
        <ThemedText variant="title" accessibilityRole="header" style={styles.name}>
          {name}
        </ThemedText>
        {count ? (
          <ThemedText variant="caption" weight="regular" color={theme.colors.textBody} tabular style={styles.count}>
            {count}
          </ThemedText>
        ) : null}
        {stacked ? pill : null}
      </View>
      {lead || sidePill ? (
        <View style={styles.side}>
          {lead ? (
            <View style={styles.cover} pointerEvents="none">
              <BookCover title={lead.title} coverUrl={lead.coverUrl} />
            </View>
          ) : (
            <View />
          )}
          {sidePill}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    minHeight: 148,
    marginHorizontal: theme.layout.screenPadding,
    marginBottom: 14,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
  },
  text: { flex: 1, justifyContent: "flex-end", padding: 18, paddingRight: theme.spacing.sm },
  name: { marginTop: 6 },
  count: { marginTop: 2 },
  side: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 14,
    paddingRight: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  cover: { width: COVER_WIDTH, marginRight: 14 },
  /** The 34pt pill inside a 44pt target (board: right 8, bottom 8). */
  pillTarget: { minHeight: theme.layout.minTouch, justifyContent: "center", paddingHorizontal: 6, marginTop: 6 },
  /** Under the count: left-aligned with the words (the target's 6pt slop hangs into the padding). */
  pillTargetStacked: { alignSelf: "flex-start", marginLeft: -6, marginTop: theme.spacing.sm },
  pill: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.artBadge,
  },
});
