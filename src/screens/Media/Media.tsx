import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, BackHandler, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused, type CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { AppBarAction } from "@/components/layout/AppBar";
import { GlassBarBackground, GlassTarget, useMeasuredHeight } from "@/components/layout/GlassBar";
import { MediaChips, type MediaChip, type MediaChipsSelection } from "@/components/hub/MediaChips";
import {
  CategoriesOverlay,
  bookCategorySelectionKey,
  categorySelectionKey,
  type CategoryKind,
  type CategoryPick,
} from "@/components/hub/CategoriesOverlay";
import { useMovieResults, useSeriesResults } from "@/components/hub/useMediaResults";
import { selectionLabel } from "@/components/search/filters";
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

type RequestedTab = NonNullable<NonNullable<SearchStackParamList["Search"]>["initialTab"]>;

/**
 * The pinned chrome under the status bar before it has been measured: the
 * bar's 8 + 44pt control row, then the chip row's 8 + 44 (the boards' 104).
 */
const CHROME_ESTIMATE = 104;

/**
 * After the Categories pop-up closes: past its fade-out (and Android's own
 * focus restore, when it does one), so ours is the last word.
 */
const FOCUS_CHIP_AFTER_CLOSE_MS = 400;

/** "all" is the search screen's word; the Media tab has no All chip, so it opens on Movies. */
function chipFor(tab: RequestedTab | undefined): MediaChip {
  return !tab || tab === "all" ? "movies" : tab;
}

/**
 * One chip's page, kept mounted once visited. Only the current chip's page is
 * shown; the others stay laid out underneath — invisible, untouchable and out
 * of the accessibility tree — so each keeps its scroll position, its hero
 * slide and its data, and coming back is instant with no refetch. NOT
 * `display: none`: Yoga zeroes a hidden subtree's layout, which would
 * collapse the list's content and could fire its end-reached paging while
 * nobody is looking.
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
 * The Media tab's root (docs/mobile-media-page-2026-10-02/design: Main,
 * MediaSeries, MediaBooks, MediaMusic) — the hub page itself, browsed the
 * Netflix way: browse → pick a category or genre → see its titles → scroll,
 * and more load by themselves.
 *
 *   Pinned on top   the "Media" bar — the title, a round search button (the
 *                   search screen, carrying the current chip and its
 *                   filters), the bell and the avatar — and under it the
 *                   chip row: Movies · Series · Books · Categories ▾ |
 *                   Music (Soon); on a Movies / Series results view, the
 *                   Netflix row instead: ✕ · Movies · "Drama ▾". Both are
 *                   TRANSPARENT at the top of the page and gain the
 *                   frosted glass as it scrolls (components/layout/
 *                   GlassBar — this screen is its reference); never a
 *                   black bar (the owner, 2026-10-02). The bar's empty
 *                   space always passes touches through to the page.
 *   Body           the current chip's page: MoviesHubContent /
 *                   SeriesHubContent (browse: hero + shelves; results: a
 *                   genre's hero + a self-paging grid with Sort & filter) /
 *                   BooksHubContent, or the Music "coming soon" stage. Each
 *                   stays mounted once visited (ChipLayer).
 *
 * Android's back on a results view goes back to browse (the ✕'s job).
 *
 * Categories ▾ (the owner, 2026-10-07): from ANY chip it opens the
 * Categories pop-up, with a Movies · Series · Books switch at its top. It
 * opens on the chip showing (Movies from Music) and the switch changes the
 * list in place. A Movies or Series pick (a genre, or any admin category,
 * empty ones included) moves to that chip and opens its results — a Movies
 * category is sent to the server as categoryId, a Series one is applied on
 * the client (GET /series has no category filter; useSeriesResults). A Books
 * pick (one of the books' own categories) moves to Books and shows its All
 * books grid on that category, scrolled into view. A guest's Books segment
 * asks them to sign in instead. Each of Movies and Series remembers its own
 * view (useMovieResults / useSeriesResults over the shared
 * searchFiltersStore); Books' All books category is held here
 * (`bookCategory`), so the pop-up can highlight it.
 *
 * `initialTab` (Home's Film / Series / Book / Music lanes, the search
 * screen's "See all") picks the chip on arrival — on a fresh tab AND when
 * the tab is already open — and is cleared again, so the same lane twice
 * still lands and the user's own chip taps are left alone.
 *
 * Search lives on its own screen ("MediaSearch"); nothing here holds search
 * state. Its results use the same shared filters, so a genre picked here
 * narrows a search too (shown there as removable chips).
 */
