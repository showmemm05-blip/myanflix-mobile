import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, BackHandler, StyleSheet, View, type ViewInstance } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused, useNavigationState, type CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppBarAction } from "@/components/layout/AppBar";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { CenteredTitleRow } from "@/components/layout/CenteredTitleRow";
import { GLASS_BAR_ROW, GlassBarBackground, GlassTarget, useMeasuredHeight } from "@/components/layout/GlassBar";
import { GlassChip } from "@/components/hub/GlassChip";
import { MediaCategoriesRow, type MediaCategoriesSelection } from "@/components/hub/MediaCategoriesRow";
import { sectionFor, sectionLabel, type MediaSection } from "@/components/hub/mediaSections";
import {
  CategoriesOverlay,
  bookCategorySelectionKey,
  categorySelectionKey,
  type CategoryKind,
  type CategoryPick,
} from "@/components/hub/CategoriesOverlay";
import { useMovieResults, useSeriesResults } from "@/components/hub/useMediaResults";
import {
  movieLanguagePick,
  movieSelectionName,
  seriesLanguagePick,
  seriesSelectionName,
} from "@/components/search/filters";
import { useCategories } from "@/hooks/useCategories";
import { MoviesHubContent } from "@/components/hub/MoviesHubContent";
import { SeriesHubContent } from "@/components/hub/SeriesHubContent";
import { BooksHubContent } from "@/components/hub/BooksHubContent";
import { MusicComingSoon } from "@/components/hub/MusicComingSoon";
import { HubChromeContext } from "@/components/hub/hubLayout";
import { useHubScroll } from "@/components/hub/useHubScroll";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { MainTabParamList, RootStackParamList, SearchStackParamList } from "@/navigation/types";

/**
 * Composite: the hubs inside push onto THIS stack (details, Browse, the
 * filters page, the search screen) and reach the root stack above the tabs
 * for the Player and the reader.
 */
type Props = CompositeScreenProps<
  NativeStackScreenProps<SearchStackParamList, "Search">,
  CompositeScreenProps<BottomTabScreenProps<MainTabParamList>, NativeStackScreenProps<RootStackParamList>>
>;

/**
 * The pinned chrome under the status bar before it has been measured: the
 * root bar's 8 + 44pt "Media" row (the hub's own, GLASS_BAR_ROW) and the
 * section row's 8 + 44 under it — the boards' 60 → 104, and nothing below
 * that. The measured height (`onChromeLayout`) wins as soon as it is known.
 */
const CHROME_ESTIMATE = GLASS_BAR_ROW + theme.spacing.sm + theme.layout.minTouch;

/**
 * After the Categories pop-up closes: past its fade-out (and Android's own
 * focus restore, when it does one), so ours is the last word.
 */
const FOCUS_CHIP_AFTER_CLOSE_MS = 400;

/**
 * One section's page, kept mounted once visited. Only the current section's
 * page is shown; the others stay laid out underneath — invisible,
 * untouchable and out of the accessibility tree — so each keeps its scroll
 * position, its hero slide and its data, and switching back is instant with
 * no refetch. NOT `display: none`: Yoga zeroes a hidden subtree's layout,
 * which would collapse the list's content and could fire its end-reached
 * paging while nobody is looking.
 */
function ChipLayer({ visible, children }: { visible: boolean; children: ReactNode }) {
  return (
    <View
      style={[StyleSheet.absoluteFill, !visible && styles.hiddenLayer]}
      pointerEvents={visible ? "box-none" : "none"}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
    >
      {children}
    </View>
  );
}

