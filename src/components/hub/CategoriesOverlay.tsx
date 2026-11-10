import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  AccessibilityInfo,
  Modal,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type ViewInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, SlideInDown, useReducedMotion } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { useQueries } from "@tanstack/react-query";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/common/Skeleton";
import { AppBarAction } from "@/components/layout/AppBar";
import { useControlBlur } from "@/components/layout/GlassFace";
import { hasMyanmar } from "@/components/hub/hubLayout";
import {
  AllCategoriesTile,
  CategoryTile,
  TILE_RADIUS,
  categoryCountLabel,
  genreIcon,
  isTileSelected,
  type CategoryTileItem,
  type CategoryTileSize,
} from "@/components/hub/CategoryTile";
import { useMovieFacets, useMoviesInfinite } from "@/hooks/useMovies";
import { useSeriesFacets, useSeriesInfinite } from "@/hooks/useSeries";
import { booksKey, useBooksInfinite } from "@/hooks/useBooks";
import { useCategories } from "@/hooks/useCategories";
import { useBookCategories } from "@/hooks/useBookCategories";
import { LIST_PAGE_SIZE } from "@/hooks/pagination";
import { useLanguage } from "@/localization/LanguageProvider";
import type { TranslationShape } from "@/localization/translations";
import { mediaTypeLabel } from "@/utils/mediaType";
import { seriesService } from "@/services/series.service";
import { booksService } from "@/services/books.service";
import { theme } from "@/theme";
import type { BookCategory } from "@/api/bookCategories.api";
import type { Category } from "@/types/category";
import type { FacetValue } from "@/types/movie";

/** The three kinds the pop-up can show — always the section it was opened from. */
export type CategoryKind = "movies" | "series" | "books";

/**
 * What a pick in the pop-up asks the Media page to show. Books only ever
 * sends "all" (every book) or "category" (one of the books' own shelves);
 * "type" (the movie's type word, sent as `countries`) is Movies only.
 */
export type CategoryPick =
  | { kind: "all" }
  | { kind: "genre"; genre: string }
  | { kind: "category"; id: string }
  | { kind: "type"; value: string }
  | { kind: "language"; value: string };

interface Props {
  visible: boolean;
  /**
   * Hides the pop-up. The caller sends screen-reader focus back to the
   * Categories button once it has faded out (Media.tsx) — Android's TalkBack
   * does not do that by itself.
   */
  onClose: () => void;
  /**
   * The one kind the pop-up shows — the section the user is looking at
   * (Movies, Series or Books; Movies from anywhere else). Read on every
   * opening, and nothing else is remembered between openings.
   */
  initialKind: CategoryKind;
  /**
   * The tile showing now, per kind (see categorySelectionKey) — ringed,
   * ticked and scrolled into view. Null for a kind the user is not looking
   * at, or when the view is a mix no single tile stands for.
   */
  selected: Record<CategoryKind, string | null>;
  /** A tile was picked: the pop-up has already closed. */
  onPick: (kind: CategoryKind, pick: CategoryPick) => void;
  /** Book categories are members-only: a guest's Books pop-up asks them to sign in instead. */
  signedIn: boolean;
  /** A guest's "Sign in" (the pop-up has already closed). */
  onSignIn: () => void;
}

/** After the Modal is up, so the screen reader's own first focus has landed before ours. */
const FOCUS_AFTER_SHOW_MS = 250;
/** The design's 20pt from the screen's sides to the title and the tiles (the ✕ sits 16pt in, as in every top bar). */
const SIDE_PADDING = 20;
/** The sheet's rise: iOS's own sheet curve, fast out of the gate and settling softly. */
const RISE_MS = 300;
const RISE_EASING = Easing.bezier(0.22, 1, 0.36, 1);
/**
 * The dim over the page. iOS blurs the page under a dark tint (Reduce
 * Transparency: no blur, the nearly solid tint instead); Android draws no
 * page blur inside a Modal, so it gets the nearly solid tint too.
 */
const BLUR_INTENSITY = 60;
const BLURRED_TINT = "rgba(8,8,11,0.78)";
const SOLID_TINT = "rgba(8,8,11,0.94)";
/** The heading over each run of tiles: 17pt bold, Burmese a little taller. */
const HEADING_LINE = 22;
const MYANMAR_LINE_BONUS = 6;
/**
 * The scroll position is rounded to this step before it is stored, so the
 * rows re-check whether they are near the screen a few times per screenful
 * rather than on every frame.
 */
const VIEWPORT_STEP = 50;
/** A row asks for its pictures from this far ahead (in screen heights) — below, and behind. */
const NEAR_AHEAD = 1.5;
const NEAR_BEHIND = 0.5;

/**
 * The tile to tick for Movies and Series (the Media page's view → a tile
 * key), in this order: the category; one genre (and no type); one movie type
 * (and no genre); the Language tile's pick (`languagePick` — the results
 * hook's, movieLanguagePick: a language set in Sort & filter is a refinement
 * and ticks nothing); "all" when nothing is picked (the browse view, or an
 * unnarrowed results view — "All …" is picked when nothing is); null for a
 * mix no single tile stands for (two genres from the filters page, a genre
 * and a type).
 */
