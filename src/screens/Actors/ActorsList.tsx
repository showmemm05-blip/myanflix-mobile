import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
  type ListRenderItemInfo,
} from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { TopBar } from "@/components/layout/TopBar";
import { ActorAvatar } from "@/components/common/ActorAvatar";
import { ListFooterSpinner } from "@/components/common/ListFooterSpinner";
import { ActorGridSkeleton } from "@/components/actors/ActorGridSkeleton";
import { useActorsInfinite } from "@/hooks/useActors";
import { flattenPages } from "@/hooks/pagination";
import { usePosterGrid } from "@/hooks/usePosterGrid";
import { useSearchTerm } from "@/hooks/useSearchTerm";
import { useLanguage } from "@/localization/LanguageProvider";
import { actorCreditsCaption } from "@/utils/actorCredits";
import { theme } from "@/theme";
import type { SearchStackParamList } from "@/navigation/types";
import type { ActorListItem } from "@/api/actors.api";

type Props = NativeStackScreenProps<SearchStackParamList, "ActorsList">;

/**
 * The headshot diameter. Larger than the People rail's 64 because a cell gets
 * a third of the width rather than a slot in a scrolling row — at 72 a face is
 * recognisable and three still fit a phone comfortably.
 */
const PERSON_AVATAR_SIZE = 72;

function RowSeparator() {
  return <View style={styles.rowGap} />;
}
/** Module scope: FlatList cells are PureComponents, so this must not be an inline arrow. */
const keyExtractor = (item: ActorListItem) => item.id;

/**
 * Everyone in the catalogue — an endless alphabetical grid of faces with its
 * own search field, the sibling of BooksCatalog.
 *
 * It was a sixth tab of the Media screen for one round; six tabs overflowed
 * the strip, so the owner moved the list here and reaches it from the People
 * button in the results header instead. Nothing about the list itself changed:
 * same paged query, same cells, same empties.
 *
 * Debounced (useSearchTerm) unlike the Media screen, which freezes its grid
 * until a term is committed — there is nothing to protect here, no filters and
 * no held-over results the user is reading, so the shared 400ms behaviour of
 * every other catalogue surface is the right one.
 */
export function ActorsListScreen({ navigation }: Props) {
  const { t } = useLanguage();
  // "default" is the three-column browse density — a 72pt disc with a name and
  // a film count under it wants a third of the width, not the half a spacious
  // poster grid hands out.
  const grid = usePosterGrid();
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
  const isSearching = isDebouncing || peopleQuery.isFetching;
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
  /**
   * One cell: the round headshot the rail and the actor page draw, the name
   * under it, and the person's credits as a caption — `actorCreditsCaption`,
   * the same helper the actor page's hero uses, so "1 movie · 1 series" is
   * worded identically in both places. Both counts are the backend's, already
   * on every row, so a cell costs no extra request.
   */
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ActorListItem>) => (
      <PressableScale
        onPress={() => goToActor(item)}
        accessibilityLabel={item.name}
        style={[styles.personCell, { width: cellWidth }]}
      >
        <ActorAvatar name={item.name} imageUrl={item.imageUrl} size={PERSON_AVATAR_SIZE} />
        <ThemedText
          variant="caption"
          weight="medium"
          color={theme.colors.text}
          numberOfLines={2}
          style={styles.personName}
        >
          {item.name}
        </ThemedText>
        <ThemedText variant="caption" numberOfLines={1} tabular style={styles.personCount}>
          {actorCreditsCaption(t, item)}
        </ThemedText>
      </PressableScale>
    ),
    [cellWidth, goToActor, t],
  );

  /** The count line, as the list's header, so it scrolls with the faces. */
  const listHeader = useMemo(
    () => (
      <View style={styles.countRow}>
        <ThemedText variant="caption" numberOfLines={1}>
          {countLabel ?? ""}
        </ThemedText>
      </View>
    ),
    [countLabel],
  );
  /**
   * FlatList compares `ListFooterComponent` by identity, so the element only
   * moves when the spinner should appear or go.
   */
  const listFooter = useMemo(
    () => <ListFooterSpinner visible={peopleQuery.isFetchingNextPage} />,
    [peopleQuery.isFetchingNextPage],
  );
  /** The gap is the grid's, not a constant — the row wrapper has to agree with
      the cell width it was measured from. */
  const rowStyle = useMemo(() => [styles.gridRow, { gap: grid.gap }], [grid.gap]);

  return (
    <View style={styles.container}>
      <TopBar title={t.search.people} large onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back}>
        <View style={styles.headerBlock}>
          <View style={styles.searchBar}>
            {/* Leading glyph doubles as the progress indicator — same idiom as
                BooksCatalog and the Media screen's own field. */}
            <View style={styles.searchGlyph}>
              {isSearching ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons name="search" size={18} color={theme.colors.textFaint} />
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder={t.search.placeholderPeople}
              placeholderTextColor={theme.colors.textFaint}
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchText.length > 0 && (
              <PressableScale onPress={clearSearch} style={styles.clearButton} accessibilityLabel={t.common.clear}>
                <Ionicons name="close-circle" size={18} color={theme.colors.textFaint} />
              </PressableScale>
            )}
          </View>
        </View>
      </TopBar>

      {peopleQuery.isLoading ? (
        <ActorGridSkeleton grid={grid} avatar={PERSON_AVATAR_SIZE} />
      ) : peopleQuery.isError ? (
        <EmptyState
          title={t.search.errorTitle}
          message={t.common.somethingWentWrong}
          icon="cloud-offline-outline"
          tone={theme.colors.danger}
          actionLabel={t.common.retry}
          onAction={() => peopleQuery.refetch()}
        />
      ) : people.length === 0 ? (
        /* Two different facts, two different sentences. With a term the
           catalogue simply has nobody by that name, and the way out is to drop
           the term. Without one the screen is empty because the catalogue is,
           which no action of the user's can fix, so that one offers none. */
        effectiveTerm ? (
          <EmptyState
            title={t.search.noResultsTitle}
            message={t.search.noPeopleBody.replace("{term}", effectiveTerm)}
            icon="search-outline"
            actionLabel={t.search.clearField}
            onAction={clearSearch}
          />
        ) : (
          <EmptyState title={t.search.peopleEmptyTitle} message={t.search.peopleEmptyBody} icon="people-outline" />
        )
      ) : (
        <FlatList
          // RN cannot change `numColumns` in place — the list has to remount
          // when a rotation re-flows the grid.
          key={`actors-grid-${grid.columns}`}
          data={people}
          numColumns={grid.columns}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.gridContent}
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
            />
          }
          initialNumToRender={grid.columns * 4}
          maxToRenderPerBatch={grid.columns * 4}
          windowSize={5}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerBlock: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.spacing.sm },
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
  searchGlyph: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  clearButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  rowGap: { height: theme.spacing.lg },
  /** Keeps its height whether or not the count is known, so the grid never jumps. */
  countRow: {
    minHeight: 24,
    justifyContent: "center",
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.spacing.xs,
  },
  gridContent: { paddingTop: theme.spacing.md, paddingBottom: theme.layout.tabBarClearance },
  gridRow: { paddingHorizontal: theme.layout.screenPadding },
  personCell: { alignItems: "center", gap: theme.spacing.xs },
  personName: { textAlign: "center", fontSize: 12, lineHeight: 16 },
  personCount: { textAlign: "center", color: theme.colors.textMuted, fontSize: 11 },
});