/**
 * A SECTION PAGE of the Media tab (docs/media-hub-2026-10-22/project: Main,
 * MediaSeries, MediaBooks, MediaMusic — the owner, 2026-10-22: "choose
 * movies, series, books and music, after that it will show accordingly").
 * The hub (MediaHub) chooses; this page shows ONE section, browsed the
 * Netflix way: browse → pick a category or genre → see its titles → scroll,
 * and more load by themselves.
 *
 *   Pinned on top   two rows (the owner, 2026-10-22: the canvas, v8). Row 1
 *                   is the Media tab's own root bar, exactly the hub's: the
 *                   big "Media" heading, the search button, the bell and the
 *                   avatar (AppTopBar). Row 2 (CenteredTitleRow): the round ‹
 *                   (back to the hub) on the left, the section's name
 *                   centred, the Categories grid button on the right — greyed on Music;
 *                   on a Movies / Series results view the Netflix pair
 *                   instead: ✕ · "Drama ▾". Nothing else — no Switch, no
 *                   third row; the page starts right under row 2. Every
 *                   control in both rows is its own Liquid Glass button
 *                   (the "Top bar" board, 2026-11-10); the heading stays
 *                   plain. The rows are TRANSPARENT at the top of the page
 *                   and gain the scroll-edge fade as it scrolls
 *                   (components/layout/GlassBar); never a black bar (the
 *                   owner, 2026-10-02). The bar's empty space always passes
 *                   touches through to the page.
 *   Body           the section's page: MoviesHubContent / SeriesHubContent
 *                   (browse: hero + shelves; results: a genre's hero + a
 *                   self-paging grid with Sort & filter) / BooksHubContent,
 *                   or the Music "coming soon" stage. Each stays mounted
 *                   once visited (ChipLayer), so coming back keeps every
 *                   section's state.
 *
 * THE SECTION IS THE ROUTE PARAM. `initialTab` is read on every render,
 * never copied into state: the hub's cards, Home's Film / Series / Book /
 * Music lanes and the search screen's "See all" all navigate here with it
 * (with `pop: true` it is replaced on a page already open, so the same lane
 * twice still lands), and a Categories pick of another kind writes it back
 * with setParams. Changing section otherwise means "‹ Media" and the hub.
 * "all" and nothing both mean Movies.
 *
 * "‹ Media" pops to the hub underneath (always there: the stack's initial
 * route, built under this page by `initial: false` when a lane opens a cold
 * tab); should the hub ever not be directly below, popTo finds — or
 * recreates — it, so the user is never stuck. Android's back on a results
 * view goes back to browse first (the ✕'s job).
 *
 * Categories (the grid button; the owner, 2026-10-07 and 2026-11-10): from
 * Movies, Series or Books it opens the Categories pop-up for THAT section
 * only — colour tiles under "Genres", and on Movies "Movie type" and
 * "Language" (Series: "Language"). Music has no categories, so there the
 * button is greyed and says so (MediaMusic.dc.html). A Movies or Series
 * pick (a genre, an admin category, a movie type or a language) opens that
 * section's results — every one of them is a server filter (categoryId,
 * genres, countries, languages; a Series category is held beside the shared
 * filters, useSeriesResults). A Books pick (one of the books' own
 * categories) shows its All books grid on that category, scrolled into
 * view; a guest's Books pop-up asks them to sign in instead. Each of Movies
 * and Series remembers its own view (useMovieResults / useSeriesResults over
 * the shared searchFiltersStore); Books' All books category is held here
 * (`bookCategory`), so the pop-up can tick it.
 *
 * Search lives on its own screen ("MediaSearch"), LOCKED to this section
 * (Music: everything); nothing here holds search state. Its results use the
 * same shared filters, so a genre picked here narrows a search too (shown
 * there as removable chips).
 */