export function categorySelectionKey({
  genres,
  categoryId,
  countries = [],
  languagePick = null,
}: {
  genres: readonly string[];
  categoryId: string | null | undefined;
  countries?: readonly string[];
  languagePick?: string | null;
}): string | null {
  if (categoryId) return `category:${categoryId}`;
  if (genres.length === 1 && countries.length === 0) return `genre:${genres[0]}`;
  if (countries.length === 1 && genres.length === 0) return `type:${countries[0]}`;
  if (genres.length > 0 || countries.length > 0) return null;
  return languagePick ? `language:${languagePick}` : "all";
}

/**
 * The selected tile's key for Books: the book category the All books grid
 * shows, or "All books" when it shows every category. Books has no separate
 * results view — its All books grid is always on the page — so on the Books
 * hub one of its tiles is always the one showing.
 */
export function bookCategorySelectionKey(categoryId: string | null | undefined): string {
  return categoryId ? `category:${categoryId}` : "all";
}

/**
 * Where the list is scrolled to and how tall it is — the rows read it to
 * decide whether they are near enough to the screen to ask for their
 * pictures. A context, so a scroll re-renders only the rows, never the
 * lists that build them.
 */
const ViewportContext = createContext({ top: 0, height: 0 });

/**
 * The Categories pop-up (CatSheet.dc.html, "Colour tiles" — the owner's
 * pick, 2026-11-10: "build 1 but i want Action show image that we do on the
 * browse categories. we don't need search categories search field"). It
 * rises as a sheet over the page, which dims (blurred on iOS); its title
 * ("Movies categories") stands top left and a round glass ✕ top right. Under
 * them, scrolling: a wide "All movies" tile, then the section's tiles in two
 * columns under bold headings — Movies: Genres (the admin categories and the
 * catalogue's genres as ONE list, each name once), Movie type and Language;
 * Series: Genres and Language; Books: the books' own categories. Every tile
 * shows its count, and the Genres tiles (and the Series and Books ones) show
 * their newest title's picture, as Browse's category tiles do. The tile
 * showing now is ringed and ticked. Picking one closes the pop-up and the
 * Media page shows it.
 *
 * It shows only the section the user is looking at (Movies from Music) —
 * the owner, 2026-11-10: "if I select Movie and click Categories I want
 * categories just for movies"; the Media hub already chooses the section.
 *
 * Full screen over everything, the dock included (a Modal); Android's back
 * closes it. It fades in while the sheet slides up — no slide under reduce
 * motion, and no fade either. It is a modal for screen readers, every tile a
 * button spoken with its name, count and selected state, 44pt and up, and
 * names wrap rather than clip at 320pt, 2× text or in Burmese. As it opens a
 * screen reader is told what it is ("Movies categories" — a label on a plain
 * container is not read by VoiceOver, so it is announced) and its focus goes
 * to the tile showing now.
 *
 * Only the section's own list asks for its data, so an opening on Movies
 * never asks for the series genres or the book categories — and a guest
 * never asks for the book categories. A tile asks for its picture only once
 * its row comes near the screen, from React Query's cache when Browse or an
 * earlier opening already asked, and never for a tile known to be empty.
 */
