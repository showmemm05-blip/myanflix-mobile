import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Skeleton } from "@/components/common/Skeleton";
import { useHubHeroMinHeight } from "@/components/hub/hubLayout";
import { LANDSCAPE_CARD_HEIGHT, LANDSCAPE_CARD_WIDTH } from "@/components/movie/LandscapeRail";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";

/** The board's hero block fades into the ground over its lower half. */
const FOOT = [withAlpha(theme.colors.background, 0), theme.colors.background] as const;
/** The board's six dots: the current one a 22pt bar, the rest 6pt. */
const DOTS = [22, 6, 6, 6, 6, 6];
/** The two wide rows' heading widths. */
const ROWS = [170, 130];

/**
 * Home while its first requests load (HomeMobileLoading.dc.html): the
 * hero's silhouette at the hero's own height with the copy's pulsing shapes
 * on it — two tags, the title, a meta line, two lines and the two buttons —
 * the dots row, the value strip (kicker,
 * heading and two tiles) and two wide-card rows. Pulsing blocks, never a
 * spinner (Skeleton holds still under reduce motion). The transparent top
 * bar stays live over it. Screen readers hear "Loading".
 */
export function HomeSkeleton() {
  const { t } = useLanguage();
  const heroHeight = useHubHeroMinHeight("poster");

  return (
    <View style={styles.page} accessible accessibilityRole="progressbar" accessibilityLabel={t.common.loading}>
      <View style={[styles.hero, { height: heroHeight }]}>
        <LinearGradient colors={FOOT} style={styles.foot} />
        <View style={styles.copy}>
          <View style={styles.tags}>
            <Skeleton width={48} height={24} radius="xs" />
            <Skeleton width={96} height={24} radius="sm" />
          </View>
          <Skeleton width="66%" height={32} radius="sm" style={styles.gap14} />
          <Skeleton width={150} height={12} radius="xs" style={styles.gap14} />
          <Skeleton width="88%" height={14} radius="xs" style={styles.gap16} />
          <Skeleton width="70%" height={14} radius="xs" style={styles.gap9} />
          <View style={styles.actions}>
            <Skeleton height={52} radius="button" style={styles.grow} />
            <Skeleton height={52} radius="button" style={styles.grow} />
          </View>
        </View>
      </View>

      <View style={styles.dots}>
        <View style={styles.dotSlot} />
        {DOTS.map((width, i) => (
          <View key={i} style={styles.dotSlot}>
            <Skeleton width={width} height={6} radius="xs" />
          </View>
        ))}
        <View style={styles.dotSlot} />
      </View>

      <View style={styles.value}>
        <View style={styles.inset}>
          <Skeleton width={90} height={12} radius="xs" />
          <Skeleton width={260} height={20} radius="sm" style={styles.gap11} />
        </View>
        <View style={styles.tiles}>
          {[110, 130].map((width, i) => (
            <View key={i} style={styles.tile}>
              <Skeleton width={36} height={36} radius="md" />
              <View style={styles.tileLines}>
                <Skeleton width={width} height={14} radius="xs" />
                <Skeleton width={160} height={12} radius="xs" />
                <Skeleton width={110} height={12} radius="xs" />
              </View>
            </View>
          ))}
        </View>
      </View>

      {ROWS.map((width, r) => (
        <View key={r} style={styles.row}>
          <Skeleton width={width} height={20} radius="sm" />
          <View style={styles.cards}>
            {[0, 1].map((i) => (
              <Skeleton key={i} width={LANDSCAPE_CARD_WIDTH} height={LANDSCAPE_CARD_HEIGHT} radius="lg" />
            ))}
          </View>
          <Skeleton width={120} height={12} radius="xs" style={styles.gap8} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  hero: { backgroundColor: theme.colors.surface, justifyContent: "flex-end" },
  foot: { position: "absolute", left: 0, right: 0, bottom: 0, height: "57%" },
  copy: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: 24 },
  tags: { flexDirection: "row", gap: theme.spacing.sm },
  gap8: { marginTop: 8 },
  gap9: { marginTop: 9 },
  gap11: { marginTop: 11 },
  gap14: { marginTop: 14 },
  gap16: { marginTop: 16 },
  actions: { flexDirection: "row", gap: 10, marginTop: 22 },
  grow: { flex: 1 },
  dots: { flexDirection: "row", justifyContent: "center", height: 44, marginTop: theme.spacing.sm },
  dotSlot: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  inset: { paddingHorizontal: theme.layout.screenPadding },
  value: { marginTop: 20 },
  tiles: {
    flexDirection: "row",
    gap: 10,
    marginTop: 17,
    paddingHorizontal: theme.layout.screenPadding,
    overflow: "hidden",
  },
  tile: {
    width: 200,
    height: 132,
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    justifyContent: "space-between",
  },
  tileLines: { gap: 8 },
  row: { marginTop: 32, paddingHorizontal: theme.layout.screenPadding },
  cards: { flexDirection: "row", gap: 10, marginTop: 17, overflow: "hidden" },
});
