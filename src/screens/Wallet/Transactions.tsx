import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  FlatList,
  Keyboard,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
} from "react-native";
import Animated, {
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useScrollOffset,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SearchField } from "@/components/ui/SearchField";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { ListFooterSpinner } from "@/components/common/ListFooterSpinner";
import { AppBarAction } from "@/components/layout/AppBar";
import { GlassBarBackground, GlassTarget, useGlassBar } from "@/components/layout/GlassBar";
import { ActivityRowSkeleton } from "@/components/wallet/ActivityRow";
import { DayHeader } from "@/components/wallet/DayHeader";
import { DepositRow } from "@/components/wallet/DepositRow";
import {
  HistoryFilters,
  NO_FILTERS,
  activeFilterCount,
  isRequestStatus,
  type FilterGroupKey,
  type SegmentFilters,
} from "@/components/wallet/HistoryFilters";
import { ListState } from "@/components/wallet/ListState";
import { FlowButton } from "@/components/wallet/MoneyFlow";
import { useActivitySegments, type ActivitySegment } from "@/components/wallet/RecentActivity";
import { TransactionRow, ledgerTypeLabel } from "@/components/wallet/TransactionRow";
import { UnderlineTabs } from "@/components/wallet/UnderlineTabs";
import { TextAction } from "@/components/wallet/TextAction";
import { WalletFilterSheet } from "@/components/wallet/WalletFilterSheet";
import { WithdrawalRow } from "@/components/wallet/WithdrawalRow";
import { useTransactionsInfinite } from "@/hooks/useWallet";
import { useDepositsInfinite } from "@/hooks/useDeposits";
import { useWithdrawalsInfinite } from "@/hooks/useWithdrawals";
import { useDockClearance } from "@/hooks/useDockClearance";
import { useWalletAnnouncements } from "@/hooks/useWalletAnnouncements";
import { ROW_INSET, useWalletLayout } from "@/hooks/useWalletLayout";
import { LIST_PAGE_SIZE, flattenPages } from "@/hooks/pagination";
import { useLanguage } from "@/localization/LanguageProvider";
import { useWalletPrefsStore } from "@/store/walletPrefsStore";
import { dayLabel, positionIn, withDayHeaders, type DayListItem } from "@/utils/walletDates";
import { matchesDeposit, matchesLedger, matchesWithdrawal } from "@/utils/walletFilters";
import { theme } from "@/theme";
import type { WalletStackParamList } from "@/navigation/types";
import type { RequestListParams } from "@/types/api";
import type { Deposit } from "@/types/deposit";
import type { Transaction } from "@/types/wallet";
import type { Withdrawal } from "@/types/withdrawal";

type Props = NativeStackScreenProps<WalletStackParamList, "Transactions">;

/** The readable column of the list on tablets. */
const LIST_MAX_WIDTH = 760;
const SKELETON_ROWS = 6;

/**
 * The pinned header (back row, large title, search, ledger tabs) may take at
 * most this share of the window. On a small phone at a large text size it
 * would take far more and leave a sliver of list above the dock, so there the
 * large title moves up beside the back button instead.
 */
const PINNED_MAX_SHARE = 0.4;
/** The back row: the 44pt target with 6pt above and below. */
const BACK_ROW = 6 + theme.layout.minTouch + 6;
/** The large title's font-scale cap (its maxFontSizeMultiplier). */
const TITLE_MAX_SCALE = 1.4;
/** ThemedText's extra line height for Burmese. */
const MYANMAR_LINE_BONUS = 4;
/** Search (56pt field + 16pt above and below) + the 48pt tab track, until measured. */
const PINNED_REST_ESTIMATE = 56 + 2 * 16 + 48;

const EMPTY_FILTERS: Record<ActivitySegment, SegmentFilters> = {
  all: NO_FILTERS,
  deposit: NO_FILTERS,
  withdraw: NO_FILTERS,
};

/**
 * The list rows' opacity: 1, or 0.5 while a superseded filter's rows stay on
 * screen until the new ones land. Only the rows read it — the header with the
 * chips the user just tapped, and the footer, stay at full strength.
 */
const RowDim = createContext<SharedValue<number> | null>(null);