export function CategoriesOverlay({ visible, onClose, initialKind, selected, onPick, signedIn, onSignIn }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const blur = useControlBlur();
  const scrollRef = useRef<ScrollViewInstance>(null);

  /** Where the list is scrolled to, rounded (see VIEWPORT_STEP), and its height — the window's until measured. */
  const [viewport, setViewport] = useState(() => ({ top: 0, height: windowHeight }));

  /**
   * The kind showing. Set to `initialKind` on every opening (React's "adjust
   * state while rendering", so the first frame is already right) and left
   * alone while it fades out after a pick, so the list does not change under
   * the fade if the section changes behind it. Every opening also starts at
   * the top of the list.
   */
  const [kind, setKind] = useState<CategoryKind>(initialKind);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setKind(initialKind);
      if (viewport.top !== 0) setViewport({ ...viewport, top: 0 });
    }
  }

  const kindLabel = useCallback(
    (k: CategoryKind) => (k === "movies" ? t.search.movies : k === "series" ? t.search.series : t.search.books),
    [t],
  );
  const overlayLabel = useCallback(
    (k: CategoryKind) => t.hub.categoriesOverlayA11y.replace("{type}", kindLabel(k)),
    [t, kindLabel],
  );

  /**
   * Scrolled to the selected tile once per opening, as soon as its row has
   * been laid out (the lists may land while the pop-up is already open).
   * Re-armed on close, so it is ready before the next opening's first layout.
   */
  const centred = useRef(false);
  useEffect(() => {
    if (!visible) centred.current = false;
  }, [visible]);
  /** The list's own height (it starts under the title) — the window's until measured. */
  const listHeight = useRef(windowHeight);
  const onListLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    listHeight.current = height;
    setViewport((prev) => (prev.height === height ? prev : { ...prev, height }));
  }, []);
  const onSelectedLayout = useCallback((event: LayoutChangeEvent) => {
    if (centred.current) return;
    centred.current = true;
    const { y, height: rowHeight } = event.nativeEvent.layout;
    const target = Math.max(0, y - listHeight.current / 2 + rowHeight / 2);
    scrollRef.current?.scrollTo({ y: target, animated: false });
    // Not every platform reports a scroll for scrollTo: the rows around the
    // selected one learn where the list now stands from here.
    const top = Math.round(target / VIEWPORT_STEP) * VIEWPORT_STEP;
    setViewport((prev) => (prev.top === top ? prev : { ...prev, top }));
  }, []);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const top = Math.round(event.nativeEvent.contentOffset.y / VIEWPORT_STEP) * VIEWPORT_STEP;
    setViewport((prev) => (prev.top === top ? prev : { ...prev, top }));
  }, []);

  /**
   * Once the pop-up is up: focus on the tile showing now (when there is
   * one — otherwise the reader starts at the top), then the pop-up's name,
   * queued behind what that focus reads.
   */
  const selectedRef = useRef<ViewInstance>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const onShow = useCallback(() => {
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => {
      focusTimer.current = null;
      if (selectedRef.current) AccessibilityInfo.sendAccessibilityEvent(selectedRef.current, "focus");
      AccessibilityInfo.announceForAccessibilityWithOptions(overlayLabel(kindRef.current), { queue: true });
    }, FOCUS_AFTER_SHOW_MS);
  }, [overlayLabel]);
  // A close (or unmount) before the timer fires drops it.
  useEffect(
    () => () => {
      if (focusTimer.current) clearTimeout(focusTimer.current);
      focusTimer.current = null;
    },
    [visible],
  );

  /** A pick closes the pop-up first, then hands the kind and the pick to the Media page. */
  const pick = useCallback(
    (pickKind: CategoryKind, next: CategoryPick) => {
      onClose();
      onPick(pickKind, next);
    },
    [onClose, onPick],
  );
  const signIn = useCallback(() => {
    onClose();
    onSignIn();
  }, [onClose, onSignIn]);

  // One object per change of its parts, so a scroll (which only re-renders
  // the rows, through ViewportContext) never rebuilds a list.
  const selectedKey = selected[kind];
  const listProps = useMemo<ListProps>(
    () => ({ selectedKey, selectedRef, onSelectedLayout, pick }),
    [selectedKey, onSelectedLayout, pick],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={onClose}
      onShow={onShow}
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={["portrait", "portrait-upside-down", "landscape", "landscape-left", "landscape-right"]}
    >
      <View style={styles.root} accessibilityViewIsModal>
        {/* The page under the sheet, dimmed (and blurred on iOS). Decoration only. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
          {blur ? <BlurView intensity={BLUR_INTENSITY} tint="dark" style={StyleSheet.absoluteFill} /> : null}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: blur ? BLURRED_TINT : SOLID_TINT }]} />
        </View>

        <Animated.View
          style={styles.sheet}
          entering={reduceMotion ? undefined : SlideInDown.duration(RISE_MS).easing(RISE_EASING)}
        >
          {/* The title and the glass ✕ stay put; only the tiles below scroll. No search field (the owner, 2026-11-10). */}
          <View
            style={[
              styles.header,
              {
                paddingTop: insets.top + theme.spacing.sm,
                paddingLeft: insets.left + SIDE_PADDING,
                paddingRight: insets.right + theme.layout.screenPadding,
              },
            ]}
          >
            <ThemedText variant="title" accessibilityRole="header" style={styles.title}>
              {overlayLabel(kind)}
            </ThemedText>
            <AppBarAction icon="close" onPress={onClose} accessibilityLabel={t.common.close} />
          </View>

          <ViewportContext.Provider value={viewport}>
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              onLayout={onListLayout}
              onScroll={onScroll}
              scrollEventThrottle={100}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingTop: 18,
                paddingBottom: insets.bottom + theme.spacing.lg,
                paddingLeft: insets.left + SIDE_PADDING,
                paddingRight: insets.right + SIDE_PADDING,
              }}
            >
              {/* Keyed by kind: an opening on another section mounts that list fresh. */}
              {kind === "movies" ? (
                <MoviesList key="movies" {...listProps} />
              ) : kind === "series" ? (
                <SeriesList key="series" {...listProps} />
              ) : signedIn ? (
                <BooksList key="books" {...listProps} signedIn={signedIn} />
              ) : (
                <BooksSignedOut key="books-guest" onSignIn={signIn} />
              )}
            </ScrollView>
          </ViewportContext.Provider>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* The three kinds' lists.                                             */
/* ------------------------------------------------------------------ */

