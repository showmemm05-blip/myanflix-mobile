import { useCallback, useMemo } from "react";
import {
  RefreshControl,
  SectionList,
  View,
  StyleSheet,
  type SectionListData,
  type SectionListRenderItemInfo,
} from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ui/ThemedText";
import { EmptyState } from "@/components/ui/EmptyState";
import { PressableScale } from "@/components/ui/PressableScale";
import { Surface } from "@/components/ui/Surface";
import { AuroraBackdrop } from "@/components/common/AuroraBackdrop";
import { Skeleton } from "@/components/common/Skeleton";
import { ListFooterSpinner } from "@/components/common/ListFooterSpinner";
import { TopBar } from "@/components/layout/TopBar";
import {
  useNotificationsInfinite,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useNotifications";
import { LIST_PAGE_SIZE, flattenPages } from "@/hooks/pagination";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";
import type { RootStackParamList } from "@/navigation/types";
import type { AppNotification, NotificationType } from "@/types/notification";

type Props = NativeStackScreenProps<RootStackParamList, "Notifications">;

const TYPE_ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  PURCHASE: "receipt",
  SUBSCRIPTION: "star",
  PAYMENT: "card",
  NEW_RELEASE: "film",
  PROMOTION: "pricetag",
  ANNOUNCEMENT: "megaphone",
  DEPOSIT_APPROVED: "checkmark-circle",
  DEPOSIT_REJECTED: "close-circle",
  WITHDRAWAL_APPROVED: "arrow-up-circle",
  WITHDRAWAL_REJECTED: "close-circle",
  BALANCE_ADJUSTED: "wallet",
};

/** Money news is emerald, premium is gold, rejections are red, the rest violet/sky. */
const TYPE_TONES: Record<NotificationType, string> = {
  PURCHASE: theme.colors.primary,
  SUBSCRIPTION: theme.colors.premium,
  PAYMENT: theme.colors.finance,
  NEW_RELEASE: theme.colors.primary,
  PROMOTION: theme.colors.premium,
  ANNOUNCEMENT: theme.colors.info,
  DEPOSIT_APPROVED: theme.colors.finance,
  DEPOSIT_REJECTED: theme.colors.danger,
  WITHDRAWAL_APPROVED: theme.colors.finance,
  WITHDRAWAL_REJECTED: theme.colors.danger,
  BALANCE_ADJUSTED: theme.colors.warning,
};

interface Section {
  title: string;
  data: AppNotification[];
}

/**
 * Module scope on purpose — SectionList's cells are PureComponents, so an
 * inline extractor, separator or section header would re-render every visible
 * row each time a page lands. Nothing in these reads screen state.
 */
const keyExtractor = (item: AppNotification) => item.id;
const Separator = () => <View style={styles.separator} />;
const renderSectionHeader = ({ section }: { section: SectionListData<AppNotification, Section> }) => (
  <View style={styles.sectionHeader}>
    <ThemedText variant="overline" tabular>
      {section.title}
    </ThemedText>
    <View style={styles.sectionRule} />
  </View>
);

