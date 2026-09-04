import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useReducedMotion } from "react-native-reanimated";
import { GamePlate } from "@/components/common/GamePlate";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { ThemedText } from "@/components/ui/ThemedText";
import { ArcadeBadge } from "@/components/arcade/ArcadeBadge";
import { SlugText } from "@/components/arcade/SlugText";
import { heroGames } from "@/data/arcade";
import { PLATE_PALETTES, formatCompactCount, type Game } from "@/data/games";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";

interface Props {
  /** The one CTA target of the whole storefront — the games hub. */
  onExplore: () => void;
  /** "All games" — scrolls the page down to the Featured shelf. */
  onAllGames: () => void;
}

/** How long each slide holds before the pager advances on its own. */
const AUTO_ADVANCE_MS = 7000;

/**
 * The six-slide paging hero. The auto-advance clock is a per-slide setTimeout
 * that simply DOES NOT RUN when it has no business running: OS reduce motion
 * (no timer at all — swaps happen only on user input), a finger on the pager,
 * the screen unfocused, or the app backgrounded. Any manual navigation lands
 * on a fresh full 7s because the timer effect re-arms per index.
 */
export function StoreHero({ onExplore, onAllGames }: Props) {
  const { t } = useLanguage();
  const { width, height } = useWindowDimensions();
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

  // CSS-clamp semantics: prefer width*1.15, capped by the viewport, floored at 440.
  const stageHeight = Math.max(440, Math.min(width * 1.15, height * 0.62));

  const goTo = useCallback((next: number) => {
    const target = (next + heroGames.length) % heroGames.length;
    setIndex(target);
    listRef.current?.scrollToIndex({ index: target, animated: true });
  }, []);

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
      const clamped = Math.max(0, Math.min(heroGames.length - 1, next));
      if (clamped !== indexRef.current) setIndex(clamped);
    },
    [width],
  );

  const renderSlide = useCallback(
    ({ item }: { item: Game }) => (
      <GamePlate
        palette={PLATE_PALETTES[item.id]}
        radius="none"
        style={{ width, height: stageHeight, borderWidth: 0 }}
      >
        <View style={styles.slideContent}>
          {(item.badge || item.playersOnline !== null) && (
            <View style={styles.badgeRow}>
              {item.badge && <ArcadeBadge kind={item.badge} />}
              {item.playersOnline !== null && (
                <>
                  <ArcadeBadge kind="online" />
                  <SlugText>{formatCompactCount(item.playersOnline)}</SlugText>
                </>
              )}
            </View>
          )}

          <ThemedText variant="overline" style={styles.kicker}>
            {t.arcade.hero.kicker}
          </ThemedText>

          <ThemedText variant="display" numberOfLines={2}>
            {item.title}
          </ThemedText>

          <ThemedText variant="body" color={theme.colors.textMuted} numberOfLines={3}>
            {t.arcade.gameCopy[item.descriptionKey]}
          </ThemedText>

          <View style={styles.metaRow}>
            <SlugText>{String(item.releaseYear)}</SlugText>
            <ThemedText variant="caption" color={theme.colors.textFaint}>
              ·
            </ThemedText>
            <SlugText>{item.platforms.join(" · ")}</SlugText>
            {item.rating !== null && (
              <>
                <ThemedText variant="caption" color={theme.colors.textFaint}>
                  ·
                </ThemedText>
                <Ionicons name="star" size={10} color={theme.colors.premium} />
                <SlugText>{item.rating.toFixed(1)}</SlugText>
              </>
            )}
            <ThemedText variant="caption" color={theme.colors.textFaint}>
              ·
            </ThemedText>
            <ThemedText variant="caption" color={theme.colors.textMuted}>
              {item.genre}
            </ThemedText>
          </View>

          <ThemedText variant="caption" color={theme.colors.textFaint}>
            {t.arcade.hero.byStudio.replace("{name}", item.studio)}
          </ThemedText>

          <View style={styles.ctaRow}>
            <Button title={t.arcade.hero.explore} icon="play" size="md" onPress={onExplore} />
            <Button
              title={t.arcade.hero.allGames}
              variant="outline"
              size="md"
              onPress={onAllGames}
            />
          </View>
        </View>
      </GamePlate>
    ),
    [width, stageHeight, t, onExplore, onAllGames],
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
        onMomentumScrollEnd={onMomentumScrollEnd}
        onTouchStart={() => setTouching(true)}
        onTouchEnd={() => setTouching(false)}
        onTouchCancel={() => setTouching(false)}
      />

      <View style={styles.pagerChrome}>
        <IconButton
          icon="chevron-back"
          variant="ghost"
          size="sm"
          onPress={() => goTo(index - 1)}
          accessibilityLabel={t.arcade.hero.prev}
        />
        <View style={styles.dots}>
          {heroGames.map((game, i) => (
            <Pressable
              key={game.id}
              onPress={() => goTo(i)}
              hitSlop={19}
              accessibilityRole="button"
              accessibilityLabel={t.arcade.hero.goTo.replace("{title}", game.title)}
              accessibilityState={{ selected: i === index }}
            >
              <View style={[styles.dot, i === index && styles.dotActive]} />
            </Pressable>
          ))}
        </View>
        <IconButton
          icon="chevron-forward"
          variant="ghost"
          size="sm"
          onPress={() => goTo(index + 1)}
          accessibilityLabel={t.arcade.hero.next}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slideContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: theme.layout.screenPadding,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  kicker: { color: theme.colors.primary },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  pagerChrome: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.sm,
  },
  dots: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: withAlpha(theme.colors.text, 0.25),
  },
  dotActive: {
    width: 18,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
});