/** What every kind's list gets from the pop-up. */
interface ListProps {
  selectedKey: string | null;
  selectedRef: RefObject<ViewInstance | null>;
  onSelectedLayout: (event: LayoutChangeEvent) => void;
  pick: (kind: CategoryKind, next: CategoryPick) => void;
}

/** One run of tiles under its heading. */
interface TileSection {
  key: string;
  title: string;
  size: CategoryTileSize;
  items: CategoryTileItem[];
}

/** Names compared the way people read them: case, spaces and Unicode spelling aside. */
function sameName(name: string): string {
  return name.normalize("NFC").toLowerCase().replace(/\s+/g, "");
}

const byCountThenName = (a: CategoryTileItem, b: CategoryTileItem) =>
  (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label);

/** A tile under construction — `altKeys` is filled in as same-named genres are folded into it. */
type DraftItem = CategoryTileItem & { altKeys: string[] };

/** One facet value per name (mergeFacets). */
interface MergedFacet {
  /** The spelling with the most titles: the tile's name and what its pick sends. */
  value: string;
  /** What that pick really opens (see mergeFacets). */
  count: number;
  /** The other spellings of the same name — their views still tick the tile. */
  others: string[];
}

/**
 * A facet's values with each name ONCE: spellings that differ only in case,
 * spaces or Unicode form ("Thriller" / "thriller") become one tile, named by
 * the spelling with the most titles. The server matches one picked value
 * regardless of case, so the count adds up the case-only twins; a spelling
 * that differs in its spaces is not matched by that pick, so it is folded
 * into the tile (and ticks it) but not counted. Values with no titles, and
 * blank ones, are left out.
 */
function mergeFacets(facets: readonly FacetValue[] | undefined): MergedFacet[] {
  const groups = new Map<string, FacetValue[]>();
  for (const facet of facets ?? []) {
    if (facet.count <= 0 || !facet.value.trim()) continue;
    const name = sameName(facet.value);
    const group = groups.get(name);
    if (group) group.push(facet);
    else groups.set(name, [facet]);
  }
  return [...groups.values()].map((group) => {
    const main = group.reduce((best, facet) => (facet.count > best.count ? facet : best));
    const lower = main.value.toLowerCase();
    return {
      value: main.value,
      count: group.reduce((sum, facet) => sum + (facet.value.toLowerCase() === lower ? facet.count : 0), 0),
      others: group.filter((facet) => facet !== main).map((facet) => facet.value),
    };
  });
}

/** A genre's tile (Movies or Series): its picture is its newest title of that genre. */
function genreItem(genre: MergedFacet, kind: "movies" | "series"): DraftItem {
  return {
    key: `genre:${genre.value}`,
    altKeys: genre.others.map((other) => `genre:${other}`),
    label: genre.value,
    count: genre.count,
    pick: { kind: "genre", genre: genre.value },
    icon: genreIcon(genre.value, kind),
    art: kind === "movies" ? { from: "movies", genre: genre.value } : { from: "series", genre: genre.value },
  };
}

/**
 * Movies' Genres: ONE list, each name once. The admin categories (GET
 * /categories) are the main list; each genre the catalogue holds (GET
 * /movies/facets) joins it unless a category already has its name (case and
 * spaces aside) — that category then also stands for the genre (altKeys), so
 * a genre shelf's See all still ticks it. Two categories with the same name
 * are one tile too: the one with more movies, standing for the other. A
 * category picks the category, a genre the genre, as before. Counts: the
 * category's movieCount, the genre's facet count; nothing with no movies is
 * listed. Most movies first.
 */
function movieGenreItems(categories: readonly Category[] | undefined, genres: readonly FacetValue[] | undefined) {
  const items: DraftItem[] = [];
  const byName = new Map<string, DraftItem>();
  const fullest = (categories ?? [])
    .filter((category) => category.movieCount > 0)
    .sort((a, b) => b.movieCount - a.movieCount);
  for (const category of fullest) {
    const name = sameName(category.name);
    const twin = byName.get(name);
    if (twin) {
      twin.altKeys.push(`category:${category.id}`);
      continue;
    }
    const item: DraftItem = {
      key: `category:${category.id}`,
      altKeys: [],
      label: category.name,
      count: category.movieCount,
      pick: { kind: "category", id: category.id },
      icon: genreIcon(category.name, "movies"),
      art: { from: "movies", categoryId: category.id },
    };
    items.push(item);
    byName.set(name, item);
  }
  for (const genre of mergeFacets(genres)) {
    const owner = byName.get(sameName(genre.value));
    if (owner) {
      owner.altKeys.push(`genre:${genre.value}`, ...genre.others.map((other) => `genre:${other}`));
      continue;
    }
    items.push(genreItem(genre, "movies"));
  }
  return items.sort(byCountThenName);
}

