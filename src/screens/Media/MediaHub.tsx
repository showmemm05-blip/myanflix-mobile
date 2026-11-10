import { useCallback, useMemo, useRef } from "react";
import { StyleSheet, View, type ViewInstance } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { AppBarAction } from "@/components/layout/AppBar";
import { GLASS_BAR_ROW, GlassBarBackground, GlassTarget, useMeasuredHeight } from "@/components/layout/GlassBar";
import { HubRow, type HubRowItem } from "@/components/hub/HubRow";
import { hasMyanmar } from "@/components/hub/hubLayout";
import { MediaSectionCard } from "@/components/hub/MediaSectionCard";
import { sectionLabel, type MediaSection } from "@/components/hub/mediaSections";
import { BROWSE_OPTIONS, HISTORY_QUERY, HOME_ROW_LIMIT, NEWEST_MOVIES_QUERY, NEWEST_SERIES_QUERY, continueWatching } from "@/components/home/homeData";
import { historyStatusLine, percentOf } from "@/components/library/historyFormat";
import { isRecentlyAdded } from "@/components/movie/mediaItems";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ThemedText } from "@/components/ui/ThemedText";
import { useBooksInfinite } from "@/hooks/useBooks";
import { useDockClearance } from "@/hooks/useDockClearance";
import { useMoviesInfinite } from "@/hooks/useMovies";
import { LIST_PAGE_SIZE } from "@/hooks/pagination";
import { useSeriesInfinite } from "@/hooks/useSeries";
import { useWatchHistoryInfinite } from "@/hooks/useVideo";
import { useLanguage } from "@/localization/LanguageProvider";
import type { TranslationShape } from "@/localization/translations";
import { useAuthStore } from "@/store/authStore";
import { theme } from "@/theme";
import type { MainTabParamList, RootStackParamList, SearchStackParamList } from "@/navigation/types";

/** The hub pushes the section page and the search screen on its own stack, and reaches the root stack for the Player. */
type Props = CompositeScreenProps<
  NativeStackScreenProps<SearchStackParamList, "MediaHub">,
  CompositeScreenProps<BottomTabScreenProps<MainTabParamList>, NativeStackScreenProps<RootStackParamList>>
>;

/** The Books hub's and the search screen's no-term key, so the three share one cache entry. */
const NEWEST_BOOKS_QUERY = { limit: LIST_PAGE_SIZE } as const;
/** The board's card line — "—" when the count could not be loaded (never a crash, never a stale number). */
const LINE_UNAVAILABLE = "—";
/** The empty Continue block's glyph disc (the board's 44). */
const EMPTY_DISC = 44;

/** "1,240" — the same grouping the wallet prints (utils/currency), digits always Latin. */
function formatCount(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString("en-US");
}

/**
 * A card's live line from the newest page of its catalogue: the backend
 * total, then how many of that page were added in the NEW window
 * (isRecentlyAdded — the hubs' own rule). A page that is ALL new may hide
 * more behind it, so it says "30+ new"; nothing new says the count alone.
 */
function sectionLine(
  t: TranslationShape,
  total: number,
  items: ReadonlyArray<{ createdAt: string | null | undefined }>,
  count: { one: string; many: string },
): string {
  const countLabel = total === 1 ? count.one : count.many.replace("{n}", formatCount(total));
  const fresh = items.filter((item) => isRecentlyAdded(item.createdAt)).length;
  if (fresh === 0) return countLabel;
  const more = fresh >= items.length && total > items.length;
  const freshLabel = (more ? t.hub.newCountPlus : t.hub.newCount).replace("{n}", formatCount(fresh));
  return `${countLabel} · ${freshLabel}`;
}

/**
 * THE MEDIA TAB'S ROOT since 2026-10-22 (the owner: "i want the same flow as
 * lottery … choose movies, series, books and music, after that it will show
 * accordingly"; MediaHub.dc.html), in the Lottery hub's recipe — the glass
 * root bar with the tab's own "Media" heading and its search button, the
 * page scrolling under it, the dock cleared at the foot:
 *
 *  - a search field that is really a button (the search screen, on every
 *    section — the field there takes the caret);
 *  - "Choose what to open": the Movies / Series / Books cards, each with a
 *    live line ("1,240 titles · 12 new") from the newest page its own hub
 *    and Home already hold (NEWEST_*_QUERY — no request of its own once
 *    either has loaded), and Music, tagged Soon, not a button. A card opens
 *    the section page (route "Search") on that section. Books' line is
 *    members-only, like the library: a guest reads "Members only";
 *  - "Continue watching", signed in only: the part-watched titles of the
 *    watch history (Home's rule and key), 112pt posters with the progress
 *    line, straight into the Player; nothing part-watched shows the board's
 *    "Nothing in progress yet" block, a failed request shows nothing.
 *    There is no reading-progress list endpoint, so books are not here.
 *
 * Re-tapping the Media tab pops back here (MainTabNavigator's listener);
 * "‹ Media" on a section page does the same.
 */
