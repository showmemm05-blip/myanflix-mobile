import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { ArcadeArt } from "@/components/arcade/ArcadeArt";
import { ArcadeBadge } from "@/components/arcade/ArcadeBadge";
import { ArcadeCta } from "@/components/arcade/ArcadeCta";
import { lineAt, useArcadeTopBarHeight } from "@/components/arcade/arcadeLayout";
import { heroGames } from "@/data/arcade";
import { formatCompactCount, type Game } from "@/data/games";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { clamp } from "@/utils/format";
import { theme, withAlpha } from "@/theme";

interface Props {
  /** The one CTA target of the whole storefront — the games hub. */
  onExplore: () => void;
  /** "All games" — scrolls the page down to the Featured shelf. */
  onAllGames: () => void;
}

/** How long each slide holds before the pager advances on its own. */
const AUTO_ADVANCE_MS = 7000;

/** The board's `open` (art) and `rise` (copy) entrance, on its ease-out curve. */
const ENTER_MS = 500;
const RISE_SHARE = 360 / ENTER_MS;
const ENTER_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);

/** Main.dc.html: the hero is 560 tall on a 390pt phone, bar included. */
const DESIGN_RATIO = 560 / 390;

/** Bottom scrim: clear → 60% → 92% → the ground, so the copy sits on near-black. */
const HERO_SCRIM = [
  withAlpha(theme.colors.background, 0),
  withAlpha(theme.colors.background, 0.6),
  withAlpha(theme.colors.background, 0.92),
  theme.colors.background,
] as const;
const HERO_SCRIM_STOPS = [0, 0.34, 0.66, 1] as const;

/** The pager's prev/next and dot targets. */
const PAGER_TARGET = theme.layout.minTouch;

/** The copy block's inset from the bottom of the stage. */
const COPY_BOTTOM = 20;

/**
 * The 34pt display title stops growing at 1.5× (51pt). Past that, the widest
 * title word ("Teahouse", "Emberfall": ~244pt at 51pt) no longer fits the
 * 288pt column of a 320pt phone and would break mid-word.
 */
const HERO_TITLE_MAX_SCALE = 1.5;

/**
 * Height the slide copy needs at the current text size, built from worst-case
 * line heights (Burmese +4, times the OS font scale). The stage is never
 * shorter than this plus the top bar, so at 2× text the copy pushes the stage
 * taller instead of sliding up under the wordmark. At large text the chip row
 * may wrap to two rows and the meta row to three lines (long Burmese at
 * 320pt). This is only the first guess: StoreHero also measures the copy
 * that actually laid out and grows the stage if the guess was short.
 */
function heroCopyHeight(fontScale: number, titleLines: number, stackCtas: boolean): number {
  const line = (lh: number) => lineAt(lh, fontScale);
  const large = fontScale >= 1.5;
  const chipRow = Math.max(24, line(16) + 4);
  // A CTA label may wrap to a second line rather than ellipsize.
  const cta = Math.max(48, 20 + 2 * line(23));
  return (
    (large ? chipRow * 2 + theme.spacing.sm : chipRow) + 12 + // badge row
    line(18) + 4 + // kicker
    titleLines * lineAt(38, Math.min(fontScale, HERO_TITLE_MAX_SCALE)) + 8 + // title
    3 * line(23) + 10 + // description (clamped to 3 lines)
    (large ? 3 : 2) * line(18) + 2 + // meta row (wraps)
    line(18) + 18 + // studio
    (stackCtas ? cta * 2 + 10 : cta) +
    COPY_BOTTOM
  );
}

/**
 * The six-slide paging hero, under the transparent top bar. The auto-advance
 * clock is a per-slide setTimeout that simply DOES NOT RUN when it has no
 * business running: OS reduce motion (no timer at all — swaps happen only on
 * user input), a finger on the pager, the screen unfocused, or the app
 * backgrounded. Any manual navigation lands on a fresh full 7s because the
 * timer effect re-arms per index.
 */
