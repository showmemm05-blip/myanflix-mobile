import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/common/Skeleton";
import { hasMyanmar } from "@/components/hub/hubLayout";
import { useMovieFacets } from "@/hooks/useMovies";
import { useSeriesFacets } from "@/hooks/useSeries";
import { useCategories } from "@/hooks/useCategories";
import { useBookCategories } from "@/hooks/useBookCategories";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { BookCategory } from "@/api/bookCategories.api";
import type { Category } from "@/types/category";
import type { FacetValue } from "@/types/movie";

/** The three kinds the pop-up's switch can show. */
export type CategoryKind = "movies" | "series" | "books";

/**
 * What a pick in the pop-up asks the Media page to show. Books only ever
 * sends "all" (every book) or "category" (one of the books' own shelves).
 */
export type CategoryPick = { kind: "all" } | { kind: "genre"; genre: string } | { kind: "category"; id: string };

/** One name in the list. */
interface OverlayItem {
  key: string;
  label: string;
  onPress: () => void;
}

/** A run of names under a quiet heading ("Genres", "Categories"); the first group may have none. */
interface OverlayGroup {
  key: string;
  title?: string;
  items: OverlayItem[];
}

interface Props {
  visible: boolean;
  /**
   * Hides the pop-up. The caller sends screen-reader focus back to the
   * Categories chip once it has faded out (Media.tsx) — Android's TalkBack
   * does not do that by itself.
   */
  onClose: () => void;
  /**
   * The kind the pop-up opens on — the hub the user is looking at (Movies,
   * Series or Books; Movies from anywhere else). Read on every opening, and
   * nothing else is remembered between openings.
   */
  initialKind: CategoryKind;
  /**
   * The name showing now, per kind (see categorySelectionKey) — drawn white
   * and bold and scrolled into view while its kind's segment is showing.
   * Null for a kind the user is not looking at.
   */
  selected: Record<CategoryKind, string | null>;
  /** A name was picked: the pop-up has already closed. */
  onPick: (kind: CategoryKind, pick: CategoryPick) => void;
  /** Book categories are members-only: a guest's Books segment asks them to sign in instead. */
  signedIn: boolean;
  /** A guest's "Sign in" (the pop-up has already closed). */
  onSignIn: () => void;
}

/** The round close button at the foot (Netflix's white ✕ disc). */
const CLOSE_SIZE = 56;
/** Air under the close button, above the safe-area inset. */
const CLOSE_BOTTOM = 24;
/** Names are big: 22/30, the selected one 24/32. */
const ITEM_SIZE = 22;
const ITEM_LINE = 30;
/** Burmese needs taller lines than Latin (ThemedText's rule, applied here because the size is our own). */
const MYANMAR_LINE_BONUS = 8;
/** After the Modal is up, so the screen reader's own first focus has landed before ours. */
const FOCUS_AFTER_SHOW_MS = 250;
/** The switch's order (the owner, 2026-10-07). */
const KINDS: readonly CategoryKind[] = ["movies", "series", "books"];

/**
 * The selected line's key for Movies and Series: the one genre or category
 * showing, or "All …" on an unnarrowed results view.
 */
export function categorySelectionKey(
  genres: readonly string[],
  categoryId: string | null | undefined,
  showingResults: boolean,
): string | null {
  if (categoryId) return `category:${categoryId}`;
  if (genres.length === 1) return `genre:${genres[0]}`;
  if (genres.length === 0 && showingResults) return "all";
  return null;
}

/**
 * The selected line's key for Books: the book category the All books grid
 * shows, or "All books" when it shows every category. Books has no separate
 * results view — its All books grid is always on the page — so on the Books
 * hub one of its lines is always the one showing.
 */
export function bookCategorySelectionKey(categoryId: string | null | undefined): string {
  return categoryId ? `category:${categoryId}` : "all";
}