/**
 * Series' Genres, by the Movies rule: the genres the series catalogue holds
 * (GET /series/facets, most series first) and the admin categories, each
 * name once. A category that shares a genre's name takes that genre's place
 * (and stands for it, altKeys), so the category stays reachable; the other
 * categories follow, by name. Nothing gives a per-category series count, so
 * a category's count is its picture request's `total` (`totals`, learned as
 * its row nears the screen and kept in React Query's cache): until then it
 * shows no count, and once that says 0 the category is left out (a genre of
 * its name gets its own tile back).
 */
function seriesGenreItems(
  categories: readonly Category[] | undefined,
  genres: readonly FacetValue[] | undefined,
  totals: ReadonlyMap<string, number>,
) {
  const items: DraftItem[] = mergeFacets(genres)
    .map((genre) => genreItem(genre, "series"))
    .sort(byCountThenName);
  const genreByName = new Map(items.map((item) => [sameName(item.label), item]));
  const categoryByName = new Map<string, DraftItem>();
  const extra: DraftItem[] = [];
  for (const category of categories ?? []) {
    const total = totals.get(category.id);
    if (total === 0) continue;
    const name = sameName(category.name);
    const twin = categoryByName.get(name);
    if (twin) {
      twin.altKeys.push(`category:${category.id}`);
      continue;
    }
    const item: DraftItem = {
      key: `category:${category.id}`,
      altKeys: [],
      label: category.name,
      count: total ?? null,
      pick: { kind: "category", id: category.id },
      icon: genreIcon(category.name, "series"),
      art: { from: "series", categoryId: category.id },
    };
    categoryByName.set(name, item);
    const genre = genreByName.get(name);
    if (genre) {
      item.altKeys.push(genre.key, ...genre.altKeys);
      items[items.indexOf(genre)] = item;
    } else {
      extra.push(item);
    }
  }
  extra.sort((a, b) => a.label.localeCompare(b.label));
  return [...items, ...extra];
}

/** The facet's values that have titles, as tiles (each name once, mergeFacets): colour and icon, no picture. Most titles first. */
function facetItems(
  facets: readonly FacetValue[] | undefined,
  prefix: "type" | "language",
  label: (value: string) => string | null,
): CategoryTileItem[] {
  const items: CategoryTileItem[] = [];
  for (const facet of mergeFacets(facets)) {
    const name = label(facet.value);
    if (!name) continue;
    items.push({
      key: `${prefix}:${facet.value}`,
      altKeys: facet.others.map((other) => `${prefix}:${other}`),
      label: name,
      count: facet.count,
      pick: prefix === "type" ? { kind: "type", value: facet.value } : { kind: "language", value: facet.value },
      icon: prefix === "type" ? "flag-outline" : "language-outline",
    });
  }
  return items.sort(byCountThenName);
}

/** Each answer's total, in order; null while nobody has asked. Structurally shared by React Query, so equal totals keep the array. */
function totalsOf(results: readonly { data?: { total: number } }[]): (number | null)[] {
  return results.map((result) => result.data?.total ?? null);
}

/** Shared empty map, so a list with no categories never hands a memo a fresh one. */
const NO_TOTALS: ReadonlyMap<string, number> = new Map();

/**
 * What the tiles' own picture requests (GET /series or /books?categoryId=&limit=1)
 * have said so far about each category: its `total`, by category id — absent
 * while unknown. Read from React Query's cache under the tiles' very keys and
 * never asked from here (`enabled: false`), so it costs no request and is
 * already known on the next opening; a list re-renders as each answer lands.
 */
function useCategoryTotals(from: "series" | "books", ids: readonly string[]): ReadonlyMap<string, number> {
  const totals = useQueries({
    queries: ids.map((categoryId) => {
      const query = { categoryId, limit: 1 };
      return {
        queryKey: from === "series" ? ["series", query] : booksKey(query),
        queryFn: ({ signal }: { signal: AbortSignal }): Promise<{ total: number }> =>
          from === "series" ? seriesService.getSeries(query, { signal }) : booksService.getBooks(query, { signal }),
        enabled: false,
      };
    }),
    combine: totalsOf,
  });
  return useMemo(() => {
    if (ids.length === 0) return NO_TOTALS;
    const map = new Map<string, number>();
    ids.forEach((id, index) => {
      const total = totals[index];
      if (total !== null && total !== undefined) map.set(id, total);
    });
    return map;
  }, [ids, totals]);
}

/** Movies' and Series' two lists: either one is enough to pick from, so only both missing is a failure. */
function useFacetsAndCategories(facetsQuery: {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}) {
  const categoriesQuery = useCategories();
  const loading = (facetsQuery.isLoading || categoriesQuery.isLoading) && !facetsQuery.data && !categoriesQuery.data;
  const failed = !facetsQuery.data && !categoriesQuery.data && (facetsQuery.isError || categoriesQuery.isError) && !loading;
  const refetchFacets = facetsQuery.refetch;
  const refetchCategories = categoriesQuery.refetch;
  const retry = useCallback(() => {
    void refetchFacets();
    void refetchCategories();
  }, [refetchFacets, refetchCategories]);
  return { categories: categoriesQuery.data, loading, failed, retry };
}

