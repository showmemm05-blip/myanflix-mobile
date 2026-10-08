import { memo, useCallback, useMemo } from "react";
import { FlatList, RefreshControl, StyleSheet, View, type ListRenderItemInfo } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useAnimatedRef } from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { PressableScale } from "@/components/ui/PressableScale";
import { SearchField } from "@/components/ui/SearchField";
import { ThemedText } from "@/components/ui/ThemedText";
import { TopBar } from "@/components/layout/TopBar";
import {
  GLASS_BAR_ROW,
  GlassBarBackground,
  GlassScrollFeed,
  GlassTarget,
  useGlassBar,
} from "@/components/layout/GlassBar";
import { personInitials } from "@/components/common/ActorAvatar";
import { ListFooterSpinner } from "@/components/common/ListFooterSpinner";
import { Skeleton } from "@/components/common/Skeleton";
import { useActorsInfinite } from "@/hooks/useActors";
import { flattenPages } from "@/hooks/pagination";
import { usePosterGrid, type PosterGridLayout } from "@/hooks/usePosterGrid";
import { useSearchTerm } from "@/hooks/useSearchTerm";
import { useDockClearance } from "@/hooks/useDockClearance";
import { useLanguage } from "@/localization/LanguageProvider";
import { actorCreditsCaption } from "@/utils/actorCredits";
import { theme, withAlpha } from "@/theme";
import type { SearchStackParamList } from "@/navigation/types";
import type { ActorListItem } from "@/api/actors.api";

type Props = NativeStackScreenProps<SearchStackParamList, "ActorsList">;

/** Actors.dc.html: a 110 × 138 portrait card — the cell's width, this ratio. */
const CARD_RATIO = 138 / 110;
/** Air between the bar and the count line over the grid. */
const GRID_TOP = 12;
/**
 * The bar's height under the inset before it is measured: the control row,
 * the large title (8 + 40 + 8) and the search block (16 + 48 + 8).
 */
const BAR_ROWS_ESTIMATE = GLASS_BAR_ROW + 56 + 72;

function RowSeparator() {
  return <View style={styles.rowGap} />;
}
/** Module scope: FlatList cells are PureComponents, so this must not be an inline arrow. */
const keyExtractor = (item: ActorListItem) => item.id;

/**
 * One person (Actors.dc.html): a portrait card — their photo when the
 * catalogue has one, big initials on the avatar tone otherwise — then the
 * name (two lines, never an ellipsis on one) and the credits caption, worded
 * by `actorCreditsCaption`, the same helper the actor page's hero uses. Both
 * counts are the backend's, already on every row, so a cell costs nothing.
 */
