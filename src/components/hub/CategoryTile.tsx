import { memo, useCallback, type RefObject } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ViewInstance,
} from "react-native";
import { Image, type ImageTransition } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { hasMyanmar } from "@/components/hub/hubLayout";
import { hashSeed } from "@/components/hub/HubFallbackArt";
import { BROWSE_STALE_TIME_MS, useMovies } from "@/hooks/useMovies";
import { useSeriesList } from "@/hooks/useSeries";
import { useBooksList } from "@/hooks/useBooks";
import { useLanguage } from "@/localization/LanguageProvider";
import type { TranslationShape } from "@/localization/translations";
import { theme, withAlpha } from "@/theme";
import type { CategoryKind, CategoryPick } from "@/components/hub/CategoriesOverlay";

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Where a tile borrows its picture from — its newest title, as Browse's
 * category tiles do. Categories carry no artwork of their own.
 */
export type CategoryTileArt =
  | { from: "movies"; categoryId: string }
  | { from: "movies"; genre: string }
  | { from: "series"; categoryId: string }
  | { from: "series"; genre: string }
  | { from: "books"; categoryId: string };

/** One tile in the Categories pop-up. */
export interface CategoryTileItem {
  /** Its selection key (categorySelectionKey): `category:<id>`, `genre:<g>`, `type:<c>`, `language:<l>`. */
  key: string;
  /**
   * Other selection keys this tile stands for: a category that took the
   * place of a same-named genre is still ticked on that genre's view (a
   * genre shelf's See all), and the other way round on Series.
   */
  altKeys?: readonly string[];
  label: string;
  /** Titles in it, when the list says so; null = learned from the picture's request (its `total`). */
  count: number | null;
  pick: CategoryPick;
  /** The faint corner icon of a tile with no picture. */
  icon: IconName;
  /** Genres and categories have a picture; Movie type and Language tiles stay colour + icon. */
  art?: CategoryTileArt;
}

/** Genres tiles are taller than the Movie type and Language ones (CatSheet.dc.html: 84 / 72). */
export type CategoryTileSize = "tall" | "short";

/** A tile's 2pt white ring and its tick when it is the one showing now. */
export function isTileSelected(item: CategoryTileItem, selectedKey: string | null): boolean {
  return selectedKey !== null && (item.key === selectedKey || !!item.altKeys?.includes(selectedKey));
}

export const TILE_RADIUS = 16;
const TALL_HEIGHT = 84;
const SHORT_HEIGHT = 72;
const NAME_SIZE = 17;
const NAME_LINE = 22;
/** Burmese stacks marks above and below the Latin line box (ThemedText's rule, here because the size is our own). */
const MYANMAR_LINE_BONUS = 6;
/** At large text sizes a name wraps as far as it needs: nothing is cut (its full name is spoken anyway). */
const FREE_WRAP_FONT_SCALE = 1.3;
const CHECK_SIZE = 24;
const COUNT_INK = "rgba(255,255,255,0.78)";
const ICON_INK = "rgba(255,255,255,0.14)";

/**
 * The tiles' base colours: deep tones from the approved drawing
 * (CatSheet.dc.html), with its two lightest (#A0661C, #2E6E3E) darkened so
 * the 13pt count at 78% white still reads — every tone gives white text at
 * least 7:1 and the count at least 5:1. A name always gets the same tone
 * (FNV-1a of the name), so "Action" looks the same on Movies and Series.
 */
const TILE_TONES = [
  "#8E2A2A",
  "#6B2E4A",
  "#7A4E16",
  "#8A2F55",
  "#4A2C2C",
  "#3B1F2B",
  "#6A3FA0",
  "#2A6338",
  "#5B3A1E",
  "#2B5876",
  "#3A3F58",
  "#2F5D50",
  "#4D4F2A",
  "#1E4F7A",
  "#4B3B8F",
  "#2D2A4A",
] as const;

function toneFor(label: string): string {
  return TILE_TONES[hashSeed(label.trim().toLowerCase()) % TILE_TONES.length];
}