/** "312 movies" on the All tile — only when the hub's own newest page (the same key) is already in hand. */
function allCountLabel(t: TranslationShape, kind: CategoryKind, total: number | undefined): string | null {
  return total === undefined ? null : categoryCountLabel(t, kind, total);
}

/**
 * Movies: "All movies", then Genres (the admin categories and the catalogue's
 * genres, one list — movieGenreItems), Movie type (the type words in the
 * movie's `country` field, GET /movies/facets `countries`, sent as
 * `countries`) and Language (the facet `languages`, sent as `languages`).
 */
const MoviesList = memo(function MoviesList(props: ListProps) {
  const { t } = useLanguage();
  const facetsQuery = useMovieFacets();
  const lists = useFacetsAndCategories(facetsQuery);
  // The Movies hub's own first page (its hero and Recently added) — read,
  // never asked for: `enabled: false` still returns what the cache holds.
  const newest = useMoviesInfinite({ limit: LIST_PAGE_SIZE }, { enabled: false });
  const sections = useMemo<TileSection[]>(
    () => [
      { key: "genres", title: t.hub.genresHeading, size: "tall", items: movieGenreItems(lists.categories, facetsQuery.data?.genres) },
      {
        key: "types",
        title: t.hub.movieTypeHeading,
        size: "short",
        // "Other" and blank say nothing about a movie, so they are no tile.
        items: facetItems(facetsQuery.data?.countries, "type", (value) => mediaTypeLabel(t, value, "movie")),
      },
      {
        key: "languages",
        title: t.search.filterLanguage,
        size: "short",
        items: facetItems(facetsQuery.data?.languages, "language", (value) => value.trim() || null),
      },
    ],
    [t, lists.categories, facetsQuery.data],
  );
  return (
    <TileList
      {...props}
      kind="movies"
      allLabel={t.hub.allMovies}
      allCount={allCountLabel(t, "movies", newest.data?.pages[0]?.total)}
      sections={sections}
      loading={lists.loading}
      failed={lists.failed}
      onRetry={lists.retry}
    />
  );
});

/**
 * Series: "All series", then Genres (the series genres and the admin
 * categories, one list — seriesGenreItems; a category is sent as
 * GET /series?categoryId=, and one its own request finds empty is left out)
 * and Language (GET /series/facets `languages`).
 * No Movie type: GET /series has no type filter and no type facet.
 */
const SeriesList = memo(function SeriesList(props: ListProps) {
  const { t } = useLanguage();
  const facetsQuery = useSeriesFacets();
  const lists = useFacetsAndCategories(facetsQuery);
  // The Series hub's own first page — read, never asked for (see MoviesList).
  const newest = useSeriesInfinite({ limit: LIST_PAGE_SIZE }, { enabled: false });
  const categoryIds = useMemo(() => (lists.categories ?? []).map((category) => category.id), [lists.categories]);
  const totals = useCategoryTotals("series", categoryIds);
  const sections = useMemo<TileSection[]>(
    () => [
      {
        key: "genres",
        title: t.hub.genresHeading,
        size: "tall",
        items: seriesGenreItems(lists.categories, facetsQuery.data?.genres, totals),
      },
      {
        key: "languages",
        title: t.search.filterLanguage,
        size: "short",
        items: facetItems(facetsQuery.data?.languages, "language", (value) => value.trim() || null),
      },
    ],
    [t, lists.categories, facetsQuery.data, totals],
  );
  return (
    <TileList
      {...props}
      kind="series"
      allLabel={t.hubs.series.allSeries}
      allCount={allCountLabel(t, "series", newest.data?.pages[0]?.total)}
      sections={sections}
      loading={lists.loading}
      failed={lists.failed}
      onRetry={lists.retry}
    />
  );
});

/** Shared empty list, so an unloaded query never hands the memo a fresh `[]`. */
const NO_BOOK_CATEGORIES: BookCategory[] = [];

/**
 * Books (signed in only): "All books", then the books' OWN categories (GET
 * /book-categories — not the movie categories) that hold a book, most books
 * first, each with its newest cover. A pick shows the Books hub's All books
 * grid on that category, the same as a category shelf's "See all".
 *
 * The count under each is the answer to its picture's request (GET
 * /books?categoryId=&limit=1, its `total`): the list's own bookCount also
 * counts books nobody can read yet. Until it lands, no count line; once it
 * says 0 (only unpublished books), the category is left out.
 *
 * The pop-up already shows a guest the sign-in prompt in its place; the
 * queries' own `enabled` is a second lock, so this list can never ask a
 * members-only endpoint for a guest even if it is reused elsewhere.
 */
