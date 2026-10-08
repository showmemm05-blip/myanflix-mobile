import { useCallback, useMemo } from "react";
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
  type SectionListData,
  type SectionListRenderItemInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimatedRef, useReducedMotion, useScrollOffset } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressableScale } from "@/components/ui/PressableScale";
import { Skeleton } from "@/components/common/Skeleton";
import { ListFooterSpinner } from "@/components/common/ListFooterSpinner";
import { TopBar } from "@/components/layout/TopBar";
import { GlassBarBackground, GlassTarget, useGlassBar } from "@/components/layout/GlassBar";
import { PageHeading } from "@/components/library/PageHeading";
import { ErrorBlock, HaloIcon, StateBlock } from "@/components/library/LibraryState";
import { groupByDay, type DayGroup } from "@/components/library/historyFormat";
import {
  useNotificationsInfinite,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useUnreadNotificationCount,
} from "@/hooks/useNotifications";
import { LIST_PAGE_SIZE, flattenPages } from "@/hooks/pagination";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";
import type { RootStackParamList } from "@/navigation/types";
import type { AppNotification, NotificationType } from "@/types/notification";

type Props = NativeStackScreenProps<RootStackParamList, "Notifications">;

const TYPE_ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  PURCHASE: "receipt-outline",
  SUBSCRIPTION: "star-outline",
  PAYMENT: "card-outline",
  NEW_RELEASE: "film-outline",
  PROMOTION: "pricetag-outline",
  ANNOUNCEMENT: "megaphone-outline",
  DEPOSIT_APPROVED: "checkmark-circle-outline",
  DEPOSIT_REJECTED: "close-circle-outline",
  WITHDRAWAL_APPROVED: "arrow-up-circle-outline",
  WITHDRAWAL_REJECTED: "close-circle-outline",
  BALANCE_ADJUSTED: "wallet-outline",
};

/**
 * Notifications.dc.html: money news is green, premium is gold, rejections are
 * red, purchases and announcements are info blue, new releases crimson, and a
 * balance adjustment amber. The glyph is drawn in the tone; the 44pt disc
 * under it is the same tone at 14%.
 */
