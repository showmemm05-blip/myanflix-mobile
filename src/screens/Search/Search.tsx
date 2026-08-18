import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ui/ThemedText";
import { EmptyState } from "@/components/ui/EmptyState";
import { PressableScale } from "@/components/ui/PressableScale";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { Chip } from "@/components/common/Chip";
import { MediaCard, MediaCardSkeleton } from "@/components/common/MediaCard";
import { MovieRow } from "@/components/movie/MovieRow";
import { MediaRail } from "@/components/movie/MediaRail";
import { movieCardContent, seriesCardContent } from "@/components/movie/mediaItems";
import { useMovies, useMostPurchased } from "@/hooks/useMovies";
import { useSeriesList } from "@/hooks/useSeries";
import { useCategories } from "@/hooks/useCategories";
import { useDebounce } from "@/hooks/useDebounce";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { SearchStackParamList } from "@/navigation/types";
import type { Movie, AccessType } from "@/types/movie";
import type { SeriesListItem } from "@/types/series";

type Props = NativeStackScreenProps<SearchStackParamList, "Search">;

type Tab = "all" | "movies" | "series" | "books" | "music";
type AccessFilter = "ALL" | AccessType;

/** How many past queries the in-memory recent list keeps. */
const RECENT_LIMIT = 6;
/** Shared empty list so the loading rails don't get a fresh array each render. */
const NO_MOVIES: Movie[] = [];