const BooksList = memo(function BooksList({ signedIn, ...props }: ListProps & { signedIn: boolean }) {
  const { t } = useLanguage();
  const categoriesQuery = useBookCategories({ enabled: signedIn });
  const categories = categoriesQuery.data ?? NO_BOOK_CATEGORIES;
  // The Books hub's own first page — read, never asked for (see MoviesList).
  const newest = useBooksInfinite({ limit: LIST_PAGE_SIZE }, { enabled: false });
  const withBooks = useMemo(
    () =>
      categories
        .filter((category) => category.bookCount > 0)
        .sort((a, b) => b.bookCount - a.bookCount || a.name.localeCompare(b.name)),
    [categories],
  );
  const categoryIds = useMemo(() => withBooks.map((category) => category.id), [withBooks]);
  // Each tile's own answer — a category whose books are all unpublished says 0, and goes.
  const totals = useCategoryTotals("books", categoryIds);
  const sections = useMemo<TileSection[]>(
    () => [
      {
        key: "categories",
        title: t.browse.title,
        size: "tall",
        items: withBooks
          .filter((category) => totals.get(category.id) !== 0)
          .map((category) => ({
            key: `category:${category.id}`,
            label: category.name,
            count: totals.get(category.id) ?? null,
            pick: { kind: "category", id: category.id },
            icon: genreIcon(category.name, "books"),
            art: { from: "books", categoryId: category.id },
          })),
      },
    ],
    [withBooks, totals, t],
  );
  const refetch = categoriesQuery.refetch;
  const retry = useCallback(() => void refetch(), [refetch]);
  return (
    <TileList
      {...props}
      kind="books"
      allLabel={t.books.allBooks}
      allCount={signedIn ? allCountLabel(t, "books", newest.data?.pages[0]?.total) : null}
      sections={sections}
      loading={signedIn && categoriesQuery.isLoading}
      failed={signedIn && categoriesQuery.isError && !categoriesQuery.data}
      onRetry={retry}
      errorMessage={t.hubs.books.categoriesError}
      allowArt={signedIn}
    />
  );
});

/** A guest's Books pop-up: book categories are members-only, so a sign-in prompt instead of tiles. */
function BooksSignedOut({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={styles.message}>
      <Ionicons name="lock-closed-outline" size={28} color={theme.colors.textMuted} />
      <ThemedText variant="body" color={theme.colors.textMuted} style={styles.center}>
        {t.hub.booksCategoriesSignIn}
      </ThemedText>
      <Button title={t.hub.signIn} variant="play" onPress={onSignIn} labelLines={2} style={styles.retry} />
    </View>
  );
}

interface TileListProps extends ListProps {
  kind: CategoryKind;
  allLabel: string;
  allCount: string | null;
  sections: TileSection[];
  /** The lists are still on their way (skeleton tiles). */
  loading: boolean;
  /** They failed — a message and Retry. */
  failed: boolean;
  onRetry: () => void;
  errorMessage?: string;
  /** May the tiles ask for pictures at all (Books: signed in). */
  allowArt?: boolean;
}

/**
 * One kind's tiles: "All …" first (it needs no data, so it is there from the
 * first frame), then a skeleton, an error + Retry, or the sections — with a
 * quiet "No categories yet" when there are none.
 *
 * The "All …" tile, every heading and every ROW of two tiles are flat
 * children of the scroll's content (a component returning a fragment adds
 * no view), so a row's layout `y` is its offset in the list — what the
 * centring on the selected tile and the rows' "near the screen" test need.
 */
function TileList({
  kind,
  allLabel,
  allCount,
  sections,
  selectedKey,
  selectedRef,
  onSelectedLayout,
  pick,
  loading,
  failed,
  onRetry,
  errorMessage,
  allowArt = true,
}: TileListProps) {
  const { t } = useLanguage();
  const onPick = useCallback((next: CategoryPick) => pick(kind, next), [pick, kind]);
  const pickAll = useCallback(() => pick(kind, { kind: "all" }), [pick, kind]);
  const shown = sections.filter((section) => section.items.length > 0);

  let body;
  if (loading) {
    body = (
      <View style={styles.skeletons} accessible accessibilityRole="progressbar" accessibilityLabel={t.common.loading}>
        <Skeleton width={96} height={18} radius="sm" />
        {[0, 1, 2].map((row) => (
          <View key={row} style={styles.row}>
            <Skeleton width="auto" height={84} style={styles.skeletonTile} />
            <Skeleton width="auto" height={84} style={styles.skeletonTile} />
          </View>
        ))}
      </View>
    );
  } else if (failed) {
    body = (
      <View style={styles.message}>
        <Ionicons name="cloud-offline-outline" size={28} color={theme.colors.danger} />
        <ThemedText variant="body" color={theme.colors.textMuted} style={styles.center}>
          {errorMessage ?? t.hub.categoriesLoadError}
        </ThemedText>
        <Button title={t.common.retry} variant="secondary" onPress={onRetry} labelLines={2} style={styles.retry} />
      </View>
    );
  } else if (shown.length === 0) {
    body = (
      <ThemedText variant="body" color={theme.colors.textFaint} style={[styles.center, styles.emptyNote]}>
        {t.browse.empty}
      </ThemedText>
    );
  } else {
    body = shown.map((section) => (
      <SectionTiles
        key={section.key}
        section={section}
        kind={kind}
        selectedKey={selectedKey}
        selectedRef={selectedRef}
        onSelectedLayout={onSelectedLayout}
        onPick={onPick}
        allowArt={allowArt}
      />
    ));
  }

  return (
    <>
      <AllCategoriesTile
        label={allLabel}
        countLabel={allCount}
        selected={selectedKey === "all"}
        selectedRef={selectedRef}
        onPress={pickAll}
        onSelectedLayout={onSelectedLayout}
      />
      {body}
    </>
  );
}