const TYPE_TONES: Record<NotificationType, string> = {
  PURCHASE: theme.colors.info,
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

type Section = DayGroup<AppNotification>;

/** The row's date line keeps the app's own short date, as the heading does. */
const dateOf = (item: AppNotification) => item.createdAt;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString();

/**
 * Module scope on purpose — SectionList's cells are PureComponents, so an
 * inline extractor, separator or section header would re-render every visible
 * row each time a page lands. Nothing in these reads screen state.
 */
const keyExtractor = (item: AppNotification) => item.id;
const Separator = () => <View style={styles.separator} />;
const renderSectionHeader = ({ section }: { section: SectionListData<AppNotification, Section> }) => (
  <View style={styles.sectionHeader}>
    <ThemedText variant="caption" weight="extrabold" tabular color={theme.colors.textMuted} accessibilityRole="header">
      {section.title}
    </ThemedText>
    <View style={styles.sectionRule} />
  </View>
);

export function NotificationsScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  // Paged, newest first: a screenful at a time and no ceiling on how far back
  // the feed reaches.
  const notificationsQuery = useNotificationsInfinite({ limit: LIST_PAGE_SIZE });
  // The bell's own count (already cached by the app bar) — the "N unread" line.
  const unreadQuery = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = useMemo(() => flattenPages(notificationsQuery.data?.pages), [notificationsQuery.data]);
  // The glass bar (components/layout/GlassBar): the bar floats over the feed,
  // transparent at the top, frosted once the rows scroll under it.
  const glass = useGlassBar();
  const listRef = useAnimatedRef<SectionList<AppNotification, Section>>();
  useScrollOffset(listRef, glass.scrollY);

  // Purely presentational grouping: the feed is bucketed by calendar day in
  // the order the API already returned it — no sorting, no filtering. Runs
  // over the FLATTENED pages, so a day that straddles a page boundary is one
  // section, not two.
  const sections = useMemo<Section[]>(() => groupByDay(items, dateOf, shortDate), [items]);

  const unreadCount = unreadQuery.data;
  const anyLoadedUnread = useMemo(() => items.some((item) => !item.isRead), [items]);
  /**
   * "All read" only when BOTH the server's count and the loaded rows agree —
   * a stale count must never hide the button while an unread row is on screen.
   */
  const allRead = unreadCount === 0 && !anyLoadedUnread;
  const unreadLine =
    typeof unreadCount === "number"
      ? unreadCount > 0
        ? t.notifications.unreadCount.replace("{n}", String(unreadCount))
        : allRead
          ? t.notifications.allRead
          : null
      : null;

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
        progressViewOffset={glass.barHeight}
      />
    ),
    [notificationsQuery.isRefetching, notificationsQuery.isFetchingNextPage, notificationsQuery.refetch, glass.barHeight],
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
      const date = shortDate(item.createdAt);
      return (
        <PressableScale
          onPress={() => !item.isRead && markOneRead(item.id)}
          // Unread first, then everything the row shows — the dot and the
          // bold title are visual only.
          accessibilityLabel={[item.isRead ? null : t.notifications.unread, item.title, item.message, date]
            .filter(Boolean)
            .join(". ")}
          style={[styles.row, !item.isRead && styles.rowUnread]}
        >
          <View
            style={[
              styles.iconDisc,
              { backgroundColor: item.isRead ? theme.colors.tonalSoft : withAlpha(tone, 0.14) },
            ]}
          >
            {/* Crimson glyphs read as `link` on their tint (5.6:1). */}
            <Ionicons
              name={icon}
              size={22}
              color={item.isRead ? theme.colors.textFaint : tone === theme.colors.primary ? theme.colors.link : tone}
            />
          </View>
          <View style={styles.info}>
            <View style={styles.titleRow}>
              <ThemedText
                variant="body"
                weight={item.isRead ? "semibold" : "extrabold"}
                color={item.isRead ? theme.colors.textBody : theme.colors.text}
                style={styles.title}
              >
                {item.title}
              </ThemedText>
              {!item.isRead && <View style={styles.dot} />}
            </View>
            <ThemedText variant="muted" color={theme.colors.textMuted} numberOfLines={2} style={styles.message}>
              {item.message}
            </ThemedText>
            <ThemedText variant="caption" weight="regular" tabular color={theme.colors.textFaint} style={styles.date}>
              {date}
            </ThemedText>
          </View>
        </PressableScale>
      );
    },
    [markOneRead, t],
  );

  /**
   * The "next page is on the wire" dots — memoized so its element identity (a
   * list prop) only moves with the flag.
   */
  const listFooter = useMemo(
    () => <ListFooterSpinner visible={notificationsQuery.isFetchingNextPage} />,
    [notificationsQuery.isFetchingNextPage],
  );

  const isReady = !notificationsQuery.isLoading && !notificationsQuery.isError && items.length > 0;

  const markAll = markAllRead.mutate;
  const listHeader = useMemo(
    () => (
      <View>
        <PageHeading title={t.notifications.title} />
        {isReady && (
          <View style={styles.statusRow}>
            <ThemedText
              variant="caption"
              weight="regular"
              tabular
              color={theme.colors.textMuted}
              accessibilityLiveRegion="polite"
              style={styles.unreadLine}
            >
              {unreadLine ?? ""}
            </ThemedText>
            {/* Same mutation as the old bar button; it rests grey and inert once
                there is nothing left to mark. */}
            <Pressable
              onPress={() => markAll()}
              disabled={allRead}
              accessibilityRole="button"
              accessibilityLabel={t.notifications.markAllRead}
              accessibilityState={{ disabled: allRead }}
              style={({ pressed }) => [
                styles.markAll,
                pressed && !allRead && (reduceMotion ? styles.pressedStill : styles.pressed),
              ]}
            >
              <Ionicons name="checkmark-done" size={18} color={allRead ? theme.colors.textFaint : theme.colors.link} />
              <ThemedText
                variant="muted"
                weight="extrabold"
                color={allRead ? theme.colors.textFaint : theme.colors.link}
                style={styles.markAllLabel}
              >
                {t.notifications.markAllRead}
              </ThemedText>
            </Pressable>
          </View>
        )}
      </View>
    ),
    [isReady, unreadLine, allRead, reduceMotion, markAll, t],
  );

  const listEmpty = notificationsQuery.isLoading ? (
    // A day heading and six rows the shape of a real one, so the first page
    // lands on top of the placeholders without a shift.
    <View style={styles.skeletonList} accessibilityLabel={t.common.loading}>
      <Skeleton width={84} height={11} radius="sm" />
      {[0, 1, 2, 3, 4, 5].map((key) => (
        <View key={key} style={styles.skeletonRow}>
          <Skeleton width={44} height={44} radius="pill" />
          <View style={styles.skeletonText}>
            <Skeleton width={160} height={14} radius="xs" />
            <Skeleton height={11} radius="xs" style={styles.skeletonLine} />
            <Skeleton width="70%" height={11} radius="xs" style={styles.skeletonLineShort} />
          </View>
        </View>
      ))}
    </View>
  ) : notificationsQuery.isError ? (
    <ErrorBlock message={t.common.somethingWentWrong} style={styles.stateBlock} />
  ) : (
    <StateBlock
      art={<HaloIcon icon="notifications-outline" />}
      title={t.notifications.empty}
      size="section"
      style={styles.stateBlock}
    />
  );

  return (
    <View style={styles.container}>
      <GlassTarget targetRef={glass.blurTarget}>
        <SectionList
          ref={listRef}
          sections={isReady ? sections : []}
          keyExtractor={keyExtractor}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={listFooter}
          // The page starts under the floating bar and scrolls up beneath it.
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: glass.barHeight, paddingBottom: insets.bottom + theme.spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          stickySectionHeadersEnabled={false}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          refreshControl={isReady ? refreshControl : undefined}
          onEndReachedThreshold={0.6}
          onEndReached={endReached}
          renderSectionHeader={renderSectionHeader}
          ItemSeparatorComponent={Separator}
          renderItem={renderItem}
        />
      </GlassTarget>

      <GlassBarBackground scrollY={glass.scrollY} height={glass.barHeight} blurTarget={glass.blurTarget} />
      <TopBar
        floating
        touchThrough
        onLayout={glass.onBarLayout}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t.common.back}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  listContent: { flexGrow: 1 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: theme.spacing.md,
    minHeight: theme.layout.minTouch,
    marginTop: theme.spacing.sm,
    paddingLeft: theme.layout.screenPadding,
    paddingRight: theme.spacing.xs,
  },
  unreadLine: { flexShrink: 1 },
  markAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: theme.layout.minTouch,
    paddingHorizontal: 12,
    marginLeft: "auto",
    maxWidth: "100%",
  },
  /** Wraps (long Burmese at a large font) instead of running off the row. */
  markAllLabel: { flexShrink: 1 },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.7 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    marginHorizontal: theme.layout.screenPadding,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  separator: { height: theme.spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginHorizontal: theme.spacing.xs,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  /** Unread rows sit on a faint raised fill; read rows lie flat on the page. */
  rowUnread: { backgroundColor: withAlpha(theme.colors.text, 0.05) },
  iconDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  title: { flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary },
  message: { marginTop: 2 },
  /**
   * 12pt — size only, so a my-MM date (Myanmar digits from
   * toLocaleDateString) keeps ThemedText's Burmese line-height bonus.
   */
  date: { marginTop: theme.spacing.xs, fontSize: 12 },
  skeletonList: { paddingHorizontal: theme.layout.screenPadding, paddingTop: 22 },
  skeletonRow: { flexDirection: "row", gap: 14, paddingTop: 18, paddingBottom: 14 },
  skeletonText: { flex: 1, paddingTop: 4 },
  skeletonLine: { marginTop: 12 },
  skeletonLineShort: { marginTop: 8 },
  stateBlock: { marginTop: 96 },
});