/** Over a picture: dark from the left, where the name and count sit, clearing to the right. */
const ART_SCRIM = [
  withAlpha(theme.colors.background, 0.9),
  withAlpha(theme.colors.background, 0.62),
  withAlpha(theme.colors.background, 0.3),
] as const;
const ART_SCRIM_STOPS = [0, 0.55, 1] as const;
/**
 * The pop-up's tiles unmount on every close (a Modal), so each reopening
 * draws every picture again: kept in memory as well as on disk (the app's
 * other rails' rule), it is there at once, with no fade, rather than read
 * back from disk and faded in over the colour every time.
 */
const ART_CACHE = "memory-disk" as const;
const ART_TRANSITION: ImageTransition = { duration: 200, skipOnCacheHit: "memory" };

/**
 * The drawing's genre icons, by name (lower case, no spaces); any other
 * genre or category gets its section's own icon.
 */
const GENRE_ICONS: Record<string, IconName> = {
  action: "flash-outline",
  drama: "film-outline",
  comedy: "happy-outline",
  romance: "heart-outline",
  thriller: "eye-outline",
  horror: "skull-outline",
  animation: "color-palette-outline",
  family: "people-outline",
  adventure: "compass-outline",
  crime: "finger-print-outline",
  documentary: "videocam-outline",
  fantasy: "sparkles-outline",
  music: "musical-notes-outline",
  musical: "musical-notes-outline",
  mystery: "search-outline",
  "sci-fi": "planet-outline",
  sciencefiction: "planet-outline",
  war: "shield-outline",
  history: "hourglass-outline",
  sport: "football-outline",
  sports: "football-outline",
};

const KIND_ICONS: Record<CategoryKind, IconName> = {
  movies: "film-outline",
  series: "tv-outline",
  books: "book-outline",
};

export function genreIcon(name: string, kind: CategoryKind): IconName {
  return GENRE_ICONS[name.trim().toLowerCase().replace(/\s+/g, "")] ?? KIND_ICONS[kind];
}

/** "48 movies" / "ရုပ်ရှင် 48 ကား" — the count words the rest of the app already uses. */
export function categoryCountLabel(t: TranslationShape, kind: CategoryKind, n: number): string {
  if (kind === "movies") return n === 1 ? t.search.countMoviesOne : t.search.countMovies.replace("{n}", String(n));
  if (kind === "series") return n === 1 ? t.search.countSeriesOne : t.search.countSeries.replace("{n}", String(n));
  return n === 1 ? t.hub.booksCountOne : t.hub.booksCount.replace("{n}", String(n));
}

interface TileProps {
  item: CategoryTileItem;
  kind: CategoryKind;
  size: CategoryTileSize;
  /**
   * Its row is on (or near) the screen: only then may it ask for its
   * picture. Once true it stays true for this opening, so the picture never
   * flickers off as the list scrolls.
   */
  near: boolean;
  selected: boolean;
  /** Takes the selected tile's view, for the screen reader's focus as the pop-up opens. */
  selectedRef: RefObject<ViewInstance | null>;
  onPick: (pick: CategoryPick) => void;
}

/**
 * One tile, with the picture source its item names. Each source is its own
 * tiny component calling one query hook, so no hook is ever conditional.
 */
export const CategoryTile = memo(function CategoryTile(props: TileProps) {
  const art = props.item.art;
  if (!art) return <CategoryTileFace {...props} count={props.item.count} art={null} />;
  if (art.from === "movies") return <MovieArtTile {...props} art={art} />;
  if (art.from === "series") return <SeriesArtTile {...props} art={art} />;
  return <BookArtTile {...props} art={art} />;
});

/** May this tile ask for its picture: on screen, and not known to be empty. */
function mayAsk({ near, item }: TileProps): boolean {
  return near && (item.count === null || item.count > 0);
}

/** The answer's own total — the honest count for a list that has none of its own (Series categories, books). */
function totalOf(data: { total: number } | undefined, placeholder: boolean): number | null {
  return data && !placeholder ? data.total : null;
}

/**
 * A movie category or genre: its newest movie (GET /movies?categoryId=&limit=1
 * — the very key Browse's tiles use, so either screen fills the other's
 * cache — or ?genres=&limit=1).
 */