export function NotificationsScreen({ navigation }: Props) {
  const { t } = useLanguage();
  // Paged, newest first: a screenful at a time and no ceiling on how far back
  // the feed reaches.
  const notificationsQuery = useNotificationsInfinite({ limit: LIST_PAGE_SIZE });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = useMemo(() => flattenPages(notificationsQuery.data?.pages), [notificationsQuery.data]);

  // Purely presentational grouping: the feed is bucketed by calendar day in
  // the order the API already returned it — no sorting, no filtering. Runs
  // over the FLATTENED pages, so a day that straddles a page boundary is one
  // section, not two.
  const sections = useMemo<Section[]>(() => {
    const grouped: Section[] = [];
    for (const item of items) {
      const title = new Date(item.createdAt).toLocaleDateString();
      const last = grouped[grouped.length - 1];
      if (last && last.title === title) last.data.push(item);
      else grouped.push({ title, data: [item] });
    }
    return grouped;
  }, [items]);

  /**
   * Stable identities for SectionList (a PureComponent): a fresh arrow or a
   * fresh `<RefreshControl>` element per render would force a whole
   * VirtualizedList pass every time a page lands. A pull refetches every
   * loaded page; its spinner is that refetch only, never the next-page fetch,
   * which has the footer below.
   */
  const endReached = useCallback(() => {
    if (notificationsQuery.hasNextPage && !notificationsQuery.isFetchingNextPage) notificationsQuery.fetchNextPage();
  }, [notificationsQuery.hasNextPage, notificationsQuery.isFetchingNextPage, notificationsQuery.fetchNextPage]);

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={notificationsQuery.isRefetching && !notificationsQuery.isFetchingNextPage}
        onRefresh={() => notificationsQuery.refetch()}
        tintColor={theme.colors.primary}
        colors={[theme.colors.primary]}
        progressBackgroundColor={theme.colors.surface}
      />
    ),
    [notificationsQuery.isRefetching, notificationsQuery.isFetchingNextPage, notificationsQuery.refetch],
  );

  // `markRead.mutate` is bound once by the mutation observer, so this holds
  // across renders and the rows stay still while a page lands.
  const markOneRead = markRead.mutate;
  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<AppNotification, Section>) => {
      // A type this build has never heard of is normal: the server's
      // enum outlives an installed binary. Falling back keeps the row
      // readable, and withAlpha() (never string concatenation) keeps
      // the value a valid colour.
      const tone = TYPE_TONES[item.type] ?? theme.colors.textMuted;
      const icon = TYPE_ICONS[item.type] ?? "notifications-outline";
      return (
        <PressableScale onPress={() => !item.isRead && markOneRead(item.id)} accessibilityLabel={item.title}>
          <Surface radius="xl" tone={item.isRead ? "flat" : "default"} style={styles.row}>
            {!item.isRead && <View style={styles.unreadBar} />}
            <View
              style={[styles.iconTile, { backgroundColor: withAlpha(tone, 0.12), borderColor: withAlpha(tone, 0.2) }]}
            >
              <Ionicons name={icon} size={18} color={item.isRead ? theme.colors.textMuted : tone} />
            </View>
            <View style={styles.info}>
              <View style={styles.titleRow}>
                <ThemedText
                  variant="body"
                  weight={item.isRead ? "regular" : "semibold"}
                  numberOfLines={1}
                  style={styles.title}
                >
                  {item.title}
                </ThemedText>
                {!item.isRead && <View style={styles.dot} />}
              </View>
              <ThemedText variant="caption" style={styles.message} numberOfLines={2}>
                {item.message}
              </ThemedText>
              <ThemedText variant="caption" tabular style={styles.date}>
                {new Date(item.createdAt).toLocaleDateString()}
              </ThemedText>
            </View>
          </Surface>
        </PressableScale>
      );
    },
    [markOneRead],
  );

  /**
   * Spinner while the next page streams in under the user's thumb — memoized
   * so its element identity (a FlatList prop) only moves with the flag.
   */
  const listFooter = useMemo(
    () => <ListFooterSpinner visible={notificationsQuery.isFetchingNextPage} />,
    [notificationsQuery.isFetchingNextPage],
  );

  return (
    <View style={styles.container}>
      <AuroraBackdrop tone="violet" height={340} intensity={0.55} />
      <TopBar
        title={t.notifications.title}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t.common.back}
        rightIcon="checkmark-done"
        onRightPress={() => markAllRead.mutate()}
        rightAccessibilityLabel={t.notifications.markAllRead}
      />

      {notificationsQuery.isLoading ? (
        // Five blocks the height of a resting row (minHeight 84) under a
        // day-header's worth of space, so the first page lands without a shift.
        <View style={styles.skeletonList}>
          <View style={styles.sectionHeader}>
            <Skeleton width={84} height={11} radius="sm" />
            <View style={styles.sectionRule} />
          </View>
          {[0, 1, 2, 3, 4].map((key) => (
            <Skeleton key={key} height={84} radius="xl" />
          ))}
        </View>
      ) : notificationsQuery.isError ? (
        <EmptyState message={t.common.somethingWentWrong} icon="alert-circle-outline" tone={theme.colors.danger} />
      ) : items.length === 0 ? (
        <EmptyState message={t.notifications.empty} icon="notifications-outline" />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          ListFooterComponent={listFooter}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          refreshControl={refreshControl}
          onEndReachedThreshold={0.6}
          onEndReached={endReached}
          renderSectionHeader={renderSectionHeader}
          ItemSeparatorComponent={Separator}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  /** Same inset as the list's content, so the placeholder rows sit where the real ones will. */
  skeletonList: { paddingHorizontal: theme.layout.screenPadding, paddingTop: theme.spacing.xs, gap: theme.spacing.sm },
  listContent: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xxl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  separator: { height: theme.spacing.sm },
  row: { flexDirection: "row", gap: theme.spacing.md, padding: theme.spacing.md, overflow: "hidden", minHeight: 84 },
  /** Violet spine on unread items — readable without relying on the dot alone. */
  unreadBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: theme.colors.primary },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { flex: 1 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.colors.primary },
  message: { color: theme.colors.textMuted },
  date: { color: theme.colors.textFaint, marginTop: 2 },
});
