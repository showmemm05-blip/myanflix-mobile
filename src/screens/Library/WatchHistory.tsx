import { useState } from "react";
import { FlatList, RefreshControl, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { MediaCard, MediaCardSkeleton } from "@/components/common/MediaCard";
import { TopBar } from "@/components/layout/TopBar";
import { useWatchHistory } from "@/hooks/useVideo";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration } from "@/utils/format";
import { theme } from "@/theme";
import type { LibraryStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LibraryStackParamList, "WatchHistory">;

export function WatchHistoryScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const historyQuery = useWatchHistory({ limit: 50 });
  // Presentation-only spinner state for pull-to-refresh.
  const [refreshing, setRefreshing] = useState(false);

  const goToDetails = (movieId: string) => {
    navigation.getParent()?.navigate("HomeTab", { screen: "MovieDetails", params: { movieId } });
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
        <View style={styles.skeletonList}>
          <MediaCardSkeleton />
          <MediaCardSkeleton />
        </View>
      ) : historyQuery.isError ? (
        <EmptyState message={t.common.somethingWentWrong} icon="alert-circle-outline" tone={theme.colors.danger} />
      ) : !historyQuery.data || historyQuery.data.items.length === 0 ? (
        <EmptyState message={t.profile.empty} icon="time-outline" />
      ) : (
        <FlatList
          data={historyQuery.data.items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
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
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews
          renderItem={({ item }) => {
            const percent = Math.min(100, Math.max(0, Math.round(item.progress)));
            return (
              <MediaCard
                title={item.movieTitle}
                imageUrl={item.posterUrl}
                // Only a poster exists on a history entry, so it fills the
                // 16:9 still and the overlapping tile is suppressed.
                showPoster={false}
                progress={percent / 100}
                meta={[item.durationMinutes ? formatDuration(item.durationMinutes) : null, `${percent}%`]}
                onPress={() => goToDetails(item.movieId)}
                // Same destination as pressing the card — a explicit "continue"
                // affordance, not a new action.
                action={{ icon: "play", label: t.movie.resume, onPress: () => goToDetails(item.movieId) }}
              />
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  skeletonList: { paddingHorizontal: theme.layout.screenPadding, paddingTop: theme.spacing.md, gap: theme.spacing.lg },
  listContent: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.layout.tabBarClearance,
    gap: theme.spacing.lg,
  },
});