function DimmedCell({ children }: { children: ReactNode }) {
  const dim = useContext(RowDim);
  const style = useAnimatedStyle(() => ({ opacity: dim ? dim.value : 1 }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * Module scope on purpose — handed to FlatList, whose cells are PureComponents,
 * so an inline extractor or renderer would re-render every visible row each
 * time a page lands. The rows read language and layout themselves, and the dim
 * comes through context, so none of these needs screen state.
 */
const keyExtractor = (item: { key: string }) => item.key;
const renderLedgerItem = ({ item }: ListRenderItemInfo<DayListItem<Transaction>>) => (
  <DimmedCell>
    {item.kind === "day" ? (
      <DayHeader label={item.label} />
    ) : (
      <TransactionRow transaction={item.row} position={item.position} />
    )}
  </DimmedCell>
);
const renderDepositItem = ({ item }: ListRenderItemInfo<DayListItem<Deposit>>) => (
  <DimmedCell>
    {item.kind === "day" ? (
      <DayHeader label={item.label} />
    ) : (
      <DepositRow deposit={item.row} position={item.position} />
    )}
  </DimmedCell>
);
const renderWithdrawalItem = ({ item }: ListRenderItemInfo<DayListItem<Withdrawal>>) => (
  <DimmedCell>
    {item.kind === "day" ? (
      <DayHeader label={item.label} />
    ) : (
      <WithdrawalRow withdrawal={item.row} position={item.position} />
    )}
  </DimmedCell>
);

/** Server params for a request list: page size plus the filters the server applies itself. */
function requestParams(filters: SegmentFilters): RequestListParams {
  return {
    limit: LIST_PAGE_SIZE,
    ...(isRequestStatus(filters.status) ? { status: filters.status } : {}),
    ...(filters.since ? { dateFrom: filters.since } : {}),
  };
}

export function TransactionsScreen({ navigation }: Props) {
  const { t, language } = useLanguage();
  const layout = useWalletLayout();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dockClearance = useDockClearance();
  /**
   * The glass bar (components/layout/GlassBar): back, the title, search and
   * the ledger tabs float over the list, transparent at the top and frosted
   * once rows scroll under them. One ref for whichever ledger list is
   * mounted — a tab switch remounts the list (its `key`), the ref re-attaches
   * to the new one, and the glass starts again from the top.
   */
  const glass = useGlassBar(BACK_ROW + PINNED_REST_ESTIMATE);
  // Untyped items, as in useHubScroll: one ref serves all three ledgers.
  const listRef = useAnimatedRef<FlatList>();
  useScrollOffset(listRef, glass.scrollY);
  const reduceMotion = useReducedMotion();
  const segments = useActivitySegments();
  const balanceHidden = useWalletPrefsStore((state) => state.balanceHidden);
  const [segment, setSegment] = useState<ActivitySegment>("all");
  // A new tab's list starts at the top (see `glass` above), so its glass does too.
  useEffect(() => {
    glass.scrollY.value = 0;
  }, [segment, glass.scrollY]);
  /** Per segment, so switching back restores what that ledger was filtered by. */
  const [filtersBySegment, setFiltersBySegment] = useState(EMPTY_FILTERS);
  /** One search term across the three ledgers. */
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  /** Which filter the phone's picker sheet is for; kept after close so it does not empty mid-slide. */
  const [sheetGroup, setSheetGroup] = useState<FilterGroupKey>("status");
  const filters = filtersBySegment[segment];
  const term = search.trim();

  const setFilters = useCallback(
    (next: SegmentFilters) => setFiltersBySegment((previous) => ({ ...previous, [segment]: next })),
    [segment],
  );
  const clearAll = useCallback(() => {
    setFiltersBySegment((previous) => ({ ...previous, [segment]: NO_FILTERS }));
    setSearch("");
  }, [segment]);

  /**
   * Three ledgers, three segments, each paged on its own; only the visible one
   * is on the wire, and a segment already visited keeps its pages in cache.
   * Deposits and withdrawals filter status and date on the server — with no
   * filter their params are exactly `{ limit: 30 }`, the key they always had.
   * The wallet ledger accepts page/limit only, so it never gets more.
   */
  const depositFilters = filtersBySegment.deposit;
  const withdrawalFilters = filtersBySegment.withdraw;
  const depositParams = useMemo(() => requestParams(depositFilters), [depositFilters]);
  const withdrawalParams = useMemo(() => requestParams(withdrawalFilters), [withdrawalFilters]);
  const transactionsQuery = useTransactionsInfinite({ limit: LIST_PAGE_SIZE }, { enabled: segment === "all" });
  const depositsQuery = useDepositsInfinite(depositParams, { enabled: segment === "deposit" });
  const withdrawalsQuery = useWithdrawalsInfinite(withdrawalParams, { enabled: segment === "withdraw" });
  const activeQuery =
    segment === "deposit" ? depositsQuery : segment === "withdraw" ? withdrawalsQuery : transactionsQuery;
  const { hasNextPage, isFetchingNextPage, fetchNextPage, refetch, isRefetching, isPlaceholderData } = activeQuery;

  const ledgerRows = useMemo(() => flattenPages(transactionsQuery.data?.pages), [transactionsQuery.data]);
  const depositRows = useMemo(() => flattenPages(depositsQuery.data?.pages), [depositsQuery.data]);
  const withdrawalRows = useMemo(() => flattenPages(withdrawalsQuery.data?.pages), [withdrawalsQuery.data]);

  // A status that settles while History is open (the socket refetches the
  // visible list) is spoken here too, not only on the Wallet screen.
  useWalletAnnouncements({
    hidden: balanceHidden,
    deposits: depositRows,
    withdrawals: withdrawalRows,
    ledger: ledgerRows,
  });

  /** The ledger's filters all run here, over the pages loaded so far (see utils/walletFilters). */
  const ledgerFilters = filtersBySegment.all;
  const sinceMs = ledgerFilters.since ? Date.parse(ledgerFilters.since) : null;
  const filteredLedger = useMemo(() => {
    const status = isRequestStatus(ledgerFilters.status) ? "all" : ledgerFilters.status;
    return ledgerRows.filter((tx) =>
      matchesLedger(
        tx,
        { typeGroup: ledgerFilters.typeGroup, status, sinceMs, q: term },
        ledgerTypeLabel(tx.type, t),
      ),
    );
  }, [ledgerRows, ledgerFilters, sinceMs, term, t]);
  const filteredDeposits = useMemo(
    () => (term ? depositRows.filter((deposit) => matchesDeposit(deposit, term)) : depositRows),
    [depositRows, term],
  );
  const filteredWithdrawals = useMemo(
    () => (term ? withdrawalRows.filter((withdrawal) => matchesWithdrawal(withdrawal, term)) : withdrawalRows),
    [withdrawalRows, term],
  );

  const labelFor = useCallback(
    (date: string) => dayLabel(date, language, { today: t.wallet.today, yesterday: t.wallet.yesterday }),
    [language, t],
  );
  const ledgerItems = useMemo(
    () => withDayHeaders(filteredLedger, (row) => row.createdAt, labelFor),
    [filteredLedger, labelFor],
  );
  const depositItems = useMemo(
    () => withDayHeaders(filteredDeposits, (row) => row.createdAt, labelFor),
    [filteredDeposits, labelFor],
  );
  const withdrawalItems = useMemo(
    () => withDayHeaders(filteredWithdrawals, (row) => row.createdAt, labelFor),
    [filteredWithdrawals, labelFor],
  );

  /**
   * Paging under a client-side filter. A filter over loaded pages can match
   * little or nothing, and an endless list that keeps fetching to fill the
   * screen would walk the whole ledger — so while filtering, more pages load
   * on request ("Load more"), not on scroll. One exception: a date range on
   * the newest-first ledger has a natural end — once the oldest loaded row is
   * older than the range start, every row in range is loaded — so a range
   * alone keeps loading on scroll until it reaches that point.
   */
  const loadedCount =
    segment === "deposit" ? depositRows.length : segment === "withdraw" ? withdrawalRows.length : ledgerRows.length;
  const filteredCount =
    segment === "deposit"
      ? filteredDeposits.length
      : segment === "withdraw"
        ? filteredWithdrawals.length
        : filteredLedger.length;
  const total = activeQuery.data?.pages[0]?.total;
  const filterCount = activeFilterCount(segment, filters);
  const ledgerClientFilter = segment === "all" && filterCount > 0;
  const clientFiltering = term !== "" || ledgerClientFilter;
  const oldestLoaded = ledgerRows[ledgerRows.length - 1]?.createdAt;
  const rangeCovered =
    segment === "all" && sinceMs !== null && oldestLoaded !== undefined && Date.parse(oldestLoaded) < sinceMs;
  const allRelevantLoaded = !hasNextPage || rangeCovered;
  const rangeOnly =
    segment === "all" &&
    term === "" &&
    filters.range !== "all" &&
    filters.status === "all" &&
    filters.typeGroup === "all";
  const autoLoad = !clientFiltering || (rangeOnly && !allRelevantLoaded);
  const canLoadMore = !autoLoad && !!hasNextPage && !allRelevantLoaded;

  const resultsLabel = (count: number) =>
    (count === 1 ? t.wallet.resultsCountOne : t.wallet.resultsCount).replace("{count}", String(count));

  // The count on the right of the filter bar, as the design always shows it.
  // While a new filter's rows are on their way (the old ones still showing,
  // dimmed), every count would describe the OLD filter: show none until they land.
  let summary: string | null = null;
  if (activeQuery.data && !isPlaceholderData) {
    if (clientFiltering) {
      summary = allRelevantLoaded
        ? resultsLabel(filteredCount)
        : t.wallet.loadedNote.replace("{loaded}", String(loadedCount)).replace("{total}", String(total ?? loadedCount));
    } else if (total !== undefined) {
      // Unfiltered, or deposits / withdrawals filtered by the server: its total is exact.
      summary = resultsLabel(total);
    }
  }
  /** Only a filter or a search is news worth announcing; switching tabs is not. */
  const announceable = clientFiltering || filterCount > 0;

  /**
   * iOS hears the new result count once the filter or search settles (Android
   * already speaks the summary's polite live region). Keyed on the filter, not
   * the count, so loading another page is not announced.
   */
  const filterKey = `${segment}|${filters.status}|${filters.range}|${filters.typeGroup}|${term}`;
  const announcedKey = useRef(filterKey);
  useEffect(() => {
    if (Platform.OS !== "ios" || isPlaceholderData || !summary || !announceable || announcedKey.current === filterKey) {
      return;
    }
    const timer = setTimeout(() => {
      announcedKey.current = filterKey;
      AccessibilityInfo.announceForAccessibility(summary);
    }, 600);
    return () => clearTimeout(timer);
  }, [filterKey, summary, announceable, isPlaceholderData]);

  /**
   * Stable identities for FlatList (a PureComponent): a fresh arrow or element
   * per render would force a whole VirtualizedList pass every time a page
   * lands. query-core binds `refetch` and `fetchNextPage` in the observer
   * constructor, so they hold.
   */
  const endReached = useCallback(() => {
    if (autoLoad && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [autoLoad, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        // The pull refetches the visible ledger only; the next-page fetch has the
        // footer, and a new filter's first fetch (React Query counts it as a
        // refetch of the placeholder rows) has the spinner by the summary.
        refreshing={isRefetching && !isFetchingNextPage && !isPlaceholderData}
        onRefresh={() => void refetch()}
        tintColor={theme.colors.primary}
        colors={[theme.colors.primary]}
        progressBackgroundColor={theme.colors.surface}
        progressViewOffset={glass.barHeight}
      />
    ),
    [isRefetching, isFetchingNextPage, isPlaceholderData, refetch, glass.barHeight],
  );

  const isFetchNextPageError = activeQuery.isFetchNextPageError;
  const listFooter = useMemo(() => {
    if (isFetchingNextPage) return <ListFooterSpinner visible />;
    if (isFetchNextPageError) {
      return (
        <View style={styles.footerRow} accessibilityLiveRegion="polite">
          <ThemedText variant="caption" weight="regular" style={styles.footerText}>
            {t.wallet.listError}
          </ThemedText>
          <TextAction title={t.common.retry} onPress={loadMore} />
        </View>
      );
    }
    if (canLoadMore && filteredCount > 0) {
      return (
        <View style={styles.footerRow}>
          <FlowButton title={t.wallet.loadMore} variant="tonal" size="sm" onPress={loadMore} />
        </View>
      );
    }
    return null;
  }, [isFetchingNextPage, isFetchNextPageError, canLoadMore, filteredCount, loadMore, t]);

  const listHeader = useMemo(
    () => (
      <HistoryFilters
        segment={segment}
        value={filters}
        onChange={setFilters}
        onOpenFilter={(group) => {
          Keyboard.dismiss();
          setSheetGroup(group);
          setSheetOpen(true);
        }}
        onClear={clearAll}
        summary={summary}
        live={announceable}
        busy={isPlaceholderData}
      />
    ),
    [segment, filters, setFilters, clearAll, summary, announceable, isPlaceholderData],
  );

  const isLoading = activeQuery.isLoading;
  // No data and not loading: the fetch failed, or it is paused offline
  // (isLoading is false then) — either way an error with a retry, never "empty".
  const isError = !isLoading && !activeQuery.data;
  const listEmpty = useMemo(() => {
    if (isLoading) {
      return (
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Skeleton width={96} height={12} style={styles.skeletonHeader} />
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <ActivityRowSkeleton key={index} position={positionIn(index, SKELETON_ROWS)} fontScale={layout.fontScale} />
          ))}
        </View>
      );
    }
    if (isError) {
      return (
        <ListState
          size="lg"
          message={t.common.somethingWentWrong}
          icon="alert-circle-outline"
          tone={theme.colors.danger}
          actionLabel={t.common.retry}
          onAction={() => void refetch()}
        />
      );
    }
    // Rows for the previous filter are still showing while the new ones load.
    if (isPlaceholderData) return null;
    if (filterCount > 0 || term) {
      return (
        <ListState
          size="lg"
          message={t.wallet.noMatches}
          hint={t.wallet.noMatchesHint}
          icon="search"
          actionLabel={canLoadMore ? t.wallet.loadMore : t.wallet.clearFilters}
          onAction={canLoadMore ? loadMore : clearAll}
        />
      );
    }
    if (segment === "deposit") {
      return <ListState size="lg" message={t.wallet.depositEmpty} icon="arrow-down" tone={theme.colors.finance} />;
    }
    if (segment === "withdraw") {
      return <ListState size="lg" message={t.wallet.withdrawEmpty} icon="arrow-up" tone={theme.colors.info} />;
    }
    return <ListState size="lg" message={t.profile.empty} icon="receipt-outline" />;
  }, [
    isLoading,
    isError,
    isPlaceholderData,
    filterCount,
    term,
    canLoadMore,
    segment,
    layout.fontScale,
    loadMore,
    clearAll,
    refetch,
    t,
  ]);

  // Rows for a superseded filter stay visible but dimmed until the new page lands.
  const dim = useSharedValue(1);
  useEffect(() => {
    dim.value = withTiming(isPlaceholderData ? 0.5 : 1, { duration: reduceMotion ? 0 : 150 });
  }, [isPlaceholderData, reduceMotion, dim]);

  /**
   * Whether the large title still fits pinned (see PINNED_MAX_SHARE). The
   * search + tabs block is measured — its height does not depend on where the
   * title sits, so the choice cannot flip back and forth — and the title's own
   * height comes from the type scale at the current text size.
   */
  const [pinnedRest, setPinnedRest] = useState(PINNED_REST_ESTIMATE);
  const onPinnedRestLayout = (event: LayoutChangeEvent) => setPinnedRest(event.nativeEvent.layout.height);
  const largeTitleHeight =
    Math.ceil(
      (theme.type.display.lineHeight + (language === "mm" ? MYANMAR_LINE_BONUS : 0)) *
        Math.min(layout.fontScale, TITLE_MAX_SCALE),
    ) + theme.spacing.xs;
  const compactTitle = insets.top + BACK_ROW + largeTitleHeight + pinnedRest > windowHeight * PINNED_MAX_SHARE;

  const columnMargin = layout.columnMargin(LIST_MAX_WIDTH);
  // The list starts under the floating bar and scrolls up beneath it.
  const contentContainerStyle = useMemo(
    () => [{ paddingHorizontal: columnMargin, paddingTop: glass.barHeight, paddingBottom: dockClearance }],
    [columnMargin, glass.barHeight, dockClearance],
  );

  const shared = {
    keyExtractor,
    contentContainerStyle,
    ListHeaderComponent: listHeader,
    ListEmptyComponent: listEmpty,
    ListFooterComponent: listFooter,
    refreshControl,
    onEndReached: endReached,
    onEndReachedThreshold: 0.6,
    initialNumToRender: 15,
    maxToRenderPerBatch: 15,
    windowSize: 7,
    removeClippedSubviews: true,
    showsVerticalScrollIndicator: false,
    scrollEventThrottle: 16,
    keyboardDismissMode: "on-drag" as const,
    keyboardShouldPersistTaps: "handled" as const,
  };

  return (
    <View style={styles.container}>
      <GlassTarget targetRef={glass.blurTarget}>
        <RowDim.Provider value={dim}>
          <View style={styles.list}>
            {segment === "deposit" ? (
              <FlatList key="deposits" ref={listRef} data={depositItems} renderItem={renderDepositItem} {...shared} />
            ) : segment === "withdraw" ? (
              <FlatList
                key="withdrawals"
                ref={listRef}
                data={withdrawalItems}
                renderItem={renderWithdrawalItem}
                {...shared}
              />
            ) : (
              <FlatList key="transactions" ref={listRef} data={ledgerItems} renderItem={renderLedgerItem} {...shared} />
            )}
          </View>
        </RowDim.Provider>
      </GlassTarget>

      <GlassBarBackground scrollY={glass.scrollY} height={glass.barHeight} blurTarget={glass.blurTarget} />

      {/* Back, then the large left-aligned title, search and the ledger tabs
          (WalletHistory.dc.html) — pinned over the list, which scrolls up under
          them into the glass. When that would crowd out the list, the title
          sits beside Back. The empty space passes touches to the list. */}
      <SafeAreaView
        edges={["top"]}
        style={[styles.top, { paddingHorizontal: columnMargin }]}
        onLayout={glass.onBarLayout}
        pointerEvents="box-none"
      >
        <View style={styles.backRow} pointerEvents="box-none">
          <AppBarAction icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel={t.common.back} />
          {compactTitle ? (
            <>
              <ThemedText
                weight="extrabold"
                numberOfLines={1}
                accessibilityRole="header"
                maxFontSizeMultiplier={TITLE_MAX_SCALE}
                style={styles.compactTitle}
              >
                {t.wallet.historyButton}
              </ThemedText>
              {/* Balances the back target, so the title stays centred. */}
              <View style={styles.compactTitleSpacer} />
            </>
          ) : null}
        </View>
        {compactTitle ? null : (
          <ThemedText
            variant="display"
            accessibilityRole="header"
            maxFontSizeMultiplier={TITLE_MAX_SCALE}
            style={styles.title}
          >
            {t.wallet.historyButton}
          </ThemedText>
        )}
        <View onLayout={onPinnedRestLayout} pointerEvents="box-none">
          <View style={styles.search} pointerEvents="box-none">
            <SearchField
              tone="soft"
              value={search}
              onChangeText={setSearch}
              onSubmit={Keyboard.dismiss}
              onClear={() => setSearch("")}
              placeholder={t.wallet.searchPlaceholder}
              accessibilityLabel={t.wallet.searchA11y}
              clearAccessibilityLabel={t.common.clear}
            />
          </View>
          <UnderlineTabs
            appearance="segmented"
            options={segments}
            value={segment}
            onChange={setSegment}
            accessibilityLabel={t.wallet.transactions}
          />
        </View>
      </SafeAreaView>

      {layout.isTablet ? null : (
        <WalletFilterSheet
          visible={sheetOpen}
          group={sheetGroup}
          onClose={() => setSheetOpen(false)}
          segment={segment}
          value={filters}
          onChange={setFilters}
          onClear={clearAll}
          activeCount={filterCount}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  /**
   * The pinned header floats over the list (the glass bar): clear, zIndex 1
   * so it mounts last and draws over the glass; GlassTarget starts the list
   * one pixel lower, so TalkBack still reads the header first.
   */
  top: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 },
  /** The 44pt back target sits 8pt in from the edge, its 40pt disc 2pt further. */
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: theme.spacing.sm,
  },
  title: { marginTop: theme.spacing.xs, paddingHorizontal: ROW_INSET },
  /** The app bar's pushed-screen title (17pt ExtraBold, centred), for tight screens. */
  compactTitle: { flex: 1, textAlign: "center", fontSize: 17 },
  compactTitleSpacer: { width: theme.layout.minTouch },
  search: { paddingTop: theme.spacing.md, paddingBottom: theme.spacing.md, paddingHorizontal: ROW_INSET },
  list: { flex: 1 },
  skeletonHeader: { marginTop: 18, marginBottom: 6, marginHorizontal: ROW_INSET },
  footerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    columnGap: theme.spacing.sm,
    rowGap: theme.spacing.xs,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: ROW_INSET,
  },
  footerText: { color: theme.colors.textMuted },
});