export function MediaHubScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const dockClearance = useDockClearance();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [barHeight, onBarLayout] = useMeasuredHeight(insets.top + GLASS_BAR_ROW);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const blurTarget = useRef<ViewInstance>(null);

  /* ---- the cards' live lines: the hubs' and Home's own first pages ---- */
  const moviesQuery = useMoviesInfinite(NEWEST_MOVIES_QUERY, BROWSE_OPTIONS);
  const seriesQuery = useSeriesInfinite(NEWEST_SERIES_QUERY, BROWSE_OPTIONS);
  // Gated on the session: /books 401s a guest, and a 401 forces a logout.
  const booksQuery = useBooksInfinite(NEWEST_BOOKS_QUERY, { ...BROWSE_OPTIONS, enabled: isAuthenticated });
  const moviesPage = moviesQuery.data?.pages[0];
  const seriesPage = seriesQuery.data?.pages[0];
  const booksPage = booksQuery.data?.pages[0];
  /**
   * Null while loading (the card draws a bar); "—" once a request has failed
   * with nothing in hand — or cannot even start: offline, React Query parks
   * a first fetch as `paused` (not an error, never `isLoading`), and a bar
   * that pulses until the network returns would be a lie.
   */
  const moviesLine = useMemo(
    () =>
      moviesPage
        ? sectionLine(t, moviesPage.total, moviesPage.items, { one: t.library.titlesCountOne, many: t.library.titlesCount })
        : moviesQuery.isError || moviesQuery.fetchStatus === "paused"
          ? LINE_UNAVAILABLE
          : null,
    [t, moviesPage, moviesQuery.isError, moviesQuery.fetchStatus],
  );
  const seriesLine = useMemo(
    () =>
      seriesPage
        ? sectionLine(t, seriesPage.total, seriesPage.items, { one: t.hub.showsCountOne, many: t.hub.showsCount })
        : seriesQuery.isError || seriesQuery.fetchStatus === "paused"
          ? LINE_UNAVAILABLE
          : null,
    [t, seriesPage, seriesQuery.isError, seriesQuery.fetchStatus],
  );
  const booksLine = useMemo(
    () =>
      !isAuthenticated
        ? t.hub.membersOnly
        : booksPage
          ? sectionLine(t, booksPage.total, booksPage.items, { one: t.hub.booksCountOne, many: t.hub.booksCount })
          : booksQuery.isError || booksQuery.fetchStatus === "paused"
            ? LINE_UNAVAILABLE
            : null,
    [t, isAuthenticated, booksPage, booksQuery.isError, booksQuery.fetchStatus],
  );

  /* ---- Continue watching: the history's part-watched titles (Home's rule) ---- */
  const historyQuery = useWatchHistoryInfinite(HISTORY_QUERY, { ...BROWSE_OPTIONS, enabled: isAuthenticated });
  const historyPage = historyQuery.data?.pages[0]?.items;
  const resume = useMemo(() => continueWatching(historyPage ?? []).slice(0, HOME_ROW_LIMIT), [historyPage]);
  /** Straight into the Player, which resumes the title — the root stack, above the tabs. */
  const playMovie = useCallback((movieId: string) => navigation.navigate("Player", { movieId }), [navigation]);
  const resumeItems = useMemo<HubRowItem[]>(
    () =>
      resume.map((entry) => ({
        key: entry.id,
        title: entry.movieTitle,
        imageUrl: entry.posterUrl,
        progress: percentOf(entry),
        meta: [historyStatusLine(entry, t)],
        onPress: () => playMovie(entry.movieId),
      })),
    [resume, t, playMovie],
  );
  /**
   * The empty block only on a SETTLED answer: a history that was never
   * fetched (offline, the first request parked as `paused`) is not "nothing
   * in progress", so the row hides, as Home's Continue row does.
   */
  const historyPaused = historyQuery.isPending && historyQuery.fetchStatus === "paused";
  const resumeLoading = isAuthenticated && historyQuery.isPending && !historyPaused;
  const resumeEmpty = isAuthenticated && historyQuery.isSuccess && resume.length === 0;
  const showResume = isAuthenticated && !historyQuery.isError && !historyPaused;

  /* ---- actions ---- */
  const openSearch = useCallback(() => navigation.navigate("MediaSearch", { scope: "all" }), [navigation]);
  const openSection = useCallback(
    (section: Exclude<MediaSection, "music">) => navigation.navigate("Search", { initialTab: section }),
    [navigation],
  );

  /** "Movies, 1,240 titles · 12 new" — or "Movies, Loading…" while the line is on its way. */
  const cardA11y = (section: MediaSection, line: string | null) =>
    `${sectionLabel(t, section)}, ${line ?? t.common.loading}`;

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
            style={[styles.chooseLabel, !hasMyanmar(t.hub.chooseSection) && styles.chooseLabelLatin]}
          >
            {t.hub.chooseSection}
          </ThemedText>

          <View style={styles.cards}>
            <View style={styles.cardRow}>
              <MediaSectionCard
                section="movies"
                title={t.search.movies}
                line={moviesLine}
                accessibilityLabel={cardA11y("movies", moviesLine)}
                onPress={() => openSection("movies")}
              />
              <MediaSectionCard
                section="series"
                title={t.search.series}
                line={seriesLine}
                accessibilityLabel={cardA11y("series", seriesLine)}
                onPress={() => openSection("series")}
              />
            </View>
            <View style={styles.cardRow}>
              <MediaSectionCard
                section="books"
                title={t.search.books}
                line={booksLine}
                accessibilityLabel={cardA11y("books", booksLine)}
                onPress={() => openSection("books")}
              />
              <MediaSectionCard
                section="music"
                title={t.search.music}
                line={t.hub.comingSoon}
                soonLabel={t.hub.soon}
                accessibilityLabel={`${t.search.music}, ${t.hub.comingSoon}`}
                accessibilityHint={t.hub.musicSoonBody}
              />
            </View>
          </View>

          {showResume ? (
            <View style={styles.resume}>
              {resumeEmpty ? (
                <>
                  <ResumeHeader />
                  <View style={styles.emptyBlock}>
                    <View style={styles.emptyDisc}>
                      <Ionicons name="play-circle-outline" size={22} color={theme.colors.textMuted} />
                    </View>
                    <View style={styles.emptyText}>
                      <ThemedText variant="body" weight="extrabold">
                        {t.hub.nothingInProgressTitle}
                      </ThemedText>
                      <ThemedText variant="caption">{t.hub.nothingInProgressBody}</ThemedText>
                    </View>
                  </View>
                </>
              ) : (
                <HubRow
                  header={<ResumeHeader />}
                  title={t.library.continueWatching}
                  items={resumeItems}
                  variant="poster"
                  loading={resumeLoading}
                />
              )}
            </View>
          ) : null}
        </Animated.ScrollView>
      </GlassTarget>

      {/* The scroll-edge fade, brought in by scroll — under the bar, over the page. */}
      <GlassBarBackground scrollY={scrollY} height={barHeight} blurTarget={blurTarget} />
      <AppTopBar
        transparent
        touchThrough
        heading={t.nav.media}
        onLayout={onBarLayout}
        trailing={
          <AppBarAction icon="search" onPress={openSearch} accessibilityLabel={t.browse.searchA11y} />
        }
      />
    </View>
  );
}