export function SearchScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>(route.params?.initialTab ?? "all");
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebounce(searchText, 400);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [language, setLanguage] = useState<string | undefined>();
  const [year, setYear] = useState<number | undefined>();
  const [access, setAccess] = useState<AccessFilter>("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Purely local (in-memory) — nothing is persisted or sent anywhere.
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Home's "Browse movies" / "Browse series" CTAs land here with `initialTab`.
  // The screen stays mounted between visits, so reading the param only in the
  // useState initializer would honour it once and ignore every later press.
  // Consume it on arrival and clear it again, which leaves the user's own
  // segment taps alone and still fires when the same tab is requested twice.
  const requestedTab = route.params?.initialTab;
  useEffect(() => {
    if (!requestedTab) return;
    setTab(requestedTab);
    navigation.setParams({ initialTab: undefined });
  }, [requestedTab, navigation]);

  const categoriesQuery = useCategories();
  const moviesQuery = useMovies({ search: debouncedSearch || undefined, categoryId, limit: 50 });
  const seriesQuery = useSeriesList({ limit: 100, accessType: access === "ALL" ? undefined : access });
  const popularQuery = useMostPurchased();

  // Backend has no language/year filter params for movies, and no
  // search/genre/language/year params at all for series — derived and
  // filtered client-side over whatever page came back, same limitation the
  // web app documents on its MovieQuery type.
  const availableLanguages = useMemo(
    () => [...new Set((moviesQuery.data?.items ?? []).map((m) => m.language))],
    [moviesQuery.data],
  );
  const availableYears = useMemo(
    () => [...new Set((moviesQuery.data?.items ?? []).map((m) => m.releaseYear))].sort((a, b) => b - a),
    [moviesQuery.data],
  );
  const filteredMovies = useMemo(
    () =>
      (moviesQuery.data?.items ?? []).filter(
        (m) =>
          (!language || m.language === language) &&
          (!year || m.releaseYear === year) &&
          (access === "ALL" || m.accessType === access),
      ),
    [moviesQuery.data, language, year, access],
  );

  const filteredSeries = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return (seriesQuery.data?.items ?? []).filter(
      (s) =>
        (!query || s.title.toLowerCase().includes(query)) &&
        (!categoryId || s.categories.some((c) => c.id === categoryId)) &&
        (!language || s.language === language),
    );
  }, [seriesQuery.data, debouncedSearch, categoryId, language]);

  const recommendedMovies = useMemo(
    () => [...(moviesQuery.data?.items ?? [])].sort((a, b) => b.rating - a.rating),
    [moviesQuery.data],
  );
  const latestMovies = useMemo(
    () => [...(moviesQuery.data?.items ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [moviesQuery.data],
  );
  const popularMovies = useMemo(() => popularQuery.data ?? [], [popularQuery.data]);
  const activeFilterCount = [categoryId, language, year, access !== "ALL" ? access : undefined].filter(Boolean).length;

  // Stable identities so the browse rails' memoized cards survive a keystroke
  // in the search field or a filter change.
  const goToMovieDetails = useCallback(
    (movie: Movie) =>
      navigation.getParent()?.navigate("HomeTab", { screen: "MovieDetails", params: { movieId: movie.id } }),
    [navigation],
  );
  const goToSeriesDetails = useCallback(
    (series: SeriesListItem) =>
      navigation.getParent()?.navigate("HomeTab", { screen: "SeriesDetails", params: { seriesId: series.id } }),
    [navigation],
  );

  const seriesRailItems = useMemo(
    () =>
      (seriesQuery.data?.items ?? []).map((series) => ({
        key: series.id,
        ...seriesCardContent(series, t.series.episodeCount.replace("{n}", String(series.episodeCount))),
        onPress: () => goToSeriesDetails(series),
      })),
    [seriesQuery.data, t, goToSeriesDetails],
  );

  const rememberSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((current) => [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, RECENT_LIMIT));
  };

  const isSearching = tab === "movies" || tab === "series";
  /** The field has text the debounce hasn't handed to the query yet. */
  const isTyping = isSearching && searchText.trim() !== debouncedSearch.trim();
  const resultCount = tab === "movies" ? filteredMovies.length : filteredSeries.length;
  const showRecents = isSearching && searchText.length === 0 && recentSearches.length > 0;
  const resetFilters = () => {
    setCategoryId(undefined);
    setLanguage(undefined);
    setYear(undefined);
    setAccess("ALL");
  };

  const listHeader = (
    <View style={styles.listHeader}>
      {showRecents ? (
        <View style={styles.recents}>
          <View style={styles.recentsHeader}>
            <ThemedText variant="overline">{t.search.recent.toUpperCase()}</ThemedText>
            <PressableScale onPress={() => setRecentSearches([])} style={styles.clearRecent} hitSlop={8}>
              <ThemedText variant="caption" weight="semibold" color={theme.colors.primary}>
                {t.search.clearRecent}
              </ThemedText>
            </PressableScale>
          </View>
          <View style={styles.recentRow}>
            {recentSearches.map((term) => (
              <Chip key={term} label={term} icon="time-outline" onPress={() => setSearchText(term)} />
            ))}
          </View>
        </View>
      ) : null}

      <ThemedText variant="caption" tabular>
        {t.search.resultsCount.replace("{n}", String(resultCount))}
      </ThemedText>
    </View>
  );

  return (
    <View style={styles.container}>
      <AppTopBar
        trailing={
          isSearching ? (
            <PressableScale
              style={styles.filterButton}
              onPress={() => setFiltersOpen(true)}
              accessibilityLabel={t.search.filters}
            >
              <Ionicons name="options-outline" size={20} color={theme.colors.text} />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <ThemedText variant="caption" weight="bold" tabular style={styles.filterBadgeText}>
                    {activeFilterCount}
                  </ThemedText>
                </View>
              )}
            </PressableScale>
          ) : null
        }
      >
        <View style={styles.headerBlock}>
          {isSearching && (
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={theme.colors.textFaint} />
              <TextInput
                style={styles.input}
                placeholder={t.search.placeholder}
                placeholderTextColor={theme.colors.textFaint}
                value={searchText}
                onChangeText={setSearchText}
                returnKeyType="search"
                autoCorrect={false}
                onSubmitEditing={() => rememberSearch(searchText)}
              />
              {isTyping ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : searchText.length > 0 ? (
                <PressableScale
                  onPress={() => setSearchText("")}
                  style={styles.clearButton}
                  accessibilityLabel={t.common.clear}
                >
                  <Ionicons name="close-circle" size={18} color={theme.colors.textFaint} />
                </PressableScale>
              ) : null}
            </View>
          )}

          <SegmentedControl
            options={[
              { value: "all", label: t.search.all, icon: "apps-outline" },
              { value: "movies", label: t.search.movies, icon: "film-outline" },
              { value: "series", label: t.search.series, icon: "tv-outline" },
              { value: "books", label: t.search.books, icon: "book-outline" },
              { value: "music", label: t.search.music, icon: "musical-notes-outline" },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
        </View>
      </AppTopBar>

      {tab === "all" ? (
        moviesQuery.isLoading || popularQuery.isLoading ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.browseContent}>
            <MovieRow title={t.search.recommendedRow} movies={NO_MOVIES} onPressMovie={goToMovieDetails} loading />
            <MovieRow title={t.search.popularRow} movies={NO_MOVIES} onPressMovie={goToMovieDetails} loading />
          </ScrollView>
        ) : moviesQuery.isError ? (
          <EmptyState message={t.common.somethingWentWrong} icon="cloud-offline-outline" tone={theme.colors.danger} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.browseContent}
            refreshControl={
              <RefreshControl
                refreshing={moviesQuery.isRefetching || popularQuery.isRefetching || seriesQuery.isRefetching}
                onRefresh={() => {
                  moviesQuery.refetch();
                  popularQuery.refetch();
                  seriesQuery.refetch();
                }}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
                progressBackgroundColor={theme.colors.surface}
              />
            }
          >
            <View style={styles.rows}>
              <MovieRow
                title={t.search.recommendedRow}
                movies={recommendedMovies}
                onPressMovie={goToMovieDetails}
                icon="sparkles-outline"
              />
              <MovieRow
                title={t.search.popularRow}
                movies={popularMovies}
                onPressMovie={goToMovieDetails}
                icon="flame-outline"
              />
              <MediaRail title={t.search.seriesRow} icon="tv-outline" items={seriesRailItems} />
              <MovieRow
                title={t.search.latestRow}
                movies={latestMovies}
                onPressMovie={goToMovieDetails}
                icon="time-outline"
              />
            </View>
          </ScrollView>
        )
      ) : tab === "books" ? (
        <EmptyState message={t.search.booksComingSoon} icon="book-outline" />
      ) : tab === "music" ? (
        <EmptyState message={t.search.musicComingSoon} icon="musical-notes-outline" />
      ) : tab === "movies" ? (
        moviesQuery.isLoading ? (
          <ResultsSkeleton />
        ) : moviesQuery.isError ? (
          <EmptyState message={t.common.somethingWentWrong} icon="cloud-offline-outline" tone={theme.colors.danger} />
        ) : filteredMovies.length === 0 ? (
          <EmptyState
            message={debouncedSearch ? t.search.noResults : t.profile.empty}
            icon="film-outline"
            actionLabel={activeFilterCount > 0 ? t.common.reset : undefined}
            onAction={activeFilterCount > 0 ? resetFilters : undefined}
          />
        ) : (
          <FlatList
            data={filteredMovies}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={listHeader}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <MediaCard
                {...movieCardContent(item)}
                onPress={() => {
                  rememberSearch(searchText);
                  goToMovieDetails(item);
                }}
              />
            )}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
            removeClippedSubviews
          />
        )
      ) : seriesQuery.isLoading ? (
        <ResultsSkeleton />
      ) : seriesQuery.isError ? (
        <EmptyState message={t.common.somethingWentWrong} icon="cloud-offline-outline" tone={theme.colors.danger} />
      ) : filteredSeries.length === 0 ? (
        <EmptyState
          message={debouncedSearch ? t.search.noResults : t.profile.empty}
          icon="tv-outline"
          actionLabel={activeFilterCount > 0 ? t.common.reset : undefined}
          onAction={activeFilterCount > 0 ? resetFilters : undefined}
        />
      ) : (
        <FlatList
          data={filteredSeries}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <MediaCard
              {...seriesCardContent(item, t.series.episodeCount.replace("{n}", String(item.episodeCount)))}
              onPress={() => {
                rememberSearch(searchText);
                goToSeriesDetails(item);
              }}
            />
          )}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
        />
      )}

      <BottomSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        snapHeight={520}
        title={t.search.filters}
        showClose
        footer={<Button title={t.common.done} onPress={() => setFiltersOpen(false)} fullWidth />}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <FilterGroup label={t.search.filterGenre}>
            <Chip label={t.search.allGenres} selected={!categoryId} onPress={() => setCategoryId(undefined)} />
            {(categoriesQuery.data ?? []).map((c) => (
              <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
            ))}
          </FilterGroup>

          <FilterGroup label={t.search.filterAccess}>
            <Chip label={t.search.accessAll} selected={access === "ALL"} onPress={() => setAccess("ALL")} />
            <Chip
              label={t.search.accessFree}
              tone="finance"
              selected={access === "FREE"}
              onPress={() => setAccess("FREE")}
            />
            <Chip
              label={t.search.accessSubscription}
              tone="premium"
              icon="diamond"
              selected={access === "SUBSCRIPTION"}
              onPress={() => setAccess("SUBSCRIPTION")}
            />
          </FilterGroup>

          {tab === "movies" && availableLanguages.length > 1 && (
            <FilterGroup label={t.search.filterLanguage}>
              <Chip label={t.search.allLanguages} selected={!language} onPress={() => setLanguage(undefined)} />
              {availableLanguages.map((l) => (
                <Chip key={l} label={l} selected={language === l} onPress={() => setLanguage(l)} />
              ))}
            </FilterGroup>
          )}

          {tab === "movies" && availableYears.length > 1 && (
            <FilterGroup label={t.search.filterYear}>
              <Chip label={t.search.allYears} selected={!year} onPress={() => setYear(undefined)} />
              {availableYears.map((y) => (
                <Chip key={y} label={String(y)} selected={year === y} onPress={() => setYear(y)} />
              ))}
            </FilterGroup>
          )}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

/** One labelled block of wrapping filter chips inside the filters sheet. */
function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.filterGroup}>
      <ThemedText variant="overline">{label.toUpperCase()}</ThemedText>
      <View style={styles.filterRow}>{children}</View>
    </View>
  );
}

/** Placeholder cards that hold the grid's shape while results load. */
function ResultsSkeleton() {
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: 3 }).map((_, index) => (
        <MediaCardSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerBlock: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.spacing.sm, gap: theme.spacing.sm },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: theme.layout.minTouch,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: theme.font.regular,
  },
  clearButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  filterButton: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadge: {
    position: "absolute",
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: { color: theme.colors.onPrimary },
  listHeader: { gap: theme.spacing.md, paddingBottom: theme.spacing.sm },
  recents: { gap: theme.spacing.sm },
  recentsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  clearRecent: { minHeight: theme.layout.minTouch, justifyContent: "center", paddingLeft: theme.spacing.sm },
  recentRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  separator: { height: theme.spacing.lg },
  listContent: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.layout.tabBarClearance,
  },
  skeletonList: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  browseContent: { paddingTop: theme.spacing.md, paddingBottom: theme.layout.tabBarClearance },
  rows: { gap: theme.spacing.lg },
  filterGroup: { gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
});
