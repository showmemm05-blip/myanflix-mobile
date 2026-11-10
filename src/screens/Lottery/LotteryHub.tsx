import { useCallback, useRef } from "react";
import { Pressable, StyleSheet, View, type ViewInstance } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { GLASS_BAR_ROW, GlassBarBackground, GlassTarget, useMeasuredHeight } from "@/components/layout/GlassBar";
import { hasMyanmar } from "@/components/hub/hubLayout";
import { MediaSectionCard, type SectionCardArt } from "@/components/hub/MediaSectionCard";
import { ThemedText } from "@/components/ui/ThemedText";
import { useDockClearance } from "@/hooks/useDockClearance";
import { useLanguage } from "@/localization/LanguageProvider";
import { remainingParts } from "@/lottery/components/Countdown";
import { saleStatus } from "@/lottery/data/draws";
import { useCurrentDraw, useLotteryNow } from "@/lottery/hooks/useCurrentDraw";
import { useLotteryFonts } from "@/lottery/theme/fonts";
import { LT } from "@/lottery/theme/tokens";
import { theme, withAlpha } from "@/theme";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "LotteryTab">,
  NativeStackScreenProps<RootStackParamList>
>;

/** The Thai card's line when the draw could not be loaded — the Media hub's "—" for a failed count. */
const LINE_UNAVAILABLE = "—";
/** The Thai card's loading line: LotteryHub.dc.html draws it 116 × 10 (the Media board's is 104). */
const THAI_LINE_SKELETON_WIDTH = 116;

/**
 * The Thai lottery card's artwork (LotteryHub.dc.html): a 160° run from a
 * deep warm brown to near-black under the crimson glow, a cream hairline and
 * the cream disc the red ticket sits on — a piece of the white Ivory app
 * shown on the dark page, so the tap visibly leads INTO it. Decorative, like
 * the Media cards' washes; the cream comes from the Lottery's own palette.
 */
const THAI_ART: SectionCardArt = {
  wash: ["#3D1A16", "#170A08"],
  glow: theme.colors.primary,
  glowAlpha: 0.26,
  edge: withAlpha(LT.cream, 0.42),
  tile: { fill: LT.cream, ink: theme.colors.primary },
};

/**
 * THE LOTTERY TAB — the hub, since 2026-10-23 on the Media hub's recipe
 * (the owner: "change the Lottery page same as media page"; LotteryHub.dc.html):
 * the glass root bar with the tab's own "Lottery" heading (no search), the
 * page scrolling under it, the dock cleared at the foot, and "Choose a game"
 * over a 2 × 2 grid of the Media hub's section cards:
 *
 *  - Thai lottery — the one pressable card; it opens the Thai lottery app,
 *    the root "Lottery" screen, so the main dock is hidden inside it. Its
 *    line is the current draw (GET /lottery/draws/current): "Draw 24 ·
 *    closes in 2d 04h" while it is on sale (a live countdown on the server's
 *    clock), otherwise closed / paused / opens soon / results out, or "No
 *    draw on sale yet". A pulsing bar while the draw loads; "—" and a small
 *    "Try again" link under the grid when it could not be loaded;
 *  - 2D, 3D, Lucky draw — dashed, dimmed cards tagged "Soon", not buttons.
 *
 * Nothing else below the grid (the owner, on the canvas: "don't need to show
 * your tickets here"). Mounting this screen also starts loading the
 * Lottery's fonts (the result is not needed here), so the white app usually
 * opens on faces already in memory.
 */