function MovieArtTile(props: TileProps & { art: Extract<CategoryTileArt, { from: "movies" }> }) {
  const { art } = props;
  const query = useMovies(
    "categoryId" in art ? { categoryId: art.categoryId, limit: 1 } : { genres: [art.genre], limit: 1 },
    { enabled: mayAsk(props), staleTime: BROWSE_STALE_TIME_MS },
  );
  const top = query.isPlaceholderData ? undefined : query.data?.items[0];
  return (
    <CategoryTileFace
      {...props}
      count={props.item.count ?? totalOf(query.data, query.isPlaceholderData)}
      art={top ? (top.coverUrl ?? top.posterUrl) : null}
    />
  );
}

/** A series genre or category: its newest series (GET /series?genres= or ?categoryId=, limit=1). */
function SeriesArtTile(props: TileProps & { art: Extract<CategoryTileArt, { from: "series" }> }) {
  const { art } = props;
  const query = useSeriesList(
    "categoryId" in art ? { categoryId: art.categoryId, limit: 1 } : { genres: [art.genre], limit: 1 },
    { enabled: mayAsk(props), staleTime: BROWSE_STALE_TIME_MS },
  );
  const top = query.data?.items[0];
  return (
    <CategoryTileFace
      {...props}
      count={props.item.count ?? totalOf(query.data, false)}
      art={top ? (top.coverUrl ?? top.posterUrl) : null}
    />
  );
}

/**
 * A book category: its newest book's cover (GET /books?categoryId=&limit=1).
 * Members only — the Books list is only ever drawn for a signed-in reader,
 * and its rows pass `near` false otherwise.
 */
function BookArtTile(props: TileProps & { art: Extract<CategoryTileArt, { from: "books" }> }) {
  const query = useBooksList(
    { categoryId: props.art.categoryId, limit: 1 },
    { enabled: mayAsk(props), staleTime: BROWSE_STALE_TIME_MS },
  );
  return (
    <CategoryTileFace
      {...props}
      count={props.item.count ?? totalOf(query.data, false)}
      art={query.data?.items[0]?.coverUrl ?? null}
    />
  );
}

/**
 * What every tile draws (CatSheet.dc.html, "Colour tiles", the owner's
 * pick 2026-11-10): a deep colour, the name in 17pt bold white (two lines at
 * most, Burmese with its taller lines), the count under it and a large
 * faint icon in the bottom-right corner. With a picture, the picture fills
 * the tile under a dark scrim from the left and the icon goes; while it
 * loads, or with none, the colour shows. The one showing now has a 2pt
 * white ring and a white tick in its top-right corner. No border at rest.
 *
 * A button spoken as its name and count, with its selected state. Pressed,
 * it shrinks a little (Reduce Motion: it lights up instead); it is never
 * dimmed, as nothing here may sit under partial opacity next to the glass.
 */
function CategoryTileFace({
  item,
  kind,
  size,
  selected,
  selectedRef,
  onPick,
  count,
  art,
}: TileProps & { count: number | null; art: string | null }) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const countLabel = count === null ? null : categoryCountLabel(t, kind, count);
  const label = item.label;
  const pick = item.pick;
  const onPress = useCallback(() => onPick(pick), [onPick, pick]);

  return (
    <Pressable
      ref={selected ? selectedRef : undefined}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={countLabel ? `${label}, ${countLabel}` : label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.tile,
        { minHeight: size === "tall" ? TALL_HEIGHT : SHORT_HEIGHT, backgroundColor: toneFor(label) },
        pressed && !reduceMotion && styles.tilePressed,
      ]}
    >
      {({ pressed }) => (
        <>
          {art ? (
            <>
              <Image
                source={{ uri: art }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy={ART_CACHE}
                transition={ART_TRANSITION}
                recyclingKey={art}
                accessible={false}
              />
              <LinearGradient
                colors={ART_SCRIM}
                locations={ART_SCRIM_STOPS}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            </>
          ) : (
            <Ionicons name={item.icon} size={54} color={ICON_INK} style={styles.icon} accessible={false} />
          )}
          <ThemedText
            weight="extrabold"
            color={theme.colors.text}
            numberOfLines={fontScale >= FREE_WRAP_FONT_SCALE ? undefined : 2}
            style={[
              styles.name,
              { lineHeight: NAME_LINE + (hasMyanmar(label) ? MYANMAR_LINE_BONUS : 0) },
              // Clear of the tick in the corner.
              selected && styles.nameBesideCheck,
            ]}
          >
            {label}
          </ThemedText>
          {countLabel ? (
            <ThemedText variant="caption" tabular color={COUNT_INK} style={styles.count}>
              {countLabel}
            </ThemedText>
          ) : null}
          {pressed && reduceMotion ? <View style={styles.pressLayer} pointerEvents="none" /> : null}
          {selected ? <SelectedMarks corner /> : null}
        </>
      )}
    </Pressable>
  );
}