export function MediaScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const section = sectionFor(route.params?.initialTab);
  const setSection = useCallback((next: MediaSection) => navigation.setParams({ initialTab: next }), [navigation]);
  const typeLabel = sectionLabel(t, section);

  /* ---- the pinned chrome ---- */
  const [chromeHeight, onChromeLayout] = useMeasuredHeight(insets.top + CHROME_ESTIMATE);

  // One scroll per page, owned here: a Books pick in the pop-up scrolls its list.
  const moviesScroll = useHubScroll(chromeHeight);
  const seriesScroll = useHubScroll(chromeHeight);
  const booksScroll = useHubScroll(chromeHeight);
  const musicScrollY = useSharedValue(0);
  const activeScrollY =
    section === "movies"
      ? moviesScroll.scrollY
      : section === "series"
        ? seriesScroll.scrollY
        : section === "books"
          ? booksScroll.scrollY
          : musicScrollY;

  /**
   * The scroll-edge fade behind the bar (components/layout/GlassBar — this
   * screen is its reference, the "Top bar" board): nothing at the top, then
   * a soft dark fade with a light blur, coming in with the CURRENT page's
   * scroll and going back out on the way up. The target wraps every
   * section's page.
   */
  const blurTargetRef = useRef<ViewInstance>(null);

  /**
   * The pages visited so far. A page mounts the first time its section is
   * shown and then stays mounted (ChipLayer). Updated during render —
   * React's "adjust state while rendering" — so the first visit draws the
   * page in the same pass, never a blank frame.
   */
  const [mounted, setMounted] = useState<readonly MediaSection[]>(() => [section]);
  if (!mounted.includes(section)) setMounted([...mounted, section]);

  /* ---- browse / results, per section (the shared filters, held while hidden) ---- */
  const movieResults = useMovieResults(section === "movies" && isFocused);
  const seriesResults = useSeriesResults(section === "series" && isFocused);
  const categoriesQuery = useCategories();
  const movieCategoryId = movieResults.filters.categoryId;
  const seriesCategoryId = seriesResults.categoryId;
  /** A picked category's name for the Categories row — "Category" until the list is known. */
  const categoryNameOf = useCallback(
    (id: string | null) =>
      id ? (categoriesQuery.data?.find((category) => category.id === id)?.name ?? t.browse.categoryOverline) : null,
    [categoriesQuery.data, t],
  );
  const movieCategoryName = useMemo(() => categoryNameOf(movieCategoryId), [categoryNameOf, movieCategoryId]);
  const seriesCategoryName = useMemo(() => categoryNameOf(seriesCategoryId), [categoryNameOf, seriesCategoryId]);
  const closeMovieResults = movieResults.close;
  const closeSeriesResults = seriesResults.close;
  /** The Netflix row while Movies or Series shows its results. */
  const selection = useMemo<MediaCategoriesSelection | null>(() => {
    if (section === "movies" && movieResults.showResults) {
      return {
        pick: movieSelectionName(t, movieResults.filters, movieCategoryName, movieResults.languagePick),
        onClear: closeMovieResults,
      };
    }
    if (section === "series" && seriesResults.showResults) {
      return {
        pick: seriesSelectionName(seriesResults.filters, seriesCategoryName, seriesCategoryId, seriesResults.languagePick),
        onClear: closeSeriesResults,
      };
    }
    return null;
  }, [
    t,
    section,
    movieResults.showResults,
    movieResults.filters,
    movieResults.languagePick,
    movieCategoryName,
    closeMovieResults,
    seriesResults.showResults,
    seriesResults.filters,
    seriesResults.languagePick,
    seriesCategoryName,
    seriesCategoryId,
    closeSeriesResults,
  ]);

  /**
   * Android's back on a Movies / Series results view returns to that
   * section's browse, as Netflix's does — the Categories row's ✕. Claimed
   * only while this page is focused and a results view is showing; otherwise
   * the navigator has it (and pops to the hub). The Categories overlay and
   * the Sort & filter sheet are Modals and close themselves on back before
   * this ever hears it.
   */
  const closeShownResults = selection?.onClear;
  useEffect(() => {
    if (!isFocused || !closeShownResults) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeShownResults();
      return true;
    });
    return () => subscription.remove();
  }, [isFocused, closeShownResults]);

  /* ---- Books' All books category (the pop-up sets and highlights it) ---- */
  const [bookCategory, setBookCategory] = useState("");
  /** Up by one per Books pick in the pop-up — BooksHubContent resets its other filters and scrolls to All books. */
  const [bookPickSeq, setBookPickSeq] = useState(0);

  /* ---- the Categories pop-up ---- */
  const [overlayOpen, setOverlayOpen] = useState(false);
  const closeOverlay = useCallback(() => setOverlayOpen(false), []);
  /**
   * Focus back to the Categories chip on every close — the ✕, Android's
   * back, a pick or Sign in. iOS's VoiceOver restores it by itself, TalkBack
   * often does not. After a pick the row may have swapped (browse →
   * results), and the ref then holds the new row's chip, which is the one
   * that reopens the pop-up. A quick reopen cancels the pending move.
   */
  const categoriesChipRef = useRef<ViewInstance>(null);
  const overlayWasOpen = useRef(false);
  useEffect(() => {
    if (overlayOpen) {
      overlayWasOpen.current = true;
      return;
    }
    if (!overlayWasOpen.current) return;
    overlayWasOpen.current = false;
    const timer = setTimeout(() => {
      const chipView = categoriesChipRef.current;
      if (chipView) AccessibilityInfo.sendAccessibilityEvent(chipView, "focus");
    }, FOCUS_CHIP_AFTER_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [overlayOpen]);
  /**
   * Mounted on its first opening (in the same render — React's "adjust state
   * while rendering") and then kept, so its fade-out still plays: a visit
   * that never opens it asks for nothing, and it only asks for the data of
   * the section it is opened from.
   */
  const [overlayUsed, setOverlayUsed] = useState(false);
  if (overlayOpen && !overlayUsed) setOverlayUsed(true);
  /** It opens on the section showing. (Music's pill is disabled; Movies is only the type's fallback there.) */
  const overlayKind: CategoryKind = section === "series" ? "series" : section === "books" ? "books" : "movies";
  /** The tile ticked per kind — only for the section the user is looking at ("All …" when nothing is picked). */
  const movieLanguageTile = movieResults.languagePick;
  const seriesLanguageTile = seriesResults.languagePick;
  const overlaySelected = useMemo<Record<CategoryKind, string | null>>(
    () => ({
      movies:
        section === "movies"
          ? categorySelectionKey({
              genres: movieResults.filters.genres,
              categoryId: movieCategoryId,
              countries: movieResults.filters.countries,
              languagePick: movieLanguageTile,
            })
          : null,
      series:
        section === "series"
          ? categorySelectionKey({
              genres: seriesResults.filters.genres,
              categoryId: seriesCategoryId,
              languagePick: seriesLanguageTile,
            })
          : null,
      books: section === "books" ? bookCategorySelectionKey(bookCategory) : null,
    }),
    [
      section,
      movieResults.filters,
      movieCategoryId,
      movieLanguageTile,
      seriesResults.filters,
      seriesCategoryId,
      seriesLanguageTile,
      bookCategory,
    ],
  );
  const openMovieResults = movieResults.open;
  const openSeriesResults = seriesResults.open;
  /**
   * A pick opens (or switches) the results view and replaces the last pick —
   * a genre, category, movie type or language; the refinements already
   * chosen stay. A language that was itself the last pick (the Language
   * tile's, movieLanguagePick) goes with it; languages set in Sort & filter
   * stay. Only a Language tile's pick is remembered as one.
   */
  const pickMovies = useCallback(
    (pick: CategoryPick) =>
      openMovieResults(
        (f) => ({
          ...f,
          genres: pick.kind === "genre" ? [pick.genre] : [],
          categoryId: pick.kind === "category" ? pick.id : null,
          countries: pick.kind === "type" ? [pick.value] : [],
          languages:
            pick.kind === "language" ? [pick.value] : movieLanguagePick(f, movieLanguageTile) ? [] : f.languages,
        }),
        { languageTile: pick.kind === "language" ? pick.value : null },
      ),
    [openMovieResults, movieLanguageTile],
  );
  /**
   * The same for Series (no movie type there) — its category is kept beside
   * the shared filters and sent by SeriesHubContent (useSeriesResults).
   */
  const pickSeries = useCallback(
    (pick: CategoryPick) =>
      openSeriesResults(
        (f) => ({
          ...f,
          genres: pick.kind === "genre" ? [pick.genre] : [],
          languages:
            pick.kind === "language"
              ? [pick.value]
              : seriesLanguagePick(f, seriesCategoryId, seriesLanguageTile)
                ? []
                : f.languages,
        }),
        {
          categoryId: pick.kind === "category" ? pick.id : null,
          languageTile: pick.kind === "language" ? pick.value : null,
        },
      ),
    [openSeriesResults, seriesCategoryId, seriesLanguageTile],
  );
  /** A pick for any kind: that kind's section, then its genre / category. */
  const pickCategory = useCallback(
    (kind: CategoryKind, pick: CategoryPick) => {
      setSection(kind);
      if (kind === "movies") pickMovies(pick);
      else if (kind === "series") pickSeries(pick);
      else {
        setBookCategory(pick.kind === "category" ? pick.id : "");
        setBookPickSeq((n) => n + 1);
      }
    },
    [setSection, pickMovies, pickSeries],
  );
  /**
   * A guest's "Sign in" in the Books pop-up. Today it cannot be reached: a
   * signed-out user never sees this tab, because the root stack swaps the
   * whole app for the sign-in screens (RootNavigator). The prompt is kept
   * for the owner's rule (book categories are members-only) in case guest
   * browsing comes to the app, as it has on the website; it only navigates
   * when the root stack really holds the sign-in screens, so it can never
   * fire a navigation nobody handles.
   */
  const signIn = useCallback(() => {
    const root = navigation.getParent()?.getParent();
    if (root?.getState()?.routeNames.includes("Auth")) navigation.navigate("Auth", { screen: "Login" });
  }, [navigation]);

  /* ---- actions ---- */
  /** Whether the hub is the route directly under this page — the normal case (see the component note). */
  const hubBelow = useNavigationState((state) => {
    const at = state.routes.findIndex((entry) => entry.key === route.key);
    return at > 0 && state.routes[at - 1]?.name === "MediaHub";
  });
  const backToHub = useCallback(() => {
    if (hubBelow) navigation.goBack();
    else navigation.popTo("MediaHub");
  }, [hubBelow, navigation]);
  /** The search screen, locked to this section; Music has no catalogue, so from there it searches everything. */
  const openSearch = useCallback(
    () => navigation.navigate("MediaSearch", section === "music" ? { scope: "all" } : { scope: section, lock: true }),
    [navigation, section],
  );
  /** The button says what that search is locked to (Main.dc.html: "Search movies") — the locked field's own placeholder; Music's is plain "Search". */
  const searchA11y =
    section === "series"
      ? t.search.placeholderSeries
      : section === "books"
        ? t.search.placeholderBooks
        : section === "music"
          ? t.browse.searchA11y
          : t.search.placeholderMovies;
  const openCategories = useCallback(() => setOverlayOpen(true), []);

  return (
    <View style={styles.container}>
      <HubChromeContext.Provider value={chromeHeight}>
        <GlassTarget targetRef={blurTargetRef}>
          {mounted.map((kind) => {
            // On screen AND this page focused: a page under a pushed screen
            // (the search screen, a title, the filters page) holds its hero
            // pager and its "All …" filters still, like a hidden section.
            const active = section === kind && isFocused;
            return (
              <ChipLayer key={kind} visible={section === kind}>
                {kind === "movies" ? (
                  <MoviesHubContent active={active} scroll={moviesScroll} results={movieResults} />
                ) : kind === "series" ? (
                  <SeriesHubContent active={active} scroll={seriesScroll} results={seriesResults} />
                ) : kind === "books" ? (
                  <BooksHubContent
                    active={active}
                    scroll={booksScroll}
                    category={bookCategory}
                    onCategoryChange={setBookCategory}
                    categoryPickSeq={bookPickSeq}
                  />
                ) : (
                  <MusicComingSoon scrollY={musicScrollY} />
                )}
              </ChipLayer>
            );
          })}
        </GlassTarget>
      </HubChromeContext.Provider>

      {/* The scroll-edge fade behind the two rows (the "Top bar" board,
          2026-11-10): nothing at the top, then dark at the top edge and gone
          32pt under row 2 as the page scrolls — never a solid bar (the owner,
          2026-10-02). Rendered after the body, as expo-blur needs for
          scrolling content. */}
      <GlassBarBackground scrollY={activeScrollY} height={chromeHeight} blurTarget={blurTargetRef} />
      {/* Row 1: the tab's root bar with the SECTION as its heading (owner,
          2026-10-22: "when i click Movies the navbar should change to the
          movies"), transparent over the hero. Row 2, as the bar's children
          and so inside its measured box: the round ‹ (back to the hub) and the Categories grid button at the
          two ends; no centre title, the heading above already names the page. */}
      <AppTopBar
        transparent
        touchThrough
        heading={typeLabel}
        onLayout={onChromeLayout}
        trailing={<AppBarAction icon="search" onPress={openSearch} accessibilityLabel={searchA11y} />}
      >
        <CenteredTitleRow
          title=""
          touchThrough
          style={styles.sectionRow}
          leading={
            // A round glass ‹ with no words (the owner, 2026-11-10: icon 1 and
            // layout B1 on the "Back icon" board), still spoken "Back to Media".
            <GlassChip round onPress={backToHub} accessibilityLabel={t.search.backToMedia}>
              <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
            </GlassChip>
          }
          trailing={
            <MediaCategoriesRow
              onCategories={openCategories}
              categoriesRef={categoriesChipRef}
              selection={selection}
              typeLabel={typeLabel}
              disabled={section === "music"}
            />
          }
        />
      </AppTopBar>

      {overlayUsed ? (
        <CategoriesOverlay
          visible={overlayOpen}
          onClose={closeOverlay}
          initialKind={overlayKind}
          selected={overlaySelected}
          onPick={pickCategory}
          signedIn={isAuthenticated}
          onSignIn={signIn}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  /** The board's 8pt between the root bar's row and the section row (60 − 52). */
  sectionRow: { marginTop: theme.spacing.sm },
  /** A mounted page that is not the one showing — see ChipLayer. */
  hiddenLayer: { opacity: 0 },
});