export function StoreHero({ onExplore, onAllGames }: Props) {
  const { t, language } = useLanguage();
  const layout = useHomeLayout();
  const { width, height, fontScale } = layout;
  const insets = useSafeAreaInsets();
  const topBar = useArcadeTopBarHeight();
  const reduceMotion = useReducedMotion();
  const isFocused = useIsFocused();

  const listRef = useRef<FlatList<Game>>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  indexRef.current = index;

  const [touching, setTouching] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setAppActive(state === "active"));
    return () => sub.remove();
  }, []);

  // Two CTAs share a row as on the board; they stack only on a very narrow
  // phone or at large text, where side by side would wrap both labels deep.
  const stackCtas = width < 340 || fontScale >= 1.5;
  const titleLines = fontScale > 1.3 ? 3 : 2;

  // The tallest slide copy that has actually laid out at this width, text
  // size and language. The estimate is the floor; if any slide's copy needs
  // more, the stage grows to fit it rather than letting the bottom-anchored
  // copy climb under the top bar. Only ever grows within one key, so the
  // stage cannot oscillate; a new key (rotation, text size, language) starts
  // over from the estimate.
  const measureKey = `${width}|${fontScale}|${language}`;
  const [measured, setMeasured] = useState({ key: measureKey, height: 0 });
  const measuredCopy = measured.key === measureKey ? measured.height : 0;
  const onCopyLayout = useCallback(
    (copy: number) =>
      setMeasured((prev) => {
        const current = prev.key === measureKey ? prev.height : 0;
        return copy > current + 0.5 ? { key: measureKey, height: copy } : prev;
      }),
    [measureKey],
  );

  const copyHeight = Math.max(heroCopyHeight(fontScale, titleLines, stackCtas), measuredCopy + COPY_BOTTOM);
  // The board's proportion below the status bar, but never so short that the
  // copy would reach up under the bar.
  const stageHeight = Math.max(
    Math.min(width * DESIGN_RATIO, height * 0.68) + insets.top,
    topBar + theme.spacing.md + copyHeight,
  );
  const scrimHeight = Math.min(stageHeight, Math.max(stageHeight * 0.68, copyHeight + 60));

  // Entrance: the art opens (0.4 → 1, 1.06 → 1) and the copy rises 14pt.
  // Reduce motion keeps only the fades.
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withTiming(1, { duration: ENTER_MS, easing: ENTER_EASING });
  }, [enter]);

  // Under reduce motion a tapped slide change is a cut, not a slide.
  const goTo = useCallback(
    (next: number) => {
      const target = (next + heroGames.length) % heroGames.length;
      setIndex(target);
      listRef.current?.scrollToIndex({ index: target, animated: !reduceMotion });
    },
    [reduceMotion],
  );

  // The clock. Every dependency that pauses it is in the guard, so pausing is
  // provably "the timer was never scheduled", not "we ignored the tick".
  const timerEnabled = !reduceMotion && isFocused && appActive && !touching;
  useEffect(() => {
    if (!timerEnabled) return undefined;
    const id = setTimeout(() => goTo(indexRef.current + 1), AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [timerEnabled, index, goTo]);

  // Announce "n of total" on slide change — but not for the initial mount.
  const announcedOnce = useRef(false);
  useEffect(() => {
    if (!announcedOnce.current) {
      announcedOnce.current = true;
      return;
    }
    AccessibilityInfo.announceForAccessibility(
      t.arcade.hero.slideLabel
        .replace("{n}", String(index + 1))
        .replace("{total}", String(heroGames.length)),
    );
  }, [index, t]);

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      const clamped = clamp(next, 0, heroGames.length - 1);
      if (clamped !== indexRef.current) setIndex(clamped);
    },
    [width],
  );

  const renderSlide = useCallback(
    ({ item }: { item: Game }) => (
      <HeroSlide
        game={item}
        width={width}
        height={stageHeight}
        gutter={layout.gutter}
        scrimHeight={scrimHeight}
        titleLines={titleLines}
        stackCtas={stackCtas}
        enter={enter}
        reduceMotion={reduceMotion}
        onExplore={onExplore}
        onAllGames={onAllGames}
        onCopyLayout={onCopyLayout}
      />
    ),
    [
      width,
      stageHeight,
      layout.gutter,
      scrimHeight,
      titleLines,
      stackCtas,
      enter,
      reduceMotion,
      onExplore,
      onAllGames,
      onCopyLayout,
    ],
  );

  // Eight 44pt targets fit a 390pt phone exactly; on a narrower one the dots
  // give up width (never below 24pt) and prev/next keep their full 44.
  const dotTarget = clamp(
    Math.floor((width - PAGER_TARGET * 2 - theme.spacing.md) / heroGames.length),
    24,
    PAGER_TARGET,
  );

  return (
    <View>
      <FlatList
        accessibilityLabel={t.arcade.hero.regionLabel}
        ref={listRef}
        data={heroGames}
        keyExtractor={(game) => game.id}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        // One slide at first paint instead of RN's default of ten — this is the
        // first block on the first screen of a cold start, and each slide is a
        // full-screen SVG scene. windowSize 3 keeps the neighbour ready so a
        // swipe never lands on a blank stage, and the exact getItemLayout above
        // is what lets scrollToIndex (including the 5→0 wrap) hit an unrendered
        // index without a measurement pass.
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onTouchStart={() => setTouching(true)}
        onTouchEnd={() => setTouching(false)}
        onTouchCancel={() => setTouching(false)}
      />

      <View style={styles.pager}>
        <PagerArrow
          icon="chevron-back"
          onPress={() => goTo(index - 1)}
          accessibilityLabel={t.arcade.hero.prev}
          reduceMotion={reduceMotion}
        />
        {heroGames.map((game, i) => (
          <PagerDot
            key={game.id}
            active={i === index}
            target={dotTarget}
            onPress={() => goTo(i)}
            accessibilityLabel={t.arcade.hero.goTo.replace("{title}", game.title)}
            reduceMotion={reduceMotion}
          />
        ))}
        <PagerArrow
          icon="chevron-forward"
          onPress={() => goTo(index + 1)}
          accessibilityLabel={t.arcade.hero.next}
          reduceMotion={reduceMotion}
        />
      </View>
    </View>
  );
}

