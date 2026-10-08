import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
// Deep imports, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
// The crown is CrownGlyph (an SVG), shared with the badges and posters.
import Ionicons from "@expo/vector-icons/Ionicons";
import { CrownGlyph } from "@/components/common/CrownGlyph";
import { Button } from "@/components/ui/Button";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { AccessBadge } from "@/components/common/AccessBadge";
import { BookCover, bookCorners } from "@/components/books/BookCover";
import { HubFallbackArt } from "@/components/hub/HubFallbackArt";
import {
  HUB_TOP_GAP,
  hasMyanmar,
  useHubChromeHeight,
  useHubHeroMinHeight,
  type HubHeroVariant,
} from "@/components/hub/hubLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";
import type { AccessType } from "@/types/movie";

type IconName = keyof typeof Ionicons.glyphMap;

/* ------------------------------------------------------------------ */
/* The slide model — generic over movies, series and books.            */
/* ------------------------------------------------------------------ */

/**
 * The hero's main action:
 * - "play" — white, play glyph (the viewer can watch);
 * - "subscribe" — gold, crown glyph (a premium title the viewer cannot watch yet);
 * - "read" — white, book glyph ("Start reading" / "Continue reading");
 * - "commit" — crimson, `icon` (default an arrow): Home's promo slides
 *   ("Add money", "Open", a link) — the Marquee commit colour, never white.
 * `sublabel` adds a second, quieter line under the label ("Chapter 3 · 40% read").
 */
export interface HubHeroPrimary {
  kind: "play" | "subscribe" | "read" | "commit";
  label: string;
  /** "commit" only: the glyph before the label. */
  icon?: IconName;
  sublabel?: string | null;
  onPress: () => void;
  /** Spoken name — say what AND which ("Play, The Last Monsoon"). Defaults to the label. */
  accessibilityLabel?: string;
  disabled?: boolean;
}

/**
 * The partner button beside the primary. With `toggled` set (true/false) it is
 * a TOGGLE — My List: a plus that turns into a crimson check, spoken as a
 * toggle button with its checked state. Without it, a plain secondary button
 * ("Details").
 */