const PersonCard = memo(function PersonCard({
  person,
  width,
  credits,
  onPress,
}: {
  person: ActorListItem;
  width: number;
  credits: string;
  onPress: (person: ActorListItem) => void;
}) {
  const height = Math.round(width * CARD_RATIO);
  return (
    <PressableScale
      onPress={() => onPress(person)}
      dimOnPress
      accessibilityLabel={`${person.name}, ${credits}`}
      style={{ width }}
    >
      <View style={[styles.portrait, { height }]}>
        {person.imageUrl ? (
          <Image
            source={{ uri: person.imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            accessible={false}
          />
        ) : (
          <ThemedText weight="black" color={theme.colors.onAvatar} style={styles.initials} allowFontScaling={false}>
            {personInitials(person.name)}
          </ThemedText>
        )}
        <LinearGradient
          colors={[withAlpha(theme.colors.background, 0), withAlpha(theme.colors.background, 0.45)]}
          style={styles.portraitScrim}
          pointerEvents="none"
        />
      </View>
      <ThemedText variant="muted" weight="bold" color={theme.colors.text} numberOfLines={2} style={styles.name}>
        {person.name}
      </ThemedText>
      <ThemedText variant="label" weight="regular" tabular color={theme.colors.textFaint} style={styles.credits}>
        {credits}
      </ThemedText>
    </PressableScale>
  );
});

function PeopleGridSkeleton({ grid }: { grid: PosterGridLayout }) {
  const height = Math.round(grid.cellWidth * CARD_RATIO);
  return (
    <View style={styles.skeleton} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Skeleton width={96} height={13} radius="xs" style={styles.skeletonCount} />
      <View style={[styles.skeletonGrid, { gap: grid.gap }]}>
        {Array.from({ length: grid.columns * 3 }).map((_, index) => (
          <View key={index} style={{ width: grid.cellWidth }}>
            <Skeleton width={grid.cellWidth} height={height} radius="lg" />
            <Skeleton width="76%" height={13} radius="xs" style={styles.skeletonLine} />
            <Skeleton width="55%" height={11} radius="xs" style={styles.skeletonLineTight} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Everyone in the catalogue — an endless alphabetical grid of people with its
 * own search field, the sibling of the authors list (Actors.dc.html).
 *
 * It was a sixth tab of the Media screen for one round; six tabs overflowed
 * the strip, so the owner moved the list here and reaches it from the People
 * button in the results header instead. Same paged query, same empties.
 *
 * Debounced (useSearchTerm) unlike the Media screen, which freezes its grid
 * until a term is committed — there is nothing to protect here, no filters and
 * no held-over results the user is reading, so the shared 400ms behaviour of
 * every other catalogue surface is the right one.
 */
export function ActorsListScreen({ navigation }: Props) {
  const { t } = useLanguage();
  // "default" is the three-column browse density — the board's three 110pt
  // cards on a phone.
  const grid = usePosterGrid();
  const dockClearance = useDockClearance();
  // The glass bar (components/layout/GlassBar): the title and the search field
  // float over the grid, transparent at the top, frosted once faces scroll
  // under them.
  const glass = useGlassBar(BAR_ROWS_ESTIMATE);
  const listRef = useAnimatedRef<FlatList<ActorListItem>>();
  const {
    term: searchText,
    setTerm: setSearchText,
    effectiveTerm,
    isDebouncing,
    clear: clearSearch,
  } = useSearchTerm();

  // No minimum-length gate of its own (see useActorsInfinite): an empty term is
  // this screen's resting state — everyone, alphabetically, which is the whole
  // point of it. `effectiveTerm` already withholds anything shorter than
  // SEARCH_MIN_LENGTH, so a single typed character lists everyone rather than
  // firing a request that matches half the catalogue.
  const peopleQuery = useActorsInfinite(effectiveTerm);
  const people = useMemo(() => flattenPages(peopleQuery.data?.pages), [peopleQuery.data]);
  const isSearching = isDebouncing || (peopleQuery.isFetching && !peopleQuery.isFetchingNextPage);
  const total = peopleQuery.data?.pages[0]?.total;

  /**
   * The count caption over the grid — phrased with the screen's own pair, not
   * the catalogue's "{n} results": a person is not a result, and "3 results
   * for “chan”" reads as three films. Null while the number in hand describes
   * the PREVIOUS term (keepPreviousData holds the last faces on screen), so a
   * stale count is never printed over them.
   */
  const countLabel = useMemo(() => {
    if (total === undefined || peopleQuery.isPlaceholderData) return null;
    const n = String(total);
    if (effectiveTerm) {
      const template = total === 1 ? t.search.countPeopleForTermOne : t.search.countPeopleForTerm;
      return template.replace("{n}", n).replace("{term}", effectiveTerm);
    }
    return total === 1 ? t.search.countPeopleOne : t.search.countPeople.replace("{n}", n);
  }, [total, peopleQuery.isPlaceholderData, effectiveTerm, t]);

  const goToActor = useCallback(
    (actor: ActorListItem) => navigation.navigate("ActorDetails", { actorId: actor.id }),
    [navigation],
  );

  const cellWidth = grid.cellWidth;
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ActorListItem>) => (
      <PersonCard person={item} width={cellWidth} credits={actorCreditsCaption(t, item)} onPress={goToActor} />
    ),
    [cellWidth, goToActor, t],
  );

  /** The count line, as the list's header, so it scrolls with the faces. */
  const listHeader = useMemo(
    () => (
      <View style={styles.countRow}>
        <ThemedText variant="caption" tabular color={theme.colors.textFaint} accessibilityLiveRegion="polite">
          {countLabel ?? ""}
        </ThemedText>
      </View>
    ),
    [countLabel],
  );
  /**
   * FlatList compares `ListFooterComponent` by identity, so the element only
   * moves when the dots should appear or go.
   */
  const listFooter = useMemo(
    () => <ListFooterSpinner visible={peopleQuery.isFetchingNextPage} />,
    [peopleQuery.isFetchingNextPage],
  );
  /** The gap is the grid's, not a constant — the row wrapper has to agree with
      the cell width it was measured from. */
  const rowStyle = useMemo(() => [styles.gridRow, { gap: grid.gap }], [grid.gap]);

  // Every state starts under the floating bar; the grid scrolls up beneath it.
  const underBar = [styles.state, { paddingTop: glass.barHeight }];

  return (
    <View style={styles.container}>
      <GlassTarget targetRef={glass.blurTarget}>
        {peopleQuery.isLoading ? (
          <View style={underBar}>
            <PeopleGridSkeleton grid={grid} />
          </View>
        ) : peopleQuery.isError ? (
          <View style={underBar}>
            <EmptyState
              title={t.search.errorTitle}
              message={t.common.somethingWentWrong}
              icon="cloud-offline-outline"
              tone={theme.colors.danger}
              actionLabel={t.common.retry}
              onAction={() => peopleQuery.refetch()}
            />
          </View>
        ) : people.length === 0 ? (
          /* Two different facts, two different sentences. With a term the
             catalogue simply has nobody by that name, and the way out is to drop
             the term. Without one the screen is empty because the catalogue is,
             which no action of the user's can fix, so that one offers none. */
          <View style={underBar}>
            {effectiveTerm ? (
              <EmptyState
                title={t.search.noResultsTitle}
                message={t.search.noPeopleBody.replace("{term}", effectiveTerm)}
                icon="search-outline"
                actionLabel={t.search.clearField}
                onAction={clearSearch}
              />
            ) : (
              <EmptyState title={t.search.peopleEmptyTitle} message={t.search.peopleEmptyBody} icon="people-outline" />
            )}
          </View>
        ) : (
          <>
            <FlatList
              ref={listRef}
              // RN cannot change `numColumns` in place — the list has to remount
              // when a rotation re-flows the grid.
              key={`actors-grid-${grid.columns}`}
              data={people}
              numColumns={grid.columns}
              keyExtractor={keyExtractor}
              contentContainerStyle={{ paddingTop: glass.barHeight + GRID_TOP, paddingBottom: dockClearance }}
              columnWrapperStyle={rowStyle}
              ItemSeparatorComponent={RowSeparator}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              renderItem={renderItem}
              ListHeaderComponent={listHeader}
              ListFooterComponent={listFooter}
              onEndReachedThreshold={0.6}
              onEndReached={() => {
                if (peopleQuery.hasNextPage && !peopleQuery.isFetchingNextPage) peopleQuery.fetchNextPage();
              }}
              refreshControl={
                <RefreshControl
                  refreshing={peopleQuery.isRefetching && !peopleQuery.isFetchingNextPage}
                  onRefresh={() => peopleQuery.refetch()}
                  tintColor={theme.colors.primary}
                  colors={[theme.colors.primary]}
                  progressBackgroundColor={theme.colors.surface}
                  progressViewOffset={glass.barHeight}
                />
              }
              initialNumToRender={grid.columns * 4}
              maxToRenderPerBatch={grid.columns * 4}
              windowSize={5}
              removeClippedSubviews
              scrollEventThrottle={16}
            />
            <GlassScrollFeed scrollRef={listRef} scrollY={glass.scrollY} />
          </>
        )}
      </GlassTarget>

      <GlassBarBackground scrollY={glass.scrollY} height={glass.barHeight} blurTarget={glass.blurTarget} />
      <TopBar
        title={t.search.people}
        large
        floating
        touchThrough
        onLayout={glass.onBarLayout}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t.common.back}
      >
        <View style={styles.headerBlock} pointerEvents="box-none">
          <SearchField
            value={searchText}
            onChangeText={setSearchText}
            // Results follow the typing here; return only puts the keyboard away.
            onSubmit={() => {}}
            onClear={clearSearch}
            loading={isSearching && searchText.length > 0}
            placeholder={t.search.placeholderPeople}
            accessibilityLabel={t.search.placeholderPeople}
            clearAccessibilityLabel={t.common.clear}
          />
        </View>
      </TopBar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerBlock: { paddingHorizontal: theme.layout.screenPadding, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm },
  rowGap: { height: 20 },
  /** Keeps its height whether or not the count is known, so the grid never jumps. */
  countRow: {
    minHeight: 24,
    justifyContent: "center",
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: 14,
  },
  /** A non-list state (loading, error, empty) fills the page under the bar. */
  state: { flex: 1 },
  gridRow: { paddingHorizontal: theme.layout.screenPadding },
  portrait: {
    width: "100%",
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.avatar,
  },
  /** A Burmese initial needs the taller line — never clipped at the top. */
  initials: { fontSize: 40, lineHeight: 56 },
  portraitScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 40 },
  name: { marginTop: theme.spacing.sm },
  credits: { marginTop: 2, letterSpacing: 0 },
  skeleton: { paddingTop: 22 },
  skeletonCount: { marginHorizontal: theme.layout.screenPadding },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 20,
    marginTop: 16,
    paddingHorizontal: theme.layout.screenPadding,
  },
  skeletonLine: { marginTop: 12 },
  skeletonLineTight: { marginTop: 8 },
});