interface SlideProps {
  game: Game;
  width: number;
  height: number;
  gutter: number;
  scrimHeight: number;
  titleLines: number;
  stackCtas: boolean;
  enter: SharedValue<number>;
  reduceMotion: boolean;
  onExplore: () => void;
  onAllGames: () => void;
  /** Reports the copy block's laid-out height, so the stage can grow to fit it. */
  onCopyLayout: (height: number) => void;
}

/** "·" between meta values — decoration, so a screen reader skips it. */
function MetaDot() {
  return (
    <ThemedText
      variant="caption"
      color={theme.colors.textDecor}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      ·
    </ThemedText>
  );
}

const HeroSlide = memo(function HeroSlide({
  game,
  width,
  height,
  gutter,
  scrimHeight,
  titleLines,
  stackCtas,
  enter,
  reduceMotion,
  onExplore,
  onAllGames,
  onCopyLayout,
}: SlideProps) {
  const { t } = useLanguage();

  const artStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 1], [0.4, 1]),
    transform: [{ scale: reduceMotion ? 1 : interpolate(enter.value, [0, 1], [1.06, 1]) }],
  }));
  const copyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, RISE_SHARE], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: reduceMotion ? 0 : interpolate(enter.value, [0, RISE_SHARE], [14, 0], Extrapolation.CLAMP) },
    ],
  }));

  const hasBadges = game.badge !== null || game.playersOnline !== null;

  return (
    <View style={[styles.slide, { width, height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, artStyle]}>
        <ArcadeArt gameId={game.id} format="hero" />
      </Animated.View>
      <LinearGradient
        pointerEvents="none"
        colors={HERO_SCRIM}
        locations={HERO_SCRIM_STOPS}
        style={[styles.scrim, { height: scrimHeight }]}
      />

      <Animated.View
        style={[styles.copy, { left: gutter, right: gutter }, copyStyle]}
        onLayout={(event) => onCopyLayout(event.nativeEvent.layout.height)}
      >
        {hasBadges && (
          <View style={styles.badgeRow}>
            {game.badge && <ArcadeBadge kind={game.badge} />}
            {game.playersOnline !== null && (
              <ArcadeBadge kind="online" count={formatCompactCount(game.playersOnline)} />
            )}
          </View>
        )}

        <ThemedText
          variant="caption"
          weight="extrabold"
          color={theme.colors.link}
          style={hasBadges ? styles.kickerAfterBadges : undefined}
        >
          {t.arcade.hero.kicker}
        </ThemedText>

        <ThemedText
          variant="display"
          numberOfLines={titleLines}
          maxFontSizeMultiplier={HERO_TITLE_MAX_SCALE}
          style={styles.title}
        >
          {game.title}
        </ThemedText>

        <ThemedText variant="body" color={theme.colors.textBody} numberOfLines={3} style={styles.description}>
          {t.arcade.gameCopy[game.descriptionKey]}
        </ThemedText>

        <View style={styles.metaRow}>
          <ThemedText variant="caption" color={theme.colors.textBody} tabular>
            {String(game.releaseYear)}
          </ThemedText>
          <MetaDot />
          <ThemedText variant="caption" color={theme.colors.textBody}>
            {game.platforms.join(" · ")}
          </ThemedText>
          {game.rating !== null && (
            <>
              <MetaDot />
              <View style={styles.rating}>
                <Ionicons name="star" size={12} color={theme.colors.premium} />
                <ThemedText variant="caption" color={theme.colors.textBody} tabular>
                  {game.rating.toFixed(1)}
                </ThemedText>
              </View>
            </>
          )}
          <MetaDot />
          <ThemedText variant="caption" color={theme.colors.textBody}>
            {game.genre}
          </ThemedText>
        </View>

        <ThemedText variant="caption" weight="regular" color={theme.colors.textFaint} style={styles.studio}>
          {t.arcade.hero.byStudio.replace("{name}", game.studio)}
        </ThemedText>

        <View style={[styles.ctaRow, stackCtas && styles.ctaStack]}>
          <ArcadeCta
            variant="play"
            icon="play"
            title={t.arcade.hero.explore}
            onPress={onExplore}
            style={!stackCtas && styles.ctaShare}
          />
          <ArcadeCta
            variant="secondary"
            icon="grid-outline"
            title={t.arcade.hero.allGames}
            onPress={onAllGames}
            style={!stackCtas && styles.ctaShare}
          />
        </View>
      </Animated.View>
    </View>
  );
});

