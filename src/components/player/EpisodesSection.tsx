import { useCallback, useMemo, useRef } from "react";
import { ActivityIndicator, FlatList, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ThemedText } from "@/components/ui/ThemedText";
import { EpisodeRow, EPISODE_ROW_HEIGHT } from "@/components/series/EpisodeRow";
import { usePlayerEpisodes } from "@/hooks/useSeries";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { PlayerEpisode } from "@/types/series";

interface Props {
  seriesId: string;
  currentEpisodeId: string;
  onSelectEpisode: (episodeId: string) => void;
  /** Hides the "Episodes" heading — the sheet already carries a title. */
  hideHeader?: boolean;
}

/** Every row type the flat list can hold, each with a height known up front. */
type Row =
  | { key: string; kind: "title" }
  | { key: string; kind: "season"; seasonNumber: number; episodeCount: number }
  | { key: string; kind: "episode"; episode: PlayerEpisode };

const ROW_GAP = theme.spacing.sm;
const EPISODE_BLOCK_HEIGHT = EPISODE_ROW_HEIGHT + ROW_GAP;
const SEASON_HEADER_HEIGHT = 40;
const TITLE_HEIGHT = 44;
const CONTENT_PADDING_TOP = theme.spacing.md;

function rowHeight(row: Row): number {
  switch (row.kind) {
    case "title":
      return TITLE_HEIGHT;
    case "season":
      return SEASON_HEADER_HEIGHT;
    default:
      return EPISODE_BLOCK_HEIGHT;
  }
}

/**
 * The episode list under the player. Virtualized — a long series is hundreds of
 * rows, each with a remote still, and mounting them all at once is what made
 * opening the picker stutter. Every row has a fixed height, so `getItemLayout`
 * gives exact offsets: the one-time scroll to the current episode lands on the
 * right row in EVERY season, not just the first (offsets are list-absolute, not
 * relative to a season block).
 */
export function EpisodesSection({ seriesId, currentEpisodeId, onSelectEpisode, hideHeader }: Props) {
  const { t } = useLanguage();
  const episodesQuery = usePlayerEpisodes(seriesId);
  const listRef = useRef<FlatList<Row>>(null);
  const hasScrolledRef = useRef(false);

  const seasons = useMemo(() => episodesQuery.data?.seasons ?? [], [episodesQuery.data]);

  const rows = useMemo<Row[]>(() => {
    const items: Row[] = [];
    if (!hideHeader) items.push({ key: "title", kind: "title" });
    for (const season of seasons) {
      items.push({
        key: `season-${season.seasonNumber}`,
        kind: "season",
        seasonNumber: season.seasonNumber,
        episodeCount: season.episodes.length,
      });
      for (const episode of season.episodes) {
        items.push({ key: `episode-${episode.id}`, kind: "episode", episode });
      }
    }
    return items;
  }, [seasons, hideHeader]);

  /**
   * Cumulative, list-ABSOLUTE offsets (content padding included, so they match
   * what the scroll view expects) — one pass, reused by `getItemLayout` and the
   * auto-scroll below.
   */
  const offsets = useMemo(() => {
    let running = CONTENT_PADDING_TOP;
    return rows.map((row) => {
      const offset = running;
      running += rowHeight(row);
      return offset;
    });
  }, [rows]);

  const currentOffset = useMemo(() => {
    const index = rows.findIndex((row) => row.kind === "episode" && row.episode.id === currentEpisodeId);
    return index < 0 ? null : offsets[index];
  }, [rows, offsets, currentEpisodeId]);

  const getItemLayout = useCallback(
    (_: ArrayLike<Row> | null | undefined, index: number) => {
      const row = rows[index];
      return {
        length: row ? rowHeight(row) : EPISODE_BLOCK_HEIGHT,
        offset: offsets[index] ?? CONTENT_PADDING_TOP + EPISODE_BLOCK_HEIGHT * index,
        index,
      };
    },
    [rows, offsets],
  );

  /** Fires once the content is laid out, so the scroll always takes effect. */
  const handleContentSizeChange = useCallback(() => {
    if (hasScrolledRef.current || currentOffset === null) return;
    hasScrolledRef.current = true;
    listRef.current?.scrollToOffset({ offset: currentOffset, animated: true });
  }, [currentOffset]);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === "title") {
        return (
          <View style={styles.titleRow}>
            <SectionHeader title={t.series.episodesTitle} icon="albums-outline" inset={false} style={styles.header} />
          </View>
        );
      }

      if (item.kind === "season") {
        return (
          <View style={styles.seasonHeader}>
            <ThemedText variant="label" tabular>
              {t.series.season.replace("{n}", String(item.seasonNumber))}
            </ThemedText>
            <ThemedText variant="caption" tabular style={styles.seasonCount}>
              {t.series.episodeCount.replace("{n}", String(item.episodeCount))}
            </ThemedText>
          </View>
        );
      }

      const episode = item.episode;
      return (
        <View style={styles.episodeBlock}>
          <EpisodeRow
            episodeId={episode.id}
            title={episode.title}
            episodeNumber={episode.episodeNumber}
            durationMinutes={episode.duration}
            thumbnailUrl={episode.thumbnailUrl ?? episode.posterUrl}
            isCurrent={episode.id === currentEpisodeId}
            progressPercent={episode.watchProgress?.progressPercent ?? 0}
            onPress={onSelectEpisode}
          />
        </View>
      );
    },
    [t, currentEpisodeId, onSelectEpisode],
  );

  if (episodesQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (episodesQuery.isError) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={26} color={theme.colors.textFaint} />
        <ThemedText variant="muted">{t.series.episodesLoadError}</ThemedText>
      </View>
    );
  }

  if (seasons.every((s) => s.episodes.length === 0)) {
    return (
      <View style={styles.center}>
        <Ionicons name="albums-outline" size={26} color={theme.colors.textFaint} />
        <ThemedText variant="muted">{t.series.episodesEmpty}</ThemedText>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      onContentSizeChange={handleContentSizeChange}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingTop: CONTENT_PADDING_TOP,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.sm,
  },
  titleRow: { height: TITLE_HEIGHT, justifyContent: "center" },
  header: { paddingHorizontal: theme.spacing.sm, marginBottom: 0 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  seasonHeader: {
    height: SEASON_HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  seasonCount: { color: theme.colors.textFaint },
  episodeBlock: { height: EPISODE_BLOCK_HEIGHT, paddingBottom: ROW_GAP },
});
