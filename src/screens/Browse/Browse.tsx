import { memo, useCallback, useMemo } from "react";
import { FlatList, ScrollView, StyleSheet, View, type ListRenderItemInfo } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAnimatedRef } from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StackActions, type CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { FadeInView } from "@/components/ui/FadeInView";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { TopBar } from "@/components/layout/TopBar";
import { GlassBarBackground, GlassScrollFeed, GlassTarget, useGlassBar } from "@/components/layout/GlassBar";
import { Chip } from "@/components/common/Chip";
import { Skeleton } from "@/components/common/Skeleton";
import { MediaCardSkeleton } from "@/components/common/MediaCard";
import { MovieRow } from "@/components/movie/MovieRow";
import { RailEndTile } from "@/components/movie/LandscapeRail";
import { useCategories } from "@/hooks/useCategories";
import { useMovies } from "@/hooks/useMovies";
import { useDockClearance } from "@/hooks/useDockClearance";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";
import type { MediaDetailParamList, MainTabParamList } from "@/navigation/types";
import type { TranslationShape } from "@/localization/translations";
import type { Category } from "@/types/category";
import type { Movie } from "@/types/movie";

type Props = CompositeScreenProps<
  NativeStackScreenProps<MediaDetailParamList, "Browse">,
  BottomTabScreenProps<MainTabParamList>
>;

/** Browse.dc.html: the categories with the most movies get a banner + shelf; the rest are tiles. */
const FEATURED_COUNT = 4;
const ROW_LIMIT = 10;
/** The boards' rail poster. */
const RAIL_CARD = 112;
const BANNER_HEIGHT = 200;
const TILE_HEIGHT = 104;
const TILE_GAP_X = 16;
const TILE_GAP_Y = 12;

type Row =
  | { kind: "featured"; key: string; category: Category }
  | { kind: "moreHeading"; key: string }
  | { kind: "tiles"; key: string; categories: Category[] };

const keyExtractor = (row: Row) => row.key;

function moviesCountLabel(t: TranslationShape, n: number): string {
  return n === 1 ? t.browse.moviesCountOne : t.browse.moviesCount.replace("{n}", String(n));
}

/**
 * Every category (GET /categories), as Browse.dc.html draws it: the title and
 * count, a chip per category, then the categories with the most movies as a
 * banner over a shelf of their titles, and the rest as two-up tiles.
 *
 * Categories carry no artwork, so each banner and tile shows its newest
 * title's art. A banner reads it off its own shelf (GET /movies?categoryId=
 * &limit=10 — the same key the category page and the title pages' Similar
 * rows use); a tile asks for one title (limit=1). Both are ordinary cached
 * queries owned by the row, and the list is virtualized, so only rows near
 * the screen ever ask. Counts are movie-only: the API has no series count
 * per category.
 */