function PagerArrow({
  icon,
  onPress,
  accessibilityLabel,
  reduceMotion,
}: {
  icon: "chevron-back" | "chevron-forward";
  onPress: () => void;
  accessibilityLabel: string;
  reduceMotion: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.arrow, pressed && (reduceMotion ? styles.pressedStill : styles.pressed)]}
    >
      <Ionicons name={icon} size={20} color={theme.colors.textMuted} />
    </Pressable>
  );
}

/** One pager dot: 6pt round at rest, a 22pt crimson bar when current (width eases over 250ms). */
function PagerDot({
  active,
  target,
  onPress,
  accessibilityLabel,
  reduceMotion,
}: {
  active: boolean;
  target: number;
  onPress: () => void;
  accessibilityLabel: string;
  reduceMotion: boolean;
}) {
  const dotWidth = useSharedValue(active ? 22 : 6);
  useEffect(() => {
    const to = active ? 22 : 6;
    dotWidth.value = reduceMotion ? to : withTiming(to, { duration: 250, easing: Easing.out(Easing.ease) });
  }, [active, reduceMotion, dotWidth]);
  const widthStyle = useAnimatedStyle(() => ({ width: dotWidth.value }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      style={[styles.dotTarget, { width: target }]}
    >
      <Animated.View style={[styles.dot, active && styles.dotActive, widthStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slide: { overflow: "hidden", backgroundColor: theme.colors.background },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0 },
  copy: { position: "absolute", bottom: COPY_BOTTOM, maxWidth: 560 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: theme.spacing.sm },
  kickerAfterBadges: { marginTop: 12 },
  title: { marginTop: 4 },
  description: { marginTop: theme.spacing.sm, maxWidth: 340 },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 6,
    marginTop: 10,
  },
  rating: { flexDirection: "row", alignItems: "center", gap: 3 },
  studio: { marginTop: 2 },
  ctaRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  ctaStack: { flexDirection: "column" },
  /** flex 1 1 0 — the two buttons split the row evenly, as on the board. */
  ctaShare: { flex: 1 },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.spacing.sm,
    minHeight: PAGER_TARGET,
  },
  arrow: {
    width: PAGER_TARGET,
    height: PAGER_TARGET,
    borderRadius: PAGER_TARGET / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.7 },
  dotTarget: { height: PAGER_TARGET, alignItems: "center", justifyContent: "center" },
  dot: { height: 6, borderRadius: 3, backgroundColor: withAlpha(theme.colors.text, 0.3) },
  dotActive: { backgroundColor: theme.colors.primary },
});
