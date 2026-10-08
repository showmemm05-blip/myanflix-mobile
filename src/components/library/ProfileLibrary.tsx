import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button } from "@/components/ui/Button";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { CollectionBanner } from "@/components/library/LibraryCards";
import { PosterThumb } from "@/components/library/PosterThumb";
import { historyA11yLabel, historyStatusLine, isWatched, percentOf } from "@/components/library/historyFormat";
import type { FavoriteTitle } from "@/components/library/favoriteTitles";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";
import type { WatchHistoryEntry } from "@/types/video";

/** How many titles a row shows before "See all" takes over. */
export const LIBRARY_ROW_LIMIT = 10;
/** A row's poster: 104pt wide, 2:3. */
const POSTER_WIDTH = 104;
const POSTER_GAP = 12;
/** Skeleton posters while a row loads — enough to run off a 430pt phone. */
const SKELETON_COUNT = 4;

/** What the Favorites row needs from useFavoriteTitles. */
export interface FavoritesRowData {
  titles: FavoriteTitle[];
  savedCount: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/** What the Watch History row needs from the shared watch-history pages. */
export interface HistoryRowData {
  entries: WatchHistoryEntry[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Profile's "Your library" group (owner, 2026-10-07): the Library tab is
 * gone (the dock is Home · Media · Wallet), and what it held comes back here,
 * between the profile header and the settings. Three parts, using the data
 * the Favorites and Watch History pages already load (so "See all" opens
 * them straight from the cache):
 *  - My List: the saved posters (the Favorites list), newest first, up to
 *    ten — named "My List" as the owner asked, the same word as the "My List"
 *    button on the Media hero; "See all" opens the Favorites page;
 *  - Watch History: the latest titles played, each with its progress line;
 *  - Downloads & Cache: the same "coming soon" banner the Library page had.
 * Every row keeps its "See all" in every state, so the full pages are always
 * one tap away — empty, loading or failed.
 */
export function ProfileLibrary({
  favorites,
  history,
  onOpenFavorites,
  onOpenHistory,
  onOpenDownloads,
  onOpenTitle,
  onOpenMovie,
}: {
  favorites: FavoritesRowData;
  history: HistoryRowData;
  onOpenFavorites: () => void;
  onOpenHistory: () => void;
  onOpenDownloads: () => void;
  onOpenTitle: (item: FavoriteTitle) => void;
  onOpenMovie: (movieId: string) => void;
}) {
  const { t } = useLanguage();
  const favoriteItems = favorites.titles.slice(0, LIBRARY_ROW_LIMIT);
  const historyItems = history.entries.slice(0, LIBRARY_ROW_LIMIT);

  let favoritesBody: ReactNode;
  if (favorites.isLoading) {
    favoritesBody = <RowSkeleton />;
  } else if (favoriteItems.length > 0) {
    favoritesBody = (
      <PosterRow>
        {favoriteItems.map((item) => (
          <PressableScale
            key={item.id}
            onPress={() => onOpenTitle(item)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            style={styles.item}
          >
            <PosterThumb uri={item.posterUrl ?? item.coverUrl} width={POSTER_WIDTH} />
            <ThemedText variant="caption" weight="bold" numberOfLines={1} style={styles.itemTitle}>
              {item.title}
            </ThemedText>
          </PressableScale>
        ))}
      </PosterRow>
    );
  } else if (favorites.isError) {
    favoritesBody = <RowError onRetry={favorites.refetch} />;
  } else if (favorites.savedCount > 0) {
    // Saved ids none of which could be matched to a title on this page of the
    // catalogue: say how many are saved rather than claim there are none.
    favoritesBody = (
      <RowNotice icon="heart-outline" text={t.library.savedCount.replace("{n}", String(favorites.savedCount))} />
    );
  } else {
    favoritesBody = <RowNotice icon="heart-outline" text={t.profile.favoritesRowEmpty} />;
  }

  let historyBody: ReactNode;
  if (history.isLoading) {
    historyBody = <RowSkeleton withMeta />;
  } else if (historyItems.length > 0) {
    historyBody = (
      <PosterRow>
        {historyItems.map((entry) => {
          const watched = isWatched(entry);
          return (
            <PressableScale
              key={entry.id}
              onPress={() => onOpenMovie(entry.movieId)}
              accessibilityRole="button"
              accessibilityLabel={historyA11yLabel(entry, t)}
              style={styles.item}
            >
              <PosterThumb
                uri={entry.posterUrl}
                width={POSTER_WIDTH}
                shade
                progress={percentOf(entry) / 100}
                progressColor={watched ? theme.colors.textFaint : theme.colors.primary}
              />
              <ThemedText variant="caption" weight="bold" numberOfLines={1} style={styles.itemTitle}>
                {entry.movieTitle}
              </ThemedText>
              <ThemedText variant="caption" weight="regular" tabular numberOfLines={1} color={theme.colors.textFaint}>
                {historyStatusLine(entry, t)}
              </ThemedText>
            </PressableScale>
          );
        })}
      </PosterRow>
    );
  } else if (history.isError) {
    historyBody = <RowError onRetry={history.refetch} />;
  } else {
    historyBody = <RowNotice icon="time-outline" text={t.library.historyEmptyBody} />;
  }

  return (
    <View>
      <ThemedText variant="section" accessibilityRole="header" style={styles.groupTitle}>
        {t.profile.yourLibrary}
      </ThemedText>

      <View style={styles.row}>
        <RowHeader icon="heart" title={t.profile.myList} onSeeAll={onOpenFavorites} />
        {favoritesBody}
      </View>

      <View style={styles.row}>
        <RowHeader icon="time-outline" title={t.profile.watchHistory} onSeeAll={onOpenHistory} />
        {historyBody}
      </View>

      {/* Unchanged from the Library page: still the placeholder (owner,
          2026-10-02) — there is no downloads feature yet. */}
      <View style={styles.downloads}>
        <CollectionBanner
          icon="download-outline"
          iconColor={theme.colors.textMuted}
          title={t.settings.downloads}
          titleColor={theme.colors.textBody}
          meta={t.settings.downloadsComingSoon}
          trailing={
            <View style={styles.offlineDisc}>
              <Ionicons name="cloud-offline-outline" size={26} color={theme.colors.textFaint} />
            </View>
          }
          onPress={onOpenDownloads}
          accessibilityLabel={`${t.settings.downloads}, ${t.settings.downloadsComingSoon}`}
        />
      </View>
    </View>
  );
}

/** A row's name with its glyph, and the "See all" link on the right. */
function RowHeader({
  icon,
  title,
  onSeeAll,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onSeeAll: () => void;
}) {
  const { t } = useLanguage();
  return (
    <View style={styles.header}>
      <View style={styles.headerTitle}>
        <Ionicons name={icon} size={18} color={theme.colors.link} />
        <ThemedText variant="body" weight="extrabold" style={styles.headerText} accessibilityRole="header">
          {title}
        </ThemedText>
      </View>
      <Pressable
        onPress={onSeeAll}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t.profile.seeAllNamed.replace("{name}", title)}
        style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
      >
        <ThemedText variant="muted" weight="extrabold" color={theme.colors.link}>
          {t.common.seeAll}
        </ThemedText>
        <Ionicons name="chevron-forward" size={14} color={theme.colors.link} />
      </Pressable>
    </View>
  );
}

/** The sideways-scrolling strip of posters, edge to edge with the page's inset. */
function PosterRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {children}
    </ScrollView>
  );
}

/** A row's loading state: the posters (and their lines) as pulsing blocks. */
function RowSkeleton({ withMeta }: { withMeta?: boolean }) {
  const { t } = useLanguage();
  return (
    <View style={[styles.strip, styles.skeletonStrip]} accessible accessibilityLabel={t.common.loading}>
      {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
        <View key={index} style={styles.item}>
          <Skeleton width={POSTER_WIDTH} height={Math.round(POSTER_WIDTH * 1.5)} radius="card" />
          <Skeleton width={POSTER_WIDTH - 20} height={12} radius="xs" style={styles.skeletonLine} />
          {withMeta ? <Skeleton width={POSTER_WIDTH - 40} height={10} radius="xs" style={styles.skeletonLine} /> : null}
        </View>
      ))}
    </View>
  );
}