export interface HubHeroSecondary {
  label: string;
  /** Plain button only — the toggle draws its own plus / check. */
  icon?: IconName;
  toggled?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

/** The square 52pt round-cornered button at the end of the action row (Info, "More by …"). */
export interface HubHeroIconAction {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
}

/**
 * A coloured chip at the head of the tag row — Home's promo kicker
 * ("Premium" in gold, "Wallet" in green, "Coming soon" in crimson).
 */
export interface HubHeroBadge {
  label: string;
  /** Ink (words and glyph) — a role colour that reads as text on its own soft fill. */
  ink: string;
  fill: string;
  glyph?: "crown" | "wallet" | "pulse" | null;
}

/** A bold line under the blurb (Home's promo price or date): "10,000 Ks" + "for 30 days · …". */
export interface HubHeroNote {
  text: string;
  sub?: string | null;
  color: string;
}

/** A meta part the board draws bold white instead of in the quiet ink. */
export interface HubHeroMetaStrong {
  text: string;
  strong: true;
}

export interface HubHeroSlide {
  /** Stable — the record id. */
  key: string;
  title: string;
  /**
   * The art. Poster hero: drawn full-bleed (pass posterUrl ?? coverUrl — the
   * stage is portrait). Cover hero: the 5:7 book cover, which is also blurred
   * into the backdrop behind it. Null: the drawn HubFallbackArt (seeded by
   * `key`) under the same scrims — and, on the cover hero, BookCover's own
   * no-image cover.
   */
  imageUrl: string | null;
  /** The crimson NEW tag (createdAt within NEW_TITLE_WINDOW_DAYS — never a guess). */
  isNew?: boolean;
  /** PREMIUM (gold) / FREE (green). Omit for content with no access model (books). */
  accessType?: AccessType | null;
  /** Extra neutral tags after the access tag (books: the format). Already localized. */
  tags?: string[];
  /** The quiet line after the tags ("Recently added", "Featured", a category). Callers should always give one. */
  kicker?: string | null;
  /** > 0 draws the gold star and the value first in the meta row. */
  rating?: number | null;
  /** A leading meta item with its own glyph (books: the person glyph + the author). */
  metaLead?: { icon: IconName; text: string } | null;
  /**
   * The rest of the meta row: year, runtime, genre, episodes… Empty parts are
   * dropped. A `{ text, strong: true }` part is drawn bold white among the
   * quiet ones (the Series board's "2 seasons · 10 episodes").
   */
  meta?: Array<string | number | HubHeroMetaStrong | null | undefined>;
  /** Two lines of description. */
  blurb?: string | null;
  /** None: the slide has no button (a promo with no action). */
  primary?: HubHeroPrimary | null;
  secondary?: HubHeroSecondary | null;
  info?: HubHeroIconAction | null;
  /** Cover hero: tapping the book opens it (usually the same as Details). */
  onOpen?: () => void;
  /**
   * Home's promo slides. All optional and additive — a hub slide sets none.
   * `art` is drawn when there is no `imageUrl` (instead of HubFallbackArt);
   * `badge` leads the tag row; `note` and `extra` sit under the blurb;
   * `blurbLines` lets a promo's body run to three lines.
   */
  art?: ReactNode;
  badge?: HubHeroBadge | null;
  note?: HubHeroNote | null;
  extra?: ReactNode;
  blurbLines?: number;
}

/** What the hero says when there is nothing to feature (an empty catalogue). */
export interface HubHeroEmpty {
  /** "No movies yet". */
  title: string;
  /** "New movies will appear here." */
  message: string;
  /** Picks the drawn backdrop — the hub's kind, so it is the same picture every time. */
  seed: string;
}

interface Props {
  /**
   * Up to five on the hubs (Home's showcase mixes in its promo slides, a
   * dozen at most). One slide = no pager; none = the EMPTY hero (`empty`) —
   * the same height and scrims over a drawn backdrop, never a bare band.
   */
  slides: HubHeroSlide[];
  variant?: HubHeroVariant;
  /** The carousel's name, spoken with each slide's position ("Featured movies"). */
  accessibilityLabel: string;
  empty: HubHeroEmpty;
  /** The page's scroll offset (useHubScroll().scrollY): the pager stops while the hero is scrolled away. */
  scrollY?: SharedValue<number>;
  /**
   * Told the slide on screen (0 on first paint, then every change). Optional
   * and additive: the Books hub uses it to ask for the reading progress of the
   * ACTIVE book only, rather than one request per slide.
   */
  onIndexChange?: (index: number) => void;
  /**
   * The hub is mounted but not on screen (another Media chip is showing, or
   * a screen is pushed over the Media tab): the pager holds still.
   */
  paused?: boolean;
  /**
   * "segments" (default): the story pager laid over the slide's foot.
   * "dots" (Home showcase, HomeMobile.dc.html): a row UNDER the hero — a
   * previous arrow, one 44pt dot per slide (the current one a 22pt crimson
   * bar), a next arrow; with more slides than dots fit, "3 / 12" between the
   * arrows instead. Same clock and the same pauses either way.
   */
  pager?: "segments" | "dots";
}

/** Boards: each slide holds 7s while its segment fills crimson. */
export const HUB_SLIDE_MS = 7000;
/** The pager's segments are 44pt touch targets (Series/Books boards) around a 3pt bar. */
const PAGER_TARGET = theme.layout.minTouch;
const PAGER_BOTTOM = 16;
/** Copy ends this far above the slide's foot: the pager row plus a little air. */
const PAGER_RESERVE = PAGER_BOTTOM + PAGER_TARGET + 6;
/** No pager: the copy sits where the board puts it, 26pt off the foot. */
const NO_PAGER_RESERVE = 26;
/**
 * The top scrim (the boards' 180pt, ground at 78% fading to clear): the
 * hero runs under the status bar, the Media bar and its chip row, so the
 * scrim covers all of that pinned chrome and then fades out this far below
 * it (the board's chips end at 104 of its 180).
 */
const TOP_SCRIM_TAIL = 76;
/** Boards: the hero title is 40/42, weight 900, tracked -0.035em. */
const TITLE_SIZE = 40;
const TITLE_LINE = 44;
/** Burmese stacks marks above and below the Latin line box. */
const TITLE_LINE_MYANMAR = 56;
/** At 2× text a 40pt title would be 80pt: it stops growing at 1.5× (60pt), like Home's hero. */
const TITLE_MAX_SCALE = 1.5;

/** The boards' top scrim: the ground at 78%, fading to clear. */
const TOP_SCRIM = [withAlpha(theme.colors.background, 0.78), withAlpha(theme.colors.background, 0)] as const;
const TOP_SCRIM_STOPS = [0, 1] as const;
const POSTER_FOOT = [
  withAlpha(theme.colors.background, 0),
  withAlpha(theme.colors.background, 0.82),
  theme.colors.background,
] as const;
const COVER_FOOT = [
  withAlpha(theme.colors.background, 0),
  withAlpha(theme.colors.background, 0.86),
  theme.colors.background,
] as const;
/** The empty hero's title: smaller than a slide's, it is a message and not a name. */
const EMPTY_TITLE_SIZE = 30;
const EMPTY_TITLE_LINE = 36;
const EMPTY_TITLE_LINE_MYANMAR = 48;

/**
 * The hubs' featured carousel (Main / Series / Books.dc.html): up to five
 * titles, each a full-bleed page with its tags, title, meta, two lines of
 * blurb and the action row, and a five-segment story pager at the foot.
 *
 * It runs full-bleed from the top of the screen: the Media bar and its chip
 * row are laid over the art (HubChromeContext says how tall they are), so
 * the top scrim darkens all of it and the copy never climbs under them.
 *
 * The pager. The current segment fills crimson over 7s and then the next
 * slide comes in; finished segments are white. The clock DOES NOT RUN —
 * the fill simply holds — while a finger is on the hero, while the screen is
 * not focused, while the app is in the background, while the hub is mounted
 * but hidden (`paused`: another Media chip is showing), or while the hero is
 * scrolled off screen. It never runs at all under reduce motion or with a
 * screen reader on: then the slides change only when the user swipes or taps
 * a segment, and the current segment is drawn as a solid crimson bar. Each
 * segment is a 44pt button ("2 of 5: River of Stars") with a selected state,
 * and every change of slide is announced as "n of total: title".
 *
 * Swipe: the slides are a paged horizontal ScrollView, so they follow the
 * finger. All slides are mounted (five at most), which keeps the hero as tall
 * as its tallest slide — the copy of a long Burmese title at 2× text grows
 * the hero rather than climbing under the chip row.
 */
export function HubHero({
  slides,
  variant = "poster",
  accessibilityLabel,
  empty,
  scrollY,
  onIndexChange,
  paused = false,
  pager = "segments",
}: Props) {
  const { t, language } = useLanguage();
  const { width, fontScale } = useWindowDimensions();
  const minHeight = useHubHeroMinHeight(variant);
  const chromeHeight = useHubChromeHeight();
  const reduceMotion = useReducedMotion();
  const isFocused = useIsFocused();
  const scrollRef = useRef<ScrollView>(null);
  const count = slides.length;

  const [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(0, count - 1));
  const indexRef = useRef(current);
  indexRef.current = current;

  useEffect(() => {
    onIndexChange?.(current);
  }, [current, onIndexChange]);

  /* ---- what pauses the clock ---- */
  const [touching, setTouching] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [screenReader, setScreenReader] = useState(false);
  const [offscreen, setOffscreen] = useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setAppActive(state === "active"));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((on) => alive && setScreenReader(on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReader);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // A touch that began before the user left (a tap that navigated away) never
  // reports its end here — the hero must not come back paused for good.
  useEffect(() => {
    if (!isFocused || !appActive || paused) setTouching(false);
  }, [isFocused, appActive, paused]);

  useAnimatedReaction(
    () => (scrollY ? scrollY.value > minHeight * 0.75 : false),
    (now, previous) => {
      if (now !== previous) runOnJS(setOffscreen)(now);
    },
    [scrollY, minHeight],
  );

  /** The pager runs on its own at all. */
  const autoplay = count > 1 && !reduceMotion && !screenReader;
  /** …and is running right now. */
  const running = autoplay && isFocused && appActive && !paused && !touching && !offscreen;

  /** 0 → 1 across the current slide's 7s. */
  const progress = useSharedValue(0);

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      const target = ((next % count) + count) % count;
      // The slide already on screen (its own segment tapped): leave its fill
      // running. Zeroing it here would stop the clock for good — the index,
      // which is what restarts the clock below, would not change.
      if (target === indexRef.current) return;
      // Assigning cancels any running fill; the clock effect below restarts it.
      progress.value = 0;
      setIndex(target);
      scrollRef.current?.scrollTo({ x: target * width, animated: !reduceMotion });
    },
    [count, width, reduceMotion, progress],
  );
  const advance = useCallback(() => goTo(indexRef.current + 1), [goTo]);

  // The clock: a timing on `progress` that only exists while `running`.
  // Pausing cancels it where it stands; resuming finishes the remainder.
  useEffect(() => {
    if (!running) {
      cancelAnimation(progress);
      return undefined;
    }
    const remaining = Math.max(0, 1 - progress.value) * HUB_SLIDE_MS;
    progress.value = withTiming(1, { duration: remaining, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(advance)();
    });
    return () => cancelAnimation(progress);
  }, [running, current, progress, advance]);

  // A rotation or a narrower window re-pages to the same slide.
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: indexRef.current * width, animated: false });
  }, [width]);

  // A refetch that returned fewer slides must not strand the pager past the end.
  useEffect(() => {
    if (count > 0 && index >= count) {
      progress.value = 0;
      setIndex(0);
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [count, index, progress]);

  // "2 of 5: River of Stars" on every change of slide (not on first paint).
  // With a screen reader on the pager never moves by itself, so this only
  // ever follows the user's own swipe or tap.
  // Only the index moves the announcement — a language switch or a refetch
  // must not — so the words travel through a ref.
  const announcement = useRef("");
  announcement.current = count > 1 ? slideLabel(t, current, count, slides[current]?.title ?? "") : "";
  const announced = useRef(false);
  useEffect(() => {
    if (!announced.current) {
      announced.current = true;
      return;
    }
    if (announcement.current) AccessibilityInfo.announceForAccessibility(announcement.current);
  }, [current]);

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setTouching(false);
      const next = Math.min(Math.max(Math.round(event.nativeEvent.contentOffset.x / width), 0), Math.max(0, count - 1));
      if (next !== indexRef.current) {
        progress.value = 0;
        setIndex(next);
      }
    },
    [width, count, progress],
  );

  /* ---- the pinned Media chrome over the art ---- */
  // The copy (or the cover) starts below the bar and the chip row; the top
  // scrim covers them and fades out a little further down.
  const topReserve = chromeHeight + HUB_TOP_GAP;
  const topScrimHeight = chromeHeight + TOP_SCRIM_TAIL;

  /*
   * Every slide is as tall as the tallest one. The paged row usually
   * stretches them to it anyway; measuring makes it certain, so the pager
   * and the bottom-anchored copy line up on every slide. It only ever grows
   * within one measure key (width, text size, language, the pinned chrome's
   * height, the slide set), so it cannot oscillate; a new key starts over
   * from the board's height.
   */
  const measureKey = `${width}|${fontScale}|${language}|${topReserve}|${slides.map((s) => s.key).join(",")}`;
  const [tallest, setTallest] = useState({ key: measureKey, height: 0 });
  const measuredTallest = tallest.key === measureKey ? tallest.height : 0;
  const onSlideLayout = useCallback(
    (height: number) =>
      setTallest((prev) => {
        const current = prev.key === measureKey ? prev.height : 0;
        return height > current + 0.5 ? { key: measureKey, height } : prev;
      }),
    [measureKey],
  );

  if (count === 0) {
    return (
      <EmptyHero
        empty={empty}
        cover={variant === "cover"}
        minHeight={minHeight}
        topReserve={topReserve}
        topScrimHeight={topScrimHeight}
      />
    );
  }

  /** Two buttons and a square side by side stop fitting on a narrow phone or at large text. */
  const stacked = width < 360 || fontScale >= 1.3;
  const dots = pager === "dots";
  const bottomReserve = count > 1 && !dots ? PAGER_RESERVE : NO_PAGER_RESERVE;
  const slideHeight = Math.max(minHeight, measuredTallest);

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        scrollEnabled={count > 1}
        showsHorizontalScrollIndicator={false}
        disableIntervalMomentum
        onMomentumScrollEnd={onMomentumScrollEnd}
        onTouchStart={() => setTouching(true)}
        onTouchEnd={() => setTouching(false)}
        onTouchCancel={() => setTouching(false)}
        onScrollEndDrag={() => setTouching(false)}
      >
        {slides.map((slide, i) => (
          <HeroSlide
            key={slide.key}
            slide={slide}
            index={i}
            count={count}
            active={i === current}
            variant={variant}
            width={width}
            minHeight={slideHeight}
            onMeasure={onSlideLayout}
            topReserve={topReserve}
            bottomReserve={bottomReserve}
            topScrimHeight={topScrimHeight}
            stacked={stacked}
            carouselLabel={accessibilityLabel}
          />
        ))}
      </ScrollView>

      {count > 1 && dots && (
        <DotsPager
          count={count}
          current={current}
          width={width}
          labels={slides.map((slide, i) => slideLabel(t, i, count, slide.title))}
          onPick={goTo}
          onPrevious={() => goTo(indexRef.current - 1)}
          onNext={advance}
        />
      )}

      {count > 1 && !dots && (
        <View style={styles.pager}>
          {slides.map((slide, i) => (
            <PagerSegment
              key={slide.key}
              state={i < current ? "done" : i === current ? "active" : "next"}
              animated={autoplay}
              progress={progress}
              label={slideLabel(t, i, count, slide.title)}
              onPress={() => goTo(i)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * Nothing to feature: the hero keeps its height, its scrims and a drawn
 * backdrop, with the page's own words centred on the dark foot — "No movies
 * yet / New movies will appear here." — so the tab never opens on a bare band.
 */
function EmptyHero({
  empty,
  cover,
  minHeight,
  topReserve,
  topScrimHeight,
}: {
  empty: HubHeroEmpty;
  cover: boolean;
  minHeight: number;
  topReserve: number;
  topScrimHeight: number;
}) {
  return (
    <View style={[styles.emptyHero, { minHeight }]}>
      <View style={styles.art} pointerEvents="none">
        <HubFallbackArt seed={empty.seed} format="hero" />
        {cover && <View style={[StyleSheet.absoluteFill, styles.coverWash]} />}
        <LinearGradient
          colors={TOP_SCRIM}
          locations={TOP_SCRIM_STOPS}
          style={[styles.topScrim, { height: topScrimHeight }]}
        />
        <LinearGradient
          colors={cover ? COVER_FOOT : POSTER_FOOT}
          locations={cover ? [0, 0.48, 1] : [0, 0.52, 1]}
          style={[styles.footScrim, styles.footScrimPoster]}
        />
      </View>
      <View style={[styles.emptyBody, { paddingTop: topReserve, paddingBottom: NO_PAGER_RESERVE + 8 }]}>
        <ThemedText
          weight="black"
          accessibilityRole="header"
          maxFontSizeMultiplier={TITLE_MAX_SCALE}
          style={[styles.emptyTitle, hasMyanmar(empty.title) ? styles.emptyTitleMyanmar : styles.emptyTitleLatin]}
        >
          {empty.title}
        </ThemedText>
        <ThemedText variant="body" color={theme.colors.textMuted} style={styles.emptyMessage}>
          {empty.message}
        </ThemedText>
      </View>
    </View>
  );
}

function slideLabel(t: ReturnType<typeof useLanguage>["t"], index: number, total: number, title: string): string {
  return t.hub.slideLabel
    .replace("{n}", String(index + 1))
    .replace("{total}", String(total))
    .replace("{title}", title);
}

/* ------------------------------------------------------------------ */

interface SlideProps {
  slide: HubHeroSlide;
  index: number;
  count: number;
  active: boolean;
  variant: HubHeroVariant;
  width: number;
  minHeight: number;
  /** Reports the slide's laid-out height — the hero keeps every slide as tall as the tallest. */
  onMeasure: (height: number) => void;
  topReserve: number;
  bottomReserve: number;
  topScrimHeight: number;
  stacked: boolean;
  carouselLabel: string;
}

const HeroSlide = memo(function HeroSlide({
  slide,
  index,
  count,
  active,
  variant,
  width,
  minHeight,
  onMeasure,
  topReserve,
  bottomReserve,
  topScrimHeight,
  stacked,
  carouselLabel,
}: SlideProps) {
  const { t } = useLanguage();
  const cover = variant === "cover";
  const coverWidth = Math.round(Math.min(180, width * 0.46));

  const position = t.hub.slidePosition.replace("{n}", String(index + 1)).replace("{total}", String(count));
  const accessLabel = slide.accessType ? (slide.accessType === "FREE" ? t.movie.free : t.movie.premium) : null;
  const tags = slide.tags ?? [];
  const badge = slide.badge ?? null;
  const hasTagRow = !!badge || !!slide.isNew || !!slide.accessType || tags.length > 0 || !!slide.kicker;
  // The carousel's name and "n of total" ride on the first thing a screen
  // reader meets in the slide — the tag row, or the title when there is none.
  const lead = count > 1 ? `${carouselLabel}, ${position}` : carouselLabel;
  const tagRowLabel = [lead, badge?.label ?? null, slide.isNew ? t.movie.newBadge : null, accessLabel, ...tags, slide.kicker ?? null]
    .filter(Boolean)
    .join(", ");

  return (
    <View
      style={[styles.slide, { width, minHeight }]}
      onLayout={(event) => onMeasure(event.nativeEvent.layout.height)}
      // Only the slide on screen is in the accessibility tree; the pager and a
      // swipe are how a screen-reader user moves between them.
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
    >
      <View style={styles.art} pointerEvents="none">
        {slide.imageUrl ? (
          <Image
            source={{ uri: slide.imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={cover ? 28 : 0}
            transition={220}
            cachePolicy="memory-disk"
            priority={index === 0 ? "high" : "normal"}
            accessible={false}
          />
        ) : slide.art ? (
          slide.art
        ) : (
          <HubFallbackArt seed={slide.key} format="hero" />
        )}
        {cover && <View style={[StyleSheet.absoluteFill, styles.coverWash]} />}
        <LinearGradient
          colors={TOP_SCRIM}
          locations={TOP_SCRIM_STOPS}
          style={[styles.topScrim, { height: topScrimHeight }]}
        />
        <LinearGradient
          colors={cover ? COVER_FOOT : POSTER_FOOT}
          locations={cover ? [0, 0.48, 1] : [0, 0.52, 1]}
          style={[styles.footScrim, cover ? styles.footScrimCover : styles.footScrimPoster]}
        />
      </View>

      <View style={[styles.body, { paddingTop: topReserve, paddingBottom: bottomReserve }]}>
        {cover ? (
          <View style={styles.coverStage}>
            <PressableScale
              onPress={slide.onOpen}
              disabled={!slide.onOpen}
              dimOnPress
              accessibilityLabel={slide.title}
              style={[styles.coverLift, bookCorners("lg"), { width: coverWidth }]}
            >
              <BookCover title={slide.title} coverUrl={slide.imageUrl} size="lg" />
            </PressableScale>
          </View>
        ) : null}

        <View style={[styles.copy, cover && styles.copyCentered]}>
          {hasTagRow && (
            <View style={[styles.tagRow, cover && styles.centerRow]} accessible accessibilityLabel={tagRowLabel}>
              {badge ? <BadgeChip badge={badge} /> : null}
              {slide.isNew ? (
                <View style={[styles.tag, styles.tagNew]}>
                  <ThemedText variant="overline" color={theme.colors.onPrimary}>
                    {t.movie.newBadge.toUpperCase()}
                  </ThemedText>
                </View>
              ) : null}
              {slide.accessType ? <AccessBadge accessType={slide.accessType} /> : null}
              {tags.map((tag) => (
                <View key={tag} style={[styles.tag, styles.tagNeutral]}>
                  <ThemedText variant="overline" color={theme.colors.text}>
                    {tag.toUpperCase()}
                  </ThemedText>
                </View>
              ))}
              {slide.kicker ? (
                <ThemedText variant="caption" weight="semibold" color={theme.colors.textBody} style={styles.kicker}>
                  {slide.kicker}
                </ThemedText>
              ) : null}
            </View>
          )}

          <ThemedText
            weight="black"
            accessibilityRole="header"
            accessibilityLabel={hasTagRow ? undefined : `${lead}, ${slide.title}`}
            maxFontSizeMultiplier={TITLE_MAX_SCALE}
            style={[
              styles.title,
              hasMyanmar(slide.title) ? styles.titleMyanmar : styles.titleLatin,
              cover && styles.centerText,
              !hasTagRow && styles.titleFirst,
            ]}
          >
            {slide.title}
          </ThemedText>

          <MetaRow slide={slide} centered={cover} />

          {slide.blurb ? (
            <ThemedText
              variant="muted"
              color={theme.colors.textMuted}
              numberOfLines={slide.blurbLines ?? 2}
              style={[styles.blurb, cover && styles.centerText]}
            >
              {slide.blurb}
            </ThemedText>
          ) : null}

          {slide.note ? (
            <View style={[styles.noteRow, cover && styles.centerRow]}>
              <ThemedText weight="extrabold" color={slide.note.color} tabular style={styles.noteText}>
                {slide.note.text}
              </ThemedText>
              {slide.note.sub ? (
                <ThemedText variant="caption" weight="semibold" color={theme.colors.textMuted} tabular>
                  {slide.note.sub}
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          {slide.extra ? <View style={styles.extra}>{slide.extra}</View> : null}

          <ActionRow slide={slide} stacked={stacked} />
        </View>
      </View>
    </View>
  );
});

function MetaRow({ slide, centered }: { slide: HubHeroSlide; centered: boolean }) {
  const parts = (slide.meta ?? []).filter(
    (part): part is string | number | HubHeroMetaStrong =>
      part !== null && part !== undefined && (typeof part === "object" ? part.text : `${part}`).length > 0,
  );
  const rating = slide.rating && slide.rating > 0 ? slide.rating : null;
  if (!rating && !slide.metaLead && parts.length === 0) return null;
  return (
    <View style={[styles.metaRow, centered && styles.centerRow]}>
      {slide.metaLead ? (
        <View style={styles.metaStrong}>
          <Ionicons name={slide.metaLead.icon} size={14} color={theme.colors.text} />
          <ThemedText variant="muted" weight="extrabold" color={theme.colors.text}>
            {slide.metaLead.text}
          </ThemedText>
        </View>
      ) : null}
      {rating !== null ? (
        <View style={styles.metaStrong}>
          <Ionicons name="star" size={14} color={theme.colors.premium} />
          <ThemedText variant="muted" weight="extrabold" color={theme.colors.text} tabular>
            {rating.toFixed(1)}
          </ThemedText>
        </View>
      ) : null}
      {parts.map((part, i) =>
        typeof part === "object" ? (
          <ThemedText key={`${part.text}-${i}`} variant="muted" weight="bold" color={theme.colors.text} tabular>
            {part.text}
          </ThemedText>
        ) : (
          <ThemedText key={`${part}-${i}`} variant="muted" color={theme.colors.textBody} tabular>
            {String(part)}
          </ThemedText>
        ),
      )}
    </View>
  );
}

function ActionRow({ slide, stacked }: { slide: HubHeroSlide; stacked: boolean }) {
  const { primary, secondary, info } = slide;
  const hasSide = !!secondary || !!info;
  if (!primary && !hasSide) return null;
  return (
    <View style={[styles.actions, stacked && styles.actionsStacked]}>
      {primary ? <PrimaryAction primary={primary} style={stacked ? undefined : styles.grow} /> : null}
      {hasSide ? (
        <View style={[styles.sideActions, stacked && styles.sideActionsStacked]}>
          {secondary ? <SecondaryAction secondary={secondary} grow={stacked} /> : null}
          {info ? <InfoAction info={info} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const PRIMARY_LOOK = {
  play: { fill: theme.colors.play, ink: theme.colors.onPlay },
  read: { fill: theme.colors.play, ink: theme.colors.onPlay },
  subscribe: { fill: theme.colors.premium, ink: theme.colors.onPremium },
  commit: { fill: theme.colors.primary, ink: theme.colors.onPrimary },
} as const;

/** The promo badge's leading glyph: the crown (Premium), a wallet (money), a dot (coming soon). */
function BadgeChip({ badge }: { badge: HubHeroBadge }) {
  return (
    <View style={[styles.badge, { backgroundColor: badge.fill }]}>
      {badge.glyph === "crown" ? <CrownGlyph size={12} color={badge.ink} /> : null}
      {badge.glyph === "wallet" ? <Ionicons name="wallet-outline" size={13} color={badge.ink} /> : null}
      {badge.glyph === "pulse" ? <View style={[styles.badgeDot, { backgroundColor: badge.ink }]} /> : null}
      <ThemedText variant="label" weight="extrabold" color={badge.ink} style={styles.badgeLabel}>
        {badge.label}
      </ThemedText>
    </View>
  );
}

/**
 * Home's pager (HomeMobile.dc.html): under the hero, a previous arrow, the
 * dots and a next arrow — every one a 44pt button. When the dots would not
 * fit between the arrows at 44pt each, a "3 / 12" counter stands in for them.
 */
function DotsPager({
  count,
  current,
  width,
  labels,
  onPick,
  onPrevious,
  onNext,
}: {
  count: number;
  current: number;
  width: number;
  labels: string[];
  onPick: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const { t } = useLanguage();
  const room = width - theme.layout.screenPadding * 2 - PAGER_TARGET * 2;
  const fits = count * PAGER_TARGET <= room;
  return (
    <View style={styles.dotsRow}>
      <Pressable
        onPress={onPrevious}
        accessibilityRole="button"
        accessibilityLabel={t.hub.previousSlide}
        hitSlop={4}
        style={styles.dotsArrow}
      >
        <Ionicons name="chevron-back" size={20} color={theme.colors.textMuted} />
      </Pressable>
      {fits ? (
        labels.map((label, i) => (
          <Pressable
            key={`${i}-${label}`}
            onPress={() => onPick(i)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: i === current }}
            style={styles.dotTarget}
          >
            <View style={[styles.dot, i === current && styles.dotActive]} />
          </Pressable>
        ))
      ) : (
        <ThemedText
          variant="caption"
          weight="bold"
          color={theme.colors.textMuted}
          tabular
          accessibilityLabel={labels[current]}
          style={styles.dotsCounter}
        >
          {t.hub.slideCounter.replace("{n}", String(current + 1)).replace("{total}", String(count))}
        </ThemedText>
      )}
      <Pressable
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel={t.hub.nextSlide}
        hitSlop={4}
        style={styles.dotsArrow}
      >
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
      </Pressable>
    </View>
  );
}

/**
 * The hero's main button — the shared Button's geometry and press (radius 12,
 * 52pt, scale 0.96 / an opacity dip under reduce motion), drawn here because
 * it needs two things Button does not carry: the gold crown on Subscribe and
 * a second line under the label (reading progress). The label wraps rather
 * than being cut.
 */
function PrimaryAction({ primary, style }: { primary: HubHeroPrimary; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const look = PRIMARY_LOOK[primary.kind];
  const sub = primary.sublabel ? primary.sublabel : null;
  return (
    <Pressable
      onPress={primary.onPress}
      disabled={primary.disabled}
      accessibilityRole="button"
      accessibilityLabel={[primary.accessibilityLabel ?? primary.label, sub].filter(Boolean).join(", ")}
      accessibilityState={{ disabled: !!primary.disabled }}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: look.fill },
        primary.disabled && styles.disabled,
        pressed && !primary.disabled && (reduceMotion ? styles.pressedStill : styles.pressed),
        style,
      ]}
    >
      {primary.kind === "subscribe" ? (
        <CrownGlyph size={18} color={look.ink} />
      ) : primary.kind === "commit" ? (
        <Ionicons name={primary.icon ?? "arrow-forward"} size={20} color={look.ink} />
      ) : (
        <Ionicons name={primary.kind === "read" ? "book-outline" : "play"} size={20} color={look.ink} />
      )}
      <View style={[styles.primaryText, !sub && styles.primaryTextSingle]}>
        <ThemedText weight="extrabold" color={look.ink} numberOfLines={2} style={styles.primaryLabel}>
          {primary.label}
        </ThemedText>
        {sub ? (
          <ThemedText variant="label" weight="semibold" color={withAlpha(look.ink, 0.72)} tabular numberOfLines={2}>
            {sub}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

function SecondaryAction({ secondary, grow }: { secondary: HubHeroSecondary; grow: boolean }) {
  const reduceMotion = useReducedMotion();
  if (secondary.toggled === undefined) {
    return (
      <Button
        title={secondary.label}
        icon={secondary.icon}
        variant="secondary"
        size="lg"
        labelLines={2}
        onPress={secondary.onPress}
        accessibilityLabel={secondary.accessibilityLabel}
        style={[styles.secondary, grow && styles.grow]}
      />
    );
  }
  const on = secondary.toggled;
  return (
    <Pressable
      onPress={secondary.onPress}
      accessibilityRole="togglebutton"
      accessibilityLabel={secondary.accessibilityLabel ?? secondary.label}
      accessibilityState={{ checked: on }}
      style={({ pressed }) => [
        styles.secondary,
        styles.toggle,
        grow && styles.grow,
        pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
      ]}
    >
      <Ionicons name={on ? "checkmark" : "add"} size={20} color={on ? theme.colors.link : theme.colors.text} />
      <ThemedText weight="bold" color={theme.colors.text} numberOfLines={2} style={styles.secondaryLabel}>
        {secondary.label}
      </ThemedText>
    </Pressable>
  );
}

function InfoAction({ info }: { info: HubHeroIconAction }) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      onPress={info.onPress}
      accessibilityRole="button"
      accessibilityLabel={info.accessibilityLabel}
      style={({ pressed }) => [styles.square, pressed && (reduceMotion ? styles.pressedStill : styles.pressed)]}
    >
      <Ionicons name={info.icon} size={22} color={theme.colors.text} />
    </Pressable>
  );
}

/** One story-pager segment: a 44pt button around a 3pt bar. */
function PagerSegment({
  state,
  animated,
  progress,
  label,
  onPress,
}: {
  state: "done" | "active" | "next";
  /** The fill follows the clock; false (reduce motion, screen reader) draws the current bar solid. */
  animated: boolean;
  progress: SharedValue<number>;
  label: string;
  onPress: () => void;
}) {
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: state === "active" }}
      style={styles.segment}
    >
      <View style={styles.segmentTrack}>
        {state === "done" ? <View style={[styles.segmentFill, styles.segmentDone]} /> : null}
        {state === "active" ? (
          <Animated.View style={[styles.segmentFill, styles.segmentActive, animated ? fillStyle : styles.segmentFull]} />
        ) : null}
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  emptyHero: { overflow: "hidden", backgroundColor: theme.colors.surface },
  emptyBody: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: theme.layout.screenPadding,
  },
  emptyTitle: { fontSize: EMPTY_TITLE_SIZE, textAlign: "center", maxWidth: 560 },
  emptyTitleLatin: { lineHeight: EMPTY_TITLE_LINE, letterSpacing: -0.8 },
  emptyTitleMyanmar: { lineHeight: EMPTY_TITLE_LINE_MYANMAR },
  emptyMessage: { marginTop: theme.spacing.sm, textAlign: "center", maxWidth: 560 },
  slide: { overflow: "hidden", backgroundColor: theme.colors.surface },
  art: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  /** Books board: the blurred cover backdrop sits under a 30% ground wash. */
  coverWash: { backgroundColor: withAlpha(theme.colors.background, 0.3) },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0 },
  footScrim: { position: "absolute", left: 0, right: 0, bottom: 0 },
  /** Boards: 380 of 640 (poster) and 440 of 740 (cover) — kept as shares so a taller hero keeps its copy on the dark. */
  footScrimPoster: { height: "62%" },
  footScrimCover: { height: "62%" },
  body: { flex: 1, justifyContent: "flex-end", paddingHorizontal: theme.layout.screenPadding },
  coverStage: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingBottom: theme.spacing.lg },
  /** Android casts elevation only from an opaque view — the wrapper carries a fill. */
  coverLift: { backgroundColor: theme.colors.surface, ...theme.shadow.lg },
  copy: { maxWidth: 560 },
  copyCentered: { alignSelf: "center", alignItems: "stretch", width: "100%" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: theme.spacing.sm },
  centerRow: { justifyContent: "center" },
  centerText: { textAlign: "center" },
  /** Boards: 22pt tags, radius 4. */
  tag: { minHeight: 22, paddingHorizontal: 7, borderRadius: 4, justifyContent: "center" },
  tagNew: { backgroundColor: theme.colors.primary },
  tagNeutral: { backgroundColor: theme.colors.tonalStrong },
  kicker: { flexShrink: 1 },
  title: { marginTop: 10, fontSize: TITLE_SIZE },
  titleFirst: { marginTop: 0 },
  titleLatin: { lineHeight: TITLE_LINE, letterSpacing: -1.4 },
  titleMyanmar: { lineHeight: TITLE_LINE_MYANMAR },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 10, rowGap: 4, marginTop: 10 },
  metaStrong: { flexDirection: "row", alignItems: "center", gap: 4 },
  blurb: { marginTop: theme.spacing.sm },
  actions: { flexDirection: "row", alignItems: "stretch", gap: 10, marginTop: 18 },
  actionsStacked: { flexDirection: "column" },
  sideActions: { flexDirection: "row", gap: 10 },
  sideActionsStacked: { alignSelf: "stretch" },
  grow: { flex: 1 },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: theme.radius.button,
  },
  primaryText: { flexShrink: 1 },
  primaryTextSingle: { alignItems: "center" },
  primaryLabel: { fontSize: 16, textAlign: "left" },
  secondary: { minHeight: 52 },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.tonalStrong,
  },
  secondaryLabel: { flexShrink: 1, textAlign: "center" },
  square: {
    width: 52,
    minHeight: 52,
    borderRadius: theme.radius.button,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.tonalStrong,
  },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.8 },
  pager: {
    position: "absolute",
    left: theme.layout.screenPadding,
    right: theme.layout.screenPadding,
    bottom: PAGER_BOTTOM,
    flexDirection: "row",
    gap: 6,
  },
  segment: { flex: 1, height: PAGER_TARGET, justifyContent: "center" },
  /** Home's promo badge — the board's 24pt chip, radius 6. */
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeLabel: { letterSpacing: 0 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  noteRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 6, marginTop: 10 },
  noteText: { fontSize: 17, lineHeight: 24 },
  extra: { marginTop: 10 },
  /** Home's dots row: 44pt tall, 8pt under the hero. */
  dotsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: PAGER_TARGET, marginTop: 8 },
  dotsArrow: {
    width: PAGER_TARGET,
    height: PAGER_TARGET,
    borderRadius: PAGER_TARGET / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dotTarget: { width: PAGER_TARGET, height: PAGER_TARGET, alignItems: "center", justifyContent: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.track },
  dotActive: { width: 22, backgroundColor: theme.colors.primary },
  dotsCounter: { minWidth: 64, textAlign: "center" },
  segmentTrack: { height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: theme.colors.track },
  segmentFill: { position: "absolute", top: 0, bottom: 0, left: 0 },
  segmentDone: { width: "100%", backgroundColor: theme.colors.text },
  segmentActive: { backgroundColor: theme.colors.primary },
  segmentFull: { width: "100%" },
});