export function MediaScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [chip, setChip] = useState<MediaChip>(() => chipFor(route.params?.initialTab));
  const requestedTab = route.params?.initialTab;
  useEffect(() => {
    if (!requestedTab) return;
    setChip(chipFor(requestedTab));
    navigation.setParams({ initialTab: undefined });
  }, [requestedTab, navigation]);

  /* ---- the pinned chrome ---- */
  const [chromeHeight, onChromeLayout] = useMeasuredHeight(insets.top + CHROME_ESTIMATE);

  // One scroll per page, owned here: a Books pick in the pop-up scrolls its list.
  const moviesScroll = useHubScroll(chromeHeight);
  const seriesScroll = useHubScroll(chromeHeight);
  const booksScroll = useHubScroll(chromeHeight);
  const musicScrollY = useSharedValue(0);
  const activeScrollY =
    chip === "movies"
      ? moviesScroll.scrollY
      : chip === "series"
        ? seriesScroll.scrollY
        : chip === "books"
          ? booksScroll.scrollY
          : musicScrollY;

  /**
   * The frosted bar (components/layout/GlassBar — this screen is its
   * reference): fully transparent at the top, then the page blurred under a
   * 40% tint, fading in with the CURRENT page's scroll and back out on the
   * way up. The target wraps every chip's page.
   */
  const blurTargetRef = useRef<View>(null);

  /**
   * The pages visited so far. A page mounts the first time its chip is
   * picked and then stays mounted (ChipLayer). Updated during render —
   * React's "adjust state while rendering" — so the first visit draws the
   * page in the same pass, never a blank frame.
   */
  const [mounted, setMounted] = useState<readonly MediaChip[]>(() => [chip]);
  if (!mounted.includes(chip)) setMounted([...mounted, chip]);

  /* ---- browse / results, per chip (the shared filters, held while hidden) ---- */
  const movieResults = useMovieResults(chip === "movies" && isFocused);
  const seriesResults = useSeriesResults(chip === "series" && isFocused);
  const categoriesQuery = useCategories();
  const movieCategoryId = movieResults.filters.categoryId;
  const seriesCategoryId = seriesResults.categoryId;
  /** A picked category's name for the chip row — "Category" until the list is known. */
  const categoryNameOf = useCallback(
    (id: string | null) =>
      id ? (categoriesQuery.data?.find((category) => category.id === id)?.name ?? t.browse.categoryOverline) : null,
    [categoriesQuery.data, t],
  );
  const movieCategoryName = useMemo(() => categoryNameOf(movieCategoryId), [categoryNameOf, movieCategoryId]);
  const seriesCategoryName = useMemo(() => categoryNameOf(seriesCategoryId), [categoryNameOf, seriesCategoryId]);
  const closeMovieResults = movieResults.close;
  const closeSeriesResults = seriesResults.close;
  /** The Netflix chip row while Movies or Series shows its results. */
  const selection = useMemo<MediaChipsSelection | null>(() => {
    if (chip === "movies" && movieResults.showResults) {
      return {
        pick: selectionLabel(movieResults.filters.genres, movieCategoryName),
        onClear: closeMovieResults,
      };
    }
    if (chip === "series" && seriesResults.showResults) {
      return {
        pick: selectionLabel(seriesResults.filters.genres, seriesCategoryName),
        onClear: closeSeriesResults,
      };
    }
    return null;
  }, [
    chip,
    movieResults.showResults,
    movieResults.filters.genres,
    movieCategoryName,
    closeMovieResults,
    seriesResults.showResults,
    seriesResults.filters.genres,
    seriesCategoryName,
    closeSeriesResults,
  ]);

  /**
   * Android's back on a Movies / Series results view returns to that chip's
   * browse, as Netflix's does — the chip row's ✕. Claimed only while the
   * Media root is focused and a results view is showing; otherwise the
   * navigator has it. The Categories overlay and the Sort & filter sheet are
   * Modals and close themselves on back before this ever hears it.
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
   * often does not. After a pick the chip row may have swapped (browse →
   * results), and the ref then holds the new row's chip, which is the one
   * that reopens the pop-up. A quick reopen cancels the pending move.
   */
  const categoriesChipRef = useRef<View>(null);
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
   * that never opens it asks for nothing, and each kind's list only asks for
   * its own data while its segment shows.
   */
  const [overlayUsed, setOverlayUsed] = useState(false);
  if (overlayOpen && !overlayUsed) setOverlayUsed(true);
  /** It opens on the chip showing; Music has no categories, so there it opens on Movies. */
  const overlayKind: CategoryKind = chip === "series" ? "series" : chip === "books" ? "books" : "movies";
  /** The name highlighted per kind — only for the chip the user is looking at. */
  const overlaySelected = useMemo<Record<CategoryKind, string | null>>(
    () => ({
      movies:
        chip === "movies"
          ? categorySelectionKey(movieResults.filters.genres, movieCategoryId, movieResults.showResults)
          : null,
      series:
        chip === "series"
          ? categorySelectionKey(seriesResults.filters.genres, seriesCategoryId, seriesResults.showResults)
          : null,
      books: chip === "books" ? bookCategorySelectionKey(bookCategory) : null,
    }),
    [
      chip,
      movieResults.filters.genres,
      movieCategoryId,
      movieResults.showResults,
      seriesResults.filters.genres,
      seriesCategoryId,
      seriesResults.showResults,
      bookCategory,
    ],
  );
  const openMovieResults = movieResults.open;
  const openSeriesResults = seriesResults.open;
  /** A pick opens (or switches) the results view; the refinements already chosen stay. */
  const pickMovies = useCallback(
    (pick: CategoryPick) =>
      openMovieResults((f) => ({
        ...f,
        genres: pick.kind === "genre" ? [pick.genre] : [],
        categoryId: pick.kind === "category" ? pick.id : null,
      })),
    [openMovieResults],
  );
  /** The same for Series — its category is kept beside the shared filters, never sent (useSeriesResults). */
  const pickSeries = useCallback(
    (pick: CategoryPick) =>
      openSeriesResults(
        (f) => ({ ...f, genres: pick.kind === "genre" ? [pick.genre] : [] }),
        pick.kind === "category" ? pick.id : null,
      ),
    [openSeriesResults],
  );
  /** A pick for any kind: that kind's chip, then its genre / category. */
  const pickCategory = useCallback(
    (kind: CategoryKind, pick: CategoryPick) => {
      setChip(kind);
      if (kind === "movies") pickMovies(pick);
      else if (kind === "series") pickSeries(pick);
      else {
        setBookCategory(pick.kind === "category" ? pick.id : "");
        setBookPickSeq((n) => n + 1);
      }
    },
    [pickMovies, pickSeries],
  );
  /**
   * A guest's "Sign in" in the Books segment. Today it cannot be reached: a
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
  const openSearch = useCallback(
    () => navigation.navigate("MediaSearch", { scope: chip === "music" ? "all" : chip }),
    [navigation, chip],
  );
  const openCategories = useCallback(() => setOverlayOpen(true), []);

  return (
    <View style={styles.container}>
      <HubChromeContext.Provider value={chromeHeight}>
        <GlassTarget targetRef={blurTargetRef}>
          {mounted.map((kind) => {
            // On screen AND the Media root focused: a page under a pushed
            // screen (the search screen, a title, the filters page) holds its
            // hero pager and its "All …" filters still, like a hidden chip.
            const active = chip === kind && isFocused;
            return (
              <ChipLayer key={kind} visible={chip === kind}>
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

      {/* Frosted glass behind the bar and chips (the owner's choice, 2026-10-02):
          transparent at the top, then the page blurred under a 40% dark tint as
          it scrolls — never solid. Rendered after the body, as expo-blur needs
          for scrolling content. */}
      <GlassBarBackground scrollY={activeScrollY} height={chromeHeight} blurTarget={blurTargetRef} />
      <AppTopBar
        transparent
        touchThrough
        heading={t.nav.media}
        onLayout={onChromeLayout}
        trailing={
          <AppBarAction icon="search" overlay onPress={openSearch} accessibilityLabel={t.browse.searchA11y} />
        }
      >
        {/* 7pt under the chips (the owner, 2026-10-02): part of the measured bar,
            so the glass reaches below the chips and the pages clear it too. */}
        <View style={styles.chipsPad} pointerEvents="box-none">
          <MediaChips
            value={chip}
            onChange={setChip}
            onCategories={openCategories}
            categoriesRef={categoriesChipRef}
            selection={selection}
          />
        </View>
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
  /** The bar's bottom padding under the chip row. */
  chipsPad: { paddingBottom: 7 },
  /** A mounted page that is not the one showing — see ChipLayer. */
  hiddenLayer: { opacity: 0 },
});
