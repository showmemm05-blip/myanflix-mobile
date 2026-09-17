import { useState } from "react";
import { FlatList, RefreshControl, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { MediaCard, MediaCardSkeleton } from "@/components/common/MediaCard";
import { TopBar } from "@/components/layout/TopBar";
import { useWatchHistory } from "@/hooks/useVideo";
import { usePosterGrid } from "@/hooks/usePosterGrid";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration } from "@/utils/format";
import { theme } from "@/theme";
import type { LibraryStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LibraryStackParamList, "WatchHistory">;

export function WatchHistoryScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const grid = usePosterGrid();
  const historyQuery = useWatchHistory({ limit: 50 });
  // Presentation-only spinner state for pull-to-refresh.
  const [refreshing, setRefreshing] = useState(false);

  // Pushes onto the LIBRARY stack — MovieDetails is registered here too
  // (LibraryStackNavigator) — so back returns to this list. It used to jump to
  // the Home tab, which is why back dropped the user on Home.
  const goToDetails = (movieId: string) => {
    navigation.navigate("MovieDetails", { movieId });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await historyQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopBar title={t.profile.watchHistory} onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />

      {historyQuery.isLoading ? (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <MediaCardSkeleton key={index} width={grid.cellWidth} />
          ))}
        </View>
      ) : historyQuery.isError ? (
        <EmptyState message={t.common.somethingWentWrong} icon="alert-circle-outline" tone={theme.colors.danger} />
      ) : !historyQuery.data || historyQuery.data.items.length === 0 ? (
        <EmptyState message={t.profile.empty} icon="time-outline" />
      ) : (
        <FlatList
          key={`history-grid-${grid.columns}`}
          data={historyQuery.data.items}
          numColumns={grid.columns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          ItemSeparatorComponent={RowSeparator}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor={theme.colors.surface}
            />
          }
          initialNumToRender={9}
          maxToRenderPerBatch={9}
          windowSize={7}
          removeClippedSubviews
          renderItem={({ item }) => {
            const percent = Math.min(100, Math.max(0, Math.round(item.progress)));
            return (
              <MediaCard
                title={item.movieTitle}
                posterUrl={item.posterUrl}
                progress={percent / 100}
                cornerLabel={`${percent}%`}
                meta={[item.durationMinutes ? formatDuration(item.durationMinutes) : null]}
                width={grid.cellWidth}
                // Tap resumes via the detail screen — the old explicit "resume"
                // button pointed at the exact same destination.
                onPress={() => goToDetails(item.movieId)}
              />
            );
          }}
        />
      )}
    </View>
  );
}

function RowSeparator() {
  return <View style={styles.rowGap} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  rowGap: { height: 16 },
  gridContent: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.layout.tabBarClearance,
  },
  gridRow: { gap: 12, paddingHorizontal: theme.layout.screenPadding },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    rowGap: 16,
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
  },
});