export function BrowseScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const dockClearance = useDockClearance();
  const categoriesQuery = useCategories();
  // The glass bar (components/layout/GlassBar): the bar floats over the page,
  // transparent at the top, frosted once the banners scroll under it.
  const glass = useGlassBar();
  const listRef = useAnimatedRef<FlatList<Row>>();

  const ordered = useMemo(
    () => [...(categoriesQuery.data ?? [])].sort((a, b) => b.movieCount - a.movieCount || a.name.localeCompare(b.name)),
    [categoriesQuery.data],
  );
  const rows = useMemo<Row[]>(() => {
    const featured = ordered.filter((c) => c.movieCount > 0).slice(0, FEATURED_COUNT);
    const featuredIds = new Set(featured.map((c) => c.id));
    const rest = ordered.filter((c) => !featuredIds.has(c.id));
    const out: Row[] = featured.map((category) => ({ kind: "featured", key: `f-${category.id}`, category }));
    if (rest.length > 0) {
      out.push({ kind: "moreHeading", key: "more" });
      for (let i = 0; i < rest.length; i += 2) {
        out.push({ kind: "tiles", key: `t-${rest[i].id}`, categories: rest.slice(i, i + 2) });
      }
    }
    return out;
  }, [ordered]);

  // Stable: every banner, tile, chip and shelf card takes these.
  const openCategory = useCallback(
    (category: Pick<Category, "id">) => navigation.navigate("CategoryDetail", { categoryId: category.id }),
    [navigation],
  );
  const openMovie = useCallback((movie: Movie) => navigation.navigate("MovieDetails", { movieId: movie.id }), [navigation]);
  /**
   * The search button opens the Media tab's search screen. `initial: false`
   * builds the tab's root under it when the tab has never been opened (this
   * page is also on the Home stack and on the stack of the root "Profile"
   * screen); `pop: true` returns to a search screen already open rather than
   * stacking a second one. Under Profile — above the tabs, so the tab
   * navigator is not a parent — `popTo("Main", …)` pops Profile off the root
   * stack and hands the tabs the same params.
   */
  const openSearch = () => {
    if (navigation.getParent()?.getState()?.type === "tab") {
      navigation.navigate("SearchTab", { screen: "MediaSearch", initial: false, pop: true });
    } else {
      navigation.dispatch(
        StackActions.popTo("Main", {
          screen: "SearchTab",
          params: { screen: "MediaSearch", initial: false, pop: true },
        }),
      );
    }
  };

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Row>) => {
      switch (item.kind) {
        case "featured":
          return <FeaturedCategory category={item.category} onOpenCategory={openCategory} onOpenMovie={openMovie} />;
        case "moreHeading":
          return (
            <ThemedText variant="section" accessibilityRole="header" style={styles.moreHeading}>
              {t.browse.moreCategories}
            </ThemedText>
          );
        case "tiles":
          return (
            <View style={styles.tileRow}>
              {item.categories.map((category) => (
                <CategoryTile key={category.id} category={category} onPress={openCategory} />
              ))}
              {item.categories.length === 1 && <View style={styles.tileSpacer} />}
            </View>
          );
      }
    },
    [openCategory, openMovie, t],
  );

  const count = ordered.length;
  const header = (
    <View style={styles.header}>
      <ThemedText variant="display" accessibilityRole="header">
        {t.browse.title}
      </ThemedText>
      {categoriesQuery.isSuccess && count > 0 ? (
        <ThemedText variant="caption" tabular color={theme.colors.textFaint} style={styles.count}>
          {count === 1 ? t.browse.countOne : t.browse.count.replace("{n}", String(count))}
        </ThemedText>
      ) : null}
    </View>
  );

  let body;
  // Every state starts under the floating bar; the list scrolls up beneath it.
  const underBar = { paddingTop: glass.barHeight };
  if (categoriesQuery.isLoading) {
    body = (
      <View accessible accessibilityLabel={t.common.loading} style={underBar}>
        {header}
        <BrowseSkeleton />
      </View>
    );
  } else if (categoriesQuery.isError) {
    body = (
      <View style={[styles.stateWrap, underBar]}>
        {header}
        <EmptyState
          message={t.common.somethingWentWrong}
          icon="cloud-offline-outline"
          tone={theme.colors.danger}
          actionLabel={t.common.retry}
          onAction={() => {
            categoriesQuery.refetch();
          }}
        />
      </View>
    );
  } else if (rows.length === 0) {
    body = (
      <View style={[styles.stateWrap, underBar]}>
        {header}
        <EmptyState message={t.browse.empty} icon="albums-outline" />
      </View>
    );
  } else {
    body = (
      <>
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={
            <View>
              {header}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
                style={styles.chipsBox}
              >
                <Chip label={t.common.all} selected />
                {ordered.map((category) => (
                  <Chip key={category.id} label={category.name} onPress={() => openCategory(category)} />
                ))}
              </ScrollView>
            </View>
          }
          contentContainerStyle={{ paddingTop: glass.barHeight, paddingBottom: dockClearance }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          // Only rows near the screen mount, so only they ask for their art.
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
        />
        <GlassScrollFeed scrollRef={listRef} scrollY={glass.scrollY} />
      </>
    );
  }

  return (
    <View style={styles.container}>
      <GlassTarget targetRef={glass.blurTarget}>{body}</GlassTarget>

      <GlassBarBackground scrollY={glass.scrollY} height={glass.barHeight} blurTarget={glass.blurTarget} />
      <TopBar
        floating
        touchThrough
        onLayout={glass.onBarLayout}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t.common.back}
        rightIcon="search"
        onRightPress={openSearch}
        rightAccessibilityLabel={t.browse.searchA11y}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */

/**
 * A featured category: the 200pt (minimum) banner (its newest title's art under a
 * left-to-right scrim, the count, the name, the description and a round
 * chevron) and a shelf of its newest titles ending in a "See all" tile.
 */
const FeaturedCategory = memo(function FeaturedCategory({
  category,
  onOpenCategory,
  onOpenMovie,
}: {
  category: Category;
  onOpenCategory: (category: Category) => void;
  onOpenMovie: (movie: Movie) => void;
}) {
  const { t } = useLanguage();
  const shelfQuery = useMovies({ categoryId: category.id, limit: ROW_LIMIT });
  const movies = useMemo(() => shelfQuery.data?.items ?? [], [shelfQuery.data]);
  const art = movies[0] ? (movies[0].coverUrl ?? movies[0].posterUrl) : null;
  const countLabel = moviesCountLabel(t, category.movieCount);
  const open = useCallback(() => onOpenCategory(category), [onOpenCategory, category]);
  const seeAll = useMemo(
    () => (
      <RailEndTile
        label={t.common.seeAll}
        icon="arrow-forward"
        onPress={open}
        width={RAIL_CARD}
        height={Math.round(RAIL_CARD * 1.5)}
      />
    ),
    [t, open],
  );

  return (
    <FadeInView style={styles.featured}>
      <PressableScale onPress={open} accessibilityLabel={`${category.name}, ${countLabel}`} style={styles.banner}>
        {art ? (
          <Image source={{ uri: art }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} accessible={false} />
        ) : null}
        <LinearGradient
          colors={[withAlpha(theme.colors.background, 0.82), withAlpha(theme.colors.background, 0.45), withAlpha(theme.colors.background, 0)]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.bannerText}>
          <ThemedText variant="caption" weight="semibold" tabular color={theme.colors.textBody}>
            {countLabel}
          </ThemedText>
          <ThemedText variant="title" weight="black" style={styles.bannerName}>
            {category.name.toUpperCase()}
          </ThemedText>
          {category.description ? (
            <ThemedText variant="caption" weight="regular" color={theme.colors.textBody} numberOfLines={2} style={styles.bannerDescription}>
              {category.description}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.bannerChevron} pointerEvents="none">
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
        </View>
      </PressableScale>

      <View style={styles.shelf}>
        <MovieRow
          title=""
          movies={movies}
          onPressMovie={onOpenMovie}
          loading={shelfQuery.isLoading}
          cardWidth={RAIL_CARD}
          endTile={movies.length > 0 ? seeAll : null}
          markNew
        />
      </View>
    </FadeInView>
  );
});

/** One "More categories" tile — the newest title's art, bottom scrim, name and count. */
const CategoryTile = memo(function CategoryTile({
  category,
  onPress,
}: {
  category: Category;
  onPress: (category: Category) => void;
}) {
  const { t } = useLanguage();
  // No movies → nothing to borrow art from, and no request.
  const artQuery = useMovies({ categoryId: category.id, limit: 1 }, { enabled: category.movieCount > 0 });
  const top = artQuery.data?.items[0];
  const art = top ? (top.coverUrl ?? top.posterUrl) : null;
  const countLabel = moviesCountLabel(t, category.movieCount);

  return (
    <PressableScale
      onPress={() => onPress(category)}
      accessibilityLabel={`${category.name}, ${countLabel}`}
      style={styles.tile}
    >
      {art ? <Image source={{ uri: art }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessible={false} /> : null}
      <LinearGradient
        colors={[withAlpha(theme.colors.background, 0), withAlpha(theme.colors.background, 0.85)]}
        locations={[0.2, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.tileText}>
        <ThemedText variant="body" weight="black" numberOfLines={2}>
          {category.name.toUpperCase()}
        </ThemedText>
        <ThemedText variant="label" weight="semibold" tabular color={theme.colors.textBody} style={styles.tileCount}>
          {countLabel}
        </ThemedText>
      </View>
    </PressableScale>
  );
});

function BrowseSkeleton() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.skeletonChips}>
        {[52, 80, 92, 72].map((width) => (
          <Skeleton key={width} width={width} height={34} radius="xl" />
        ))}
      </View>
      {[0, 1].map((section) => (
        <View key={section} style={styles.featured}>
          <Skeleton width="auto" height={BANNER_HEIGHT} radius="lg" style={styles.skeletonBanner} />
          <View style={styles.skeletonShelf}>
            {[0, 1, 2].map((cell) => (
              <MediaCardSkeleton key={cell} width={RAIL_CARD} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: theme.layout.screenPadding },
  count: { marginTop: 4 },
  chipsBox: { marginTop: 20 },
  chips: { gap: theme.spacing.sm, paddingHorizontal: theme.layout.screenPadding, paddingVertical: 5 },
  stateWrap: { flex: 1 },

  featured: { marginTop: theme.spacing.xl },
  /**
   * A MIN height, not a fixed one: a long Burmese name at large text would
   * otherwise push the count line out of the top of the clip. It grows
   * downwards instead, and the art (absoluteFill) grows with it.
   */
  banner: {
    minHeight: BANNER_HEIGHT,
    marginHorizontal: theme.layout.screenPadding,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
    justifyContent: "flex-end",
  },
  bannerText: {
    paddingLeft: theme.layout.screenPadding,
    paddingRight: 72,
    paddingTop: theme.layout.screenPadding,
    paddingBottom: theme.layout.screenPadding,
  },
  bannerName: { marginTop: 2 },
  bannerDescription: { marginTop: 4 },
  bannerChevron: {
    position: "absolute",
    right: theme.layout.screenPadding,
    bottom: theme.layout.screenPadding,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.tonalStrong,
  },
  shelf: { marginTop: 14 },

  moreHeading: { marginTop: 36, marginBottom: 14, paddingHorizontal: theme.layout.screenPadding },
  tileRow: {
    flexDirection: "row",
    gap: TILE_GAP_X,
    paddingHorizontal: theme.layout.screenPadding,
    marginBottom: TILE_GAP_Y,
  },
  tileSpacer: { flex: 1 },
  tile: {
    flex: 1,
    minHeight: TILE_HEIGHT,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
    justifyContent: "flex-end",
  },
  tileText: { paddingHorizontal: 12, paddingBottom: 10, paddingTop: 24 },
  tileCount: { marginTop: 2, letterSpacing: 0 },

  skeletonChips: { flexDirection: "row", gap: theme.spacing.sm, paddingHorizontal: theme.layout.screenPadding, marginTop: 20 },
  skeletonBanner: { marginHorizontal: theme.layout.screenPadding },
  skeletonShelf: { flexDirection: "row", gap: 10, paddingHorizontal: theme.layout.screenPadding, marginTop: 14, overflow: "hidden" },
});