/**
 * The Netflix "Categories" pop-up: the page dims to near-black, a small
 * "Categories" title and a Movies · Series · Books switch stand at the top,
 * and under them the chosen kind's names stand in one centred scrolling
 * column in big type, the one showing now white and bold, the rest grey — and
 * a round white ✕ at the foot closes it. Picking a name closes it and the
 * Media page shows that genre or category for the chosen kind.
 *
 * It opens on the kind the user is looking at (Movies from Music). The
 * switch swaps the list in place: the pop-up stays open, the list goes back
 * to the top, and a screen reader is told which list it now holds.
 *
 * Full screen over everything, the dock included (a Modal); Android's back
 * closes it. A plain fade in and out — none at all under reduce motion. It
 * is a modal for screen readers, every name and every segment a button with
 * its selected state, and names wrap rather than clip at 320pt, 2× text or
 * in Burmese. As it opens a screen reader is told what it is ("Movies
 * categories" — a label on a plain container is not read by VoiceOver, so it
 * is announced) and its focus goes to the name showing now.
 *
 * Each kind's list asks for its own data only while its segment is showing,
 * so an opening that never leaves Movies never asks for the series genres or
 * the book categories — and a guest never asks for the book categories.
 */
export function CategoriesOverlay({ visible, onClose, initialKind, selected, onPick, signedIn, onSignIn }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);

  /**
   * The kind showing. Set back to `initialKind` on every opening (React's
   * "adjust state while rendering", so the first frame is already right) and
   * left alone while it fades out after a pick.
   */
  const [kind, setKind] = useState<CategoryKind>(initialKind);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setKind(initialKind);
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
   * Scrolled to the selected name once per opening (and once per switch), as
   * soon as it has been laid out (the lists may land while the pop-up is
   * already open). Re-armed on close, so it is ready before the next
   * opening's first layout.
   */
  const centred = useRef(false);
  useEffect(() => {
    if (!visible) centred.current = false;
  }, [visible]);
  /** The list's own height (it starts under the title and the switch) — the window's until measured. */
  const listHeight = useRef(windowHeight);
  const onListLayout = useCallback((event: LayoutChangeEvent) => {
    listHeight.current = event.nativeEvent.layout.height;
  }, []);
  const onSelectedLayout = useCallback((event: LayoutChangeEvent) => {
    if (centred.current) return;
    centred.current = true;
    const { y, height: rowHeight } = event.nativeEvent.layout;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - listHeight.current / 2 + rowHeight / 2), animated: false });
  }, []);

  const footerSpace = CLOSE_SIZE + CLOSE_BOTTOM * 2 + insets.bottom;

  /**
   * Once the pop-up is up: focus on the name showing now (when there is
   * one — otherwise the reader starts at the top), then the pop-up's name,
   * queued behind what that focus reads.
   */
  const selectedRef = useRef<View>(null);
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

  /** The switch: the new kind's list from the top, the pop-up still open, and said aloud. */
  const switchTo = useCallback(
    (next: CategoryKind) => {
      if (next === kindRef.current) return;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      // Its selected name (if it holds the one showing now) is brought into view again.
      centred.current = false;
      setKind(next);
      AccessibilityInfo.announceForAccessibilityWithOptions(overlayLabel(next), { queue: true });
    },
    [overlayLabel],
  );

  /** A pick closes the pop-up first, then hands the kind and the name to the Media page. */
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

  const listProps: ListProps = {
    selectedKey: selected[kind],
    selectedRef,
    onSelectedLayout,
    pick,
  };

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
      <View style={styles.scrim} accessibilityViewIsModal>
        {/* The title and the switch stay put; only the names below scroll. */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + theme.spacing.lg,
              paddingLeft: insets.left + theme.spacing.xl,
              paddingRight: insets.right + theme.spacing.xl,
            },
          ]}
        >
          <ThemedText variant="section" accessibilityRole="header" style={styles.center}>
            {t.browse.title}
          </ThemedText>
          <View style={styles.segments}>
            {KINDS.map((k) => {
              const on = k === kind;
              return (
                <Pressable
                  key={k}
                  onPress={() => switchTo(k)}
                  accessibilityRole="button"
                  accessibilityLabel={kindLabel(k)}
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [
                    styles.segment,
                    { backgroundColor: on ? theme.colors.play : theme.colors.tonal },
                    pressed && !on && styles.pressed,
                  ]}
                >
                  <ThemedText
                    variant="muted"
                    weight={on ? "extrabold" : "bold"}
                    color={on ? theme.colors.onPlay : theme.colors.textMuted}
                    style={styles.center}
                  >
                    {kindLabel(k)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          onLayout={onListLayout}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.list,
            {
              paddingTop: theme.spacing.lg,
              paddingBottom: footerSpace + theme.spacing.lg,
              paddingLeft: insets.left + theme.spacing.xl,
              paddingRight: insets.right + theme.spacing.xl,
            },
          ]}
        >
          {/* Keyed by kind: a switch mounts the new kind's list fresh. */}
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

        {/* The round ✕ at the foot. The list keeps room for it below its last name. */}
        <View style={[styles.footer, { height: footerSpace }]} pointerEvents="box-none">
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
            style={({ pressed }) => [
              styles.close,
              { marginBottom: insets.bottom + CLOSE_BOTTOM },
              pressed && (reduceMotion ? styles.pressed : styles.closePressed),
            ]}
          >
            <Ionicons name="close" size={28} color={theme.colors.onPlay} />
          </Pressable>
        </View>
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
  selectedRef: RefObject<View | null>;
  onSelectedLayout: (event: LayoutChangeEvent) => void;
  pick: (kind: CategoryKind, next: CategoryPick) => void;
}

/**
 * The Movies and Series groups: "All …", the genres — the values that exist
 * in the catalogue (the facets, most titles first; there is no fixed genre
 * list anywhere in the system, so a genre with no titles cannot be named) —
 * then EVERY admin category, in GET /categories' own order (by name), whether
 * or not it holds a title yet (the owner, 2026-10-05). An empty one is drawn
 * like any other, with no "Empty" or count beside it: a tag would crowd the
 * centred column at 320pt, 2× text or in Burmese, Series has no per-category
 * count to show at all, and a pick says it honestly ("No series in Thriller
 * yet", with a way back to every title).
 */
function buildGroups(
  allLabel: string,
  genresTitle: string,
  categoriesTitle: string,
  genreFacets: readonly FacetValue[] | undefined,
  categories: readonly Category[] | undefined,
  pick: (next: CategoryPick) => void,
): OverlayGroup[] {
  return [
    { key: "all", items: [{ key: "all", label: allLabel, onPress: () => pick({ kind: "all" }) }] },
    {
      key: "genres",
      title: genresTitle,
      items: (genreFacets ?? []).map((facet) => ({
        key: `genre:${facet.value}`,
        label: facet.value,
        onPress: () => pick({ kind: "genre", genre: facet.value }),
      })),
    },
    {
      key: "categories",
      title: categoriesTitle,
      items: (categories ?? []).map((category) => ({
        key: `category:${category.id}`,
        label: category.name,
        onPress: () => pick({ kind: "category", id: category.id }),
      })),
    },
  ];
}

/** Movies' and Series' two lists: either one is enough to pick from, so only both missing is a failure. */
function useGenreAndCategoryLists(facetsQuery: {
  data: { genres?: FacetValue[] } | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}) {
  const categoriesQuery = useCategories();
  const loading = (facetsQuery.isLoading || categoriesQuery.isLoading) && !facetsQuery.data && !categoriesQuery.data;
  const failed = !facetsQuery.data && !categoriesQuery.data && (facetsQuery.isError || categoriesQuery.isError) && !loading;
  const empty = !(facetsQuery.data?.genres?.length ?? 0) && !(categoriesQuery.data?.length ?? 0);
  const refetchFacets = facetsQuery.refetch;
  const refetchCategories = categoriesQuery.refetch;
  const retry = useCallback(() => {
    void refetchFacets();
    void refetchCategories();
  }, [refetchFacets, refetchCategories]);
  return { categories: categoriesQuery.data, loading, failed, empty, retry };
}

/**
 * Movies: "All movies", then the genres (GET /movies/facets) and every admin
 * category (GET /categories — sent to GET /movies as categoryId).
 */
function MoviesList(props: ListProps) {
  const { t } = useLanguage();
  const facetsQuery = useMovieFacets();
  const lists = useGenreAndCategoryLists(facetsQuery);
  const { pick } = props;
  const groups = useMemo<OverlayGroup[]>(
    () =>
      buildGroups(t.hub.allMovies, t.hub.genresHeading, t.browse.title, facetsQuery.data?.genres, lists.categories, (next) =>
        pick("movies", next),
      ),
    [facetsQuery.data, lists.categories, pick, t],
  );
  return (
    <OverlayList {...props} groups={groups} loading={lists.loading} failed={lists.failed} empty={lists.empty} onRetry={lists.retry} />
  );
}

/**
 * Series: "All series", then the genres (GET /series/facets) and every admin
 * category. GET /series cannot filter by category, so a category pick is
 * applied on the client over the loaded pages (useSeriesResults,
 * SeriesHubContent) — never sent.
 */
function SeriesList(props: ListProps) {
  const { t } = useLanguage();
  const facetsQuery = useSeriesFacets();
  const lists = useGenreAndCategoryLists(facetsQuery);
  const { pick } = props;
  const groups = useMemo<OverlayGroup[]>(
    () =>
      buildGroups(
        t.hubs.series.allSeries,
        t.hub.genresHeading,
        t.browse.title,
        facetsQuery.data?.genres,
        lists.categories,
        (next) => pick("series", next),
      ),
    [facetsQuery.data, lists.categories, pick, t],
  );
  return (
    <OverlayList {...props} groups={groups} loading={lists.loading} failed={lists.failed} empty={lists.empty} onRetry={lists.retry} />
  );
}

/** Shared empty list, so an unloaded query never hands the memo a fresh `[]`. */
const NO_BOOK_CATEGORIES: BookCategory[] = [];

/**
 * Books (signed in only): "All books", then every one of the books' OWN
 * shelves (GET /book-categories, by name — not the movie categories), empty
 * ones included like Movies'. A pick shows the Books hub's All books grid on
 * that shelf, the same as a category shelf's "See all".
 *
 * The pop-up already shows a guest the sign-in prompt in its place; the
 * query's own `enabled` is a second lock, so this list can never ask a
 * members-only endpoint for a guest even if it is reused elsewhere.
 */
function BooksList({ signedIn, ...props }: ListProps & { signedIn: boolean }) {
  const { t } = useLanguage();
  const categoriesQuery = useBookCategories({ enabled: signedIn });
  const categories = categoriesQuery.data ?? NO_BOOK_CATEGORIES;
  const { pick } = props;
  const groups = useMemo<OverlayGroup[]>(
    () => [
      { key: "all", items: [{ key: "all", label: t.books.allBooks, onPress: () => pick("books", { kind: "all" }) }] },
      {
        key: "categories",
        title: t.browse.title,
        items: categories.map((category) => ({
          key: `category:${category.id}`,
          label: category.name,
          onPress: () => pick("books", { kind: "category", id: category.id }),
        })),
      },
    ],
    [categories, pick, t],
  );
  const refetch = categoriesQuery.refetch;
  const retry = useCallback(() => void refetch(), [refetch]);
  return (
    <OverlayList
      {...props}
      groups={groups}
      loading={signedIn && categoriesQuery.isLoading}
      failed={signedIn && categoriesQuery.isError && !categoriesQuery.data}
      empty={!!categoriesQuery.data && categoriesQuery.data.length === 0}
      onRetry={retry}
      errorMessage={t.hubs.books.categoriesError}
    />
  );
}

/** A guest's Books segment: book categories are members-only, so a sign-in prompt instead of a list. */
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

interface OverlayListProps extends ListProps {
  groups: OverlayGroup[];
  /** The lists are still on their way (skeleton bars). */
  loading: boolean;
  /** They failed — a message and Retry. */
  failed: boolean;
  /** Nothing but the "All …" line to show — a quiet "No categories yet" under it. */
  empty: boolean;
  onRetry: () => void;
  errorMessage?: string;
}

/** One kind's names: skeleton, error + Retry, or the groups (with a note when there are none). */
function OverlayList({
  groups,
  selectedKey,
  selectedRef,
  onSelectedLayout,
  loading,
  failed,
  empty,
  onRetry,
  errorMessage,
}: OverlayListProps) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <View style={styles.skeletons} accessible accessibilityRole="progressbar" accessibilityLabel={t.common.loading}>
        {[140, 110, 160, 120, 100, 150].map((width, i) => (
          <Skeleton key={i} width={width} height={24} radius="sm" />
        ))}
      </View>
    );
  }

  if (failed) {
    return (
      <View style={styles.message}>
        <Ionicons name="cloud-offline-outline" size={28} color={theme.colors.danger} />
        <ThemedText variant="body" color={theme.colors.textMuted} style={styles.center}>
          {errorMessage ?? t.hub.categoriesLoadError}
        </ThemedText>
        <Button title={t.common.retry} variant="secondary" onPress={onRetry} labelLines={2} style={styles.retry} />
      </View>
    );
  }

  // Flat children of the scroll's content (no group wrapper — a component
  // returning a fragment adds no view), so a name's layout `y` is its offset
  // in the list — what centring needs.
  return (
    <>
      {groups.map((group) =>
        group.items.length === 0 ? null : (
          <Fragment key={group.key}>
            {group.title ? (
              <ThemedText
                variant="caption"
                weight="bold"
                color={theme.colors.textFaint}
                accessibilityRole="header"
                style={[styles.center, styles.groupTitle]}
              >
                {group.title}
              </ThemedText>
            ) : null}
            {group.items.map((item) => {
              const selected = item.key === selectedKey;
              const size = selected ? ITEM_SIZE + 2 : ITEM_SIZE;
              // Burmese stacks marks above and below the Latin line box.
              const line = (selected ? ITEM_LINE + 2 : ITEM_LINE) + (hasMyanmar(item.label) ? MYANMAR_LINE_BONUS : 0);
              return (
                <Pressable
                  key={item.key}
                  ref={selected ? selectedRef : undefined}
                  onPress={item.onPress}
                  onLayout={selected ? onSelectedLayout : undefined}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [styles.item, pressed && styles.pressed]}
                >
                  <ThemedText
                    weight={selected ? "black" : "semibold"}
                    color={selected ? theme.colors.text : theme.colors.textMuted}
                    style={[styles.itemText, { fontSize: size, lineHeight: line }]}
                  >
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </Fragment>
        ),
      )}
      {empty ? (
        <ThemedText variant="body" color={theme.colors.textFaint} style={[styles.center, styles.emptyNote]}>
          {t.browse.empty}
        </ThemedText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: theme.colors.scrim },
  flex: { flex: 1 },
  header: { alignItems: "center", gap: theme.spacing.md, paddingBottom: theme.spacing.xs },
  /** The switch wraps to a second line rather than clip at 2× text or in Burmese. */
  segments: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: theme.spacing.sm },
  segment: {
    minHeight: theme.layout.minTouch,
    minWidth: 88,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  /** A short list stands centred under the switch, a long one scrolls. */
  list: { flexGrow: 1, justifyContent: "center", alignItems: "stretch" },
  groupTitle: { marginTop: theme.spacing.lg, marginBottom: theme.spacing.xs },
  center: { textAlign: "center" },
  item: { minHeight: theme.layout.minTouch, justifyContent: "center", paddingVertical: 6 },
  itemText: { textAlign: "center" },
  pressed: { opacity: 0.6 },
  skeletons: { alignItems: "center", gap: 22, paddingTop: theme.spacing.lg },
  message: { alignItems: "center", gap: theme.spacing.md, paddingTop: theme.spacing.xxl },
  emptyNote: { marginTop: theme.spacing.lg },
  retry: { minWidth: 140 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "flex-end" },
  close: {
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: CLOSE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.play,
  },
  closePressed: { transform: [{ scale: 0.94 }] },
});