/** The ring (always) and, in a tile's corner, the tick — the All tile places its own tick. */
function SelectedMarks({ corner }: { corner: boolean }) {
  return (
    <>
      <View style={styles.ring} pointerEvents="none" />
      {corner ? (
        <View style={[styles.check, styles.checkCorner]} pointerEvents="none">
          <Ionicons name="checkmark" size={16} color={theme.colors.onPlay} />
        </View>
      ) : null}
    </>
  );
}

interface AllTileProps {
  /** "All movies" / "All series" / "All books". */
  label: string;
  /** Every title, when the hub's own newest page is in hand; otherwise no line. */
  countLabel: string | null;
  selected: boolean;
  selectedRef: RefObject<ViewInstance | null>;
  onPress: () => void;
  /** Laid out while selected — scrolls the list to it (a direct child of the scroll content). */
  onSelectedLayout: (event: LayoutChangeEvent) => void;
}

/**
 * The wide "All …" tile at the top: the raised fill, the words and the count
 * on the left, and the white tick on the right when nothing else is picked.
 */
export const AllCategoriesTile = memo(function AllCategoriesTile({
  label,
  countLabel,
  selected,
  selectedRef,
  onPress,
  onSelectedLayout,
}: AllTileProps) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      ref={selected ? selectedRef : undefined}
      onPress={onPress}
      onLayout={selected ? onSelectedLayout : undefined}
      accessibilityRole="button"
      accessibilityLabel={countLabel ? `${label}, ${countLabel}` : label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.all, pressed && !reduceMotion && styles.allPressed]}
    >
      {({ pressed }) => (
        <>
          <View style={styles.allText}>
            <ThemedText
              weight="extrabold"
              color={theme.colors.text}
              style={[styles.name, { lineHeight: NAME_LINE + (hasMyanmar(label) ? MYANMAR_LINE_BONUS : 0) }]}
            >
              {label}
            </ThemedText>
            {countLabel ? (
              <ThemedText variant="caption" tabular color={theme.colors.textMuted}>
                {countLabel}
              </ThemedText>
            ) : null}
          </View>
          {selected ? (
            <View style={styles.check} pointerEvents="none">
              <Ionicons name="checkmark" size={16} color={theme.colors.onPlay} />
            </View>
          ) : null}
          {pressed && reduceMotion ? <View style={styles.pressLayer} pointerEvents="none" /> : null}
          {selected ? <SelectedMarks corner={false} /> : null}
        </>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  /** A MIN height, never a fixed one: at 2× text or in Burmese the name wraps and the tile (and its row) grows. */
  tile: {
    flex: 1,
    borderRadius: TILE_RADIUS,
    overflow: "hidden",
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 2,
  },
  tilePressed: { transform: [{ scale: 0.97 }] },
  icon: { position: "absolute", right: -6, bottom: -10 },
  name: { fontSize: NAME_SIZE },
  /** The tick sits 10pt in from the corner and is 24pt wide: 10 + 24 − 14 (the padding) + 2 of air. */
  nameBesideCheck: { paddingRight: 22 },
  count: { marginTop: 2 },
  pressLayer: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(255,255,255,0.12)" },
  /** Drawn over the picture (a border would sit under it on Android), the same 16pt corners. */
  ring: { ...StyleSheet.absoluteFill, borderRadius: TILE_RADIUS, borderWidth: 2, borderColor: theme.colors.play },
  check: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: CHECK_SIZE / 2,
    backgroundColor: theme.colors.play,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCorner: { position: "absolute", top: 10, right: 10 },
  all: {
    minHeight: 56,
    borderRadius: TILE_RADIUS,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceElevated,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  allPressed: { transform: [{ scale: 0.98 }] },
  allText: { flex: 1 },
});