/** The Continue row's heading, with the board's quiet line on the right instead of a "See all". */
function ResumeHeader() {
  const { t } = useLanguage();
  return (
    <SectionHeader
      title={t.library.continueWatching}
      titleLines={2}
      accessory={
        <ThemedText variant="caption" numberOfLines={2} style={styles.resumeHint}>
          {t.hub.pickUpHint}
        </ThemedText>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },
  /** The board: 48pt, radius 14, the raised fill with a white-at-8% edge, the glyph 14pt in. */
  /** 16pt under the field; 10pt over the cards. */
  chooseLabel: { marginTop: theme.spacing.sm, marginBottom: 10, paddingHorizontal: theme.layout.screenPadding },
  /** The board's slight tracking — Latin only; Myanmar script takes none. */
  chooseLabelLatin: { letterSpacing: 0.26 },
  cards: { gap: 12, paddingHorizontal: theme.layout.screenPadding },
  cardRow: { flexDirection: "row", gap: 12 },
  /** The board's 28pt over the Continue heading. */
  resume: { marginTop: 28 },
  resumeHint: { flexShrink: 1, textAlign: "right", maxWidth: 160 },
  /** The board's empty block: the sheet fill, radius 16, the disc and two lines. */
  emptyBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: theme.layout.screenPadding,
    paddingVertical: 22,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
  },
  emptyDisc: {
    width: EMPTY_DISC,
    height: EMPTY_DISC,
    borderRadius: EMPTY_DISC / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.tonalSoft,
  },
  emptyText: { flex: 1, minWidth: 0, gap: 2 },
});