export function LotteryHubScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const dockClearance = useDockClearance();
  // Warm-up only — LotteryNavigator gates on the same hook.
  useLotteryFonts();
  const current = useCurrentDraw();
  const nowMs = useLotteryNow();

  const [barHeight, onBarLayout] = useMeasuredHeight(insets.top + GLASS_BAR_ROW);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const blurTarget = useRef<ViewInstance>(null);

  /* ---- the Thai card's live line ---- */
  const draw = current.data?.info ?? null;
  const status = draw ? saleStatus(draw, nowMs) : null;
  /**
   * Nothing in hand and no answer coming: a request that failed, or one that
   * cannot even start — offline, React Query parks a first fetch as `paused`
   * (not an error, never `isLoading`), and a bar that pulses until the
   * network returns would be a lie (the Media hub's rule).
   */
  const failed = !current.data && (current.isError || current.fetchStatus === "paused");
  /** Null while the draw loads (the card draws a bar). */
  let line: string | null;
  if (!current.data) {
    line = failed ? LINE_UNAVAILABLE : null;
  } else if (!draw || !status) {
    line = t.lottery.thaiLineNone;
  } else if (status === "open" && draw.salesCloseAt) {
    // A real draw always carries its close time (types/lottery); the field is optional only for the bundled sample draw.
    const n = String(draw.no);
    const { d, h } = remainingParts(Date.parse(draw.salesCloseAt), nowMs);
    const time = t.lottery.thaiTime.replace("{d}", String(d)).replace("{h}", String(h).padStart(2, "0"));
    line = t.lottery.thaiLine.replace("{n}", n).replace("{time}", time);
  } else {
    const n = String(draw.no);
    switch (status) {
      case "paused":
        line = t.lottery.thaiLinePaused.replace("{n}", n);
        break;
      case "scheduled":
        line = t.lottery.thaiLineSoon.replace("{n}", n);
        break;
      case "published":
        line = t.lottery.thaiLineResults.replace("{n}", n);
        break;
      default:
        line = t.lottery.thaiLineClosed.replace("{n}", n);
    }
  }

  /* ---- actions ---- */
  const openThai = useCallback(() => navigation.navigate("Lottery"), [navigation]);
  const { refetch } = current;
  const retry = useCallback(() => void refetch(), [refetch]);

  /** "Thai lottery, Draw 1 · closes in 2d 04h" — or "Thai lottery, Loading…" while the line is on its way. */
  const thaiA11y = `${t.lottery.thaiTitle}, ${line ?? t.common.loading}`;
  /** "2D, Coming soon" — spoken disabled, with the hint. */
  const soonA11y = (name: string) => `${name}, ${t.hub.comingSoon}`;

  return (
    <View style={styles.container}>
      {/* The page the glass blurs; one pixel down so TalkBack reads the bar first (see GlassTarget). */}
      <GlassTarget targetRef={blurTarget}>
        <Animated.ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: barHeight + theme.spacing.md, paddingBottom: dockClearance }}
        >
          <ThemedText
            variant="caption"
            weight="semibold"
            style={[styles.chooseLabel, !hasMyanmar(t.lottery.chooseGame) && styles.chooseLabelLatin]}
          >
            {t.lottery.chooseGame}
          </ThemedText>

          <View style={styles.cards}>
            <View style={styles.cardRow}>
              <MediaSectionCard
                icon="ticket-outline"
                art={THAI_ART}
                title={t.lottery.thaiTitle}
                line={line}
                lineSkeletonWidth={THAI_LINE_SKELETON_WIDTH}
                accessibilityLabel={thaiA11y}
                accessibilityHint={t.lottery.thaiOpensHint}
                onPress={openThai}
              />
              <MediaSectionCard
                icon="dice-outline"
                title={t.lottery.twoD}
                line={t.hub.comingSoon}
                soonLabel={t.hub.soon}
                accessibilityLabel={soonA11y(t.lottery.twoD)}
                accessibilityHint={t.lottery.soonHint}
              />
            </View>
            <View style={styles.cardRow}>
              <MediaSectionCard
                icon="cube-outline"
                title={t.lottery.threeD}
                line={t.hub.comingSoon}
                soonLabel={t.hub.soon}
                accessibilityLabel={soonA11y(t.lottery.threeD)}
                accessibilityHint={t.lottery.soonHint}
              />
              <MediaSectionCard
                icon="gift-outline"
                title={t.lottery.luckyDraw}
                line={t.hub.comingSoon}
                soonLabel={t.hub.soon}
                accessibilityLabel={soonA11y(t.lottery.luckyDraw)}
                accessibilityHint={t.lottery.soonHint}
              />
            </View>
          </View>

          {failed ? (
            <Pressable
              onPress={retry}
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.lottery.tryAgain}
              accessibilityHint={t.lottery.tryAgainHint}
            >
              <ThemedText variant="muted" weight="extrabold" color={theme.colors.link}>
                {t.lottery.tryAgain}
              </ThemedText>
            </Pressable>
          ) : null}
        </Animated.ScrollView>
      </GlassTarget>

      {/* The scroll-edge fade, brought in by scroll — under the bar, over the page. */}
      <GlassBarBackground scrollY={scrollY} height={barHeight} blurTarget={blurTarget} />
      <AppTopBar transparent touchThrough heading={t.nav.lottery} onLayout={onBarLayout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },
  /** The board's caption: 8pt under the bar's air, 10pt over the cards (the Media hub's "Choose what to open"). */
  chooseLabel: { marginTop: theme.spacing.sm, marginBottom: 10, paddingHorizontal: theme.layout.screenPadding },
  /** The board's slight tracking — Latin only; Myanmar script takes none. */
  chooseLabelLatin: { letterSpacing: 0.26 },
  cards: { gap: 12, paddingHorizontal: theme.layout.screenPadding },
  cardRow: { flexDirection: "row", gap: 12 },
  /** The "Try again" link under the grid: a 44pt row at the page's edge, as SectionHeader draws "See all". */
  retry: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: theme.layout.minTouch,
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.layout.screenPadding,
  },
  pressed: { opacity: 0.7 },
});