/** A quiet panel in place of the posters: the row is empty. */
function RowNotice({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.notice}>
      <Ionicons name={icon} size={22} color={theme.colors.textFaint} />
      <ThemedText variant="muted" color={theme.colors.textMuted} style={styles.noticeText}>
        {text}
      </ThemedText>
    </View>
  );
}

/** The row could not load: say so, and offer to try again. */
function RowError({ onRetry }: { onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={[styles.notice, styles.noticeWrap]}>
      <View style={styles.noticeMain} accessible accessibilityRole="alert">
        <Ionicons name="alert-circle-outline" size={22} color={theme.colors.danger} />
        <ThemedText variant="muted" color={theme.colors.textMuted} style={styles.noticeText}>
          {t.common.somethingWentWrong}
        </ThemedText>
      </View>
      <Button title={t.common.retry} onPress={onRetry} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: { paddingHorizontal: theme.layout.screenPadding },
  row: { marginTop: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.layout.screenPadding,
    marginBottom: theme.spacing.xs,
  },
  headerTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  headerText: { flexShrink: 1 },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: theme.layout.minTouch,
    paddingLeft: theme.spacing.sm,
  },
  pressed: { opacity: 0.7 },
  strip: { flexDirection: "row", gap: POSTER_GAP, paddingHorizontal: theme.layout.screenPadding },
  /** The loading strip is cut at the page's edge, like a real row running off it. */
  skeletonStrip: { overflow: "hidden" },
  item: { width: POSTER_WIDTH },
  itemTitle: { marginTop: theme.spacing.sm },
  skeletonLine: { marginTop: theme.spacing.sm },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 72,
    marginHorizontal: theme.layout.screenPadding,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: withAlpha(theme.colors.text, 0.04),
  },
  /** An error panel: the message, and Retry beside it — or under it when there is no room. */
  noticeWrap: { flexWrap: "wrap", rowGap: 10 },
  noticeMain: { flexDirection: "row", alignItems: "center", gap: 12, flexGrow: 1, flexShrink: 1, flexBasis: 160 },
  noticeText: { flex: 1, minWidth: 0 },
  downloads: { marginTop: 20, paddingHorizontal: theme.layout.screenPadding },
  offlineDisc: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.tonalSoft,
  },
});