interface SectionProps {
  section: TileSection;
  kind: CategoryKind;
  selectedKey: string | null;
  selectedRef: RefObject<ViewInstance | null>;
  onSelectedLayout: (event: LayoutChangeEvent) => void;
  onPick: (next: CategoryPick) => void;
  allowArt: boolean;
}

/** A heading and its rows of two — returned as a fragment, so each stays a direct child of the scroll content. */
function SectionTiles({ section, kind, selectedKey, selectedRef, onSelectedLayout, onPick, allowArt }: SectionProps) {
  const rows: CategoryTileItem[][] = [];
  for (let i = 0; i < section.items.length; i += 2) rows.push(section.items.slice(i, i + 2));
  return (
    <>
      <ThemedText
        weight="bold"
        color={theme.colors.text}
        accessibilityRole="header"
        style={[styles.heading, { lineHeight: HEADING_LINE + (hasMyanmar(section.title) ? MYANMAR_LINE_BONUS : 0) }]}
      >
        {section.title}
      </ThemedText>
      {rows.map((items, index) => (
        <TileRow
          key={items[0].key}
          items={items}
          first={index === 0}
          kind={kind}
          size={section.size}
          selectedKey={selectedKey}
          selectedRef={selectedRef}
          onSelectedLayout={onSelectedLayout}
          onPick={onPick}
          allowArt={allowArt}
        />
      ))}
    </>
  );
}

interface RowProps {
  items: CategoryTileItem[];
  first: boolean;
  kind: CategoryKind;
  size: CategoryTileSize;
  selectedKey: string | null;
  selectedRef: RefObject<ViewInstance | null>;
  onSelectedLayout: (event: LayoutChangeEvent) => void;
  onPick: (next: CategoryPick) => void;
  allowArt: boolean;
}

/**
 * Two tiles side by side (one and an empty half for an odd last tile). The
 * row knows where it sits in the list and reads where the list is scrolled
 * to (ViewportContext); once it comes within a screen and a half below — or
 * half a screen above — the screen, its tiles may ask for their pictures,
 * and they keep that for the rest of this opening. Every tile stays mounted
 * (a few dozen plain views), so the selected one is always there for the
 * centring and the screen reader's focus; only the requests wait.
 */
const TileRow = memo(function TileRow({
  items,
  first,
  kind,
  size,
  selectedKey,
  selectedRef,
  onSelectedLayout,
  onPick,
  allowArt,
}: RowProps) {
  const viewport = useContext(ViewportContext);
  const [box, setBox] = useState<{ y: number; height: number } | null>(null);
  const [armed, setArmed] = useState(false);
  const near =
    !!box &&
    box.y < viewport.top + viewport.height * NEAR_AHEAD &&
    box.y + box.height > viewport.top - viewport.height * NEAR_BEHIND;
  // React's "adjust state while rendering": latched in the same pass.
  if (near && !armed) setArmed(true);

  const holdsSelected = items.some((item) => isTileSelected(item, selectedKey));
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      setBox((prev) => (prev && prev.y === y && prev.height === height ? prev : { y, height }));
      if (holdsSelected) onSelectedLayout(event);
    },
    [holdsSelected, onSelectedLayout],
  );

  return (
    <View style={[styles.row, !first && styles.rowAfter]} onLayout={onLayout}>
      {items.map((item) => (
        <CategoryTile
          key={item.key}
          item={item}
          kind={kind}
          size={size}
          near={armed && allowArt}
          selected={isTileSelected(item, selectedKey)}
          selectedRef={selectedRef}
          onPick={onPick}
        />
      ))}
      {items.length === 1 ? <View style={styles.flex} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  sheet: { flex: 1 },
  flex: { flex: 1 },
  /** Design: the title left, the 44pt glass ✕ right, 12pt apart at the least. */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: theme.layout.minTouch,
  },
  title: { flexShrink: 1 },
  /** 14pt between the blocks, plus the design's 4pt above a heading. */
  heading: { fontSize: 17, marginTop: 18, marginBottom: 14 },
  row: { flexDirection: "row", gap: 12 },
  rowAfter: { marginTop: 12 },
  center: { textAlign: "center" },
  skeletons: { gap: 12, paddingTop: 18 },
  skeletonTile: { flex: 1, borderRadius: TILE_RADIUS },
  message: { alignItems: "center", gap: theme.spacing.md, paddingTop: theme.spacing.xxl },
  emptyNote: { marginTop: theme.spacing.lg },
  retry: { minWidth: 140 },
});
