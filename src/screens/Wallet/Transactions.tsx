import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View, type ListRenderItemInfo } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/common/Skeleton";
import { ListFooterSpinner } from "@/components/common/ListFooterSpinner";
import { TopBar } from "@/components/layout/TopBar";
import { TransactionRow } from "@/components/wallet/TransactionRow";
import { DepositRow } from "@/components/wallet/DepositRow";
import { WithdrawalRow } from "@/components/wallet/WithdrawalRow";
import { useTransactionsInfinite } from "@/hooks/useWallet";
import { useDepositsInfinite } from "@/hooks/useDeposits";
import { useWithdrawalsInfinite } from "@/hooks/useWithdrawals";
import { LIST_PAGE_SIZE, flattenPages } from "@/hooks/pagination";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { WalletStackParamList } from "@/navigation/types";
import type { Deposit } from "@/types/deposit";
import type { Transaction } from "@/types/wallet";
import type { Withdrawal } from "@/types/withdrawal";

type Props = NativeStackScreenProps<WalletStackParamList, "Transactions">;
type ActivityFilter = "all" | "deposit" | "withdraw";

/**
 * Module scope on purpose — handed to FlatList, whose cells are PureComponents,
 * so an inline extractor, separator or renderer would re-render every visible
 * row each time a page lands. The deposit and withdrawal rows read no screen
 * state, so their renderers live here too; the transaction row needs `t`.
 */
const keyExtractor = (item: { id: string }) => item.id;
const Separator = () => <View style={styles.separator} />;
const renderDeposit = ({ item }: ListRenderItemInfo<Deposit>) => <DepositRow deposit={item} />;
const renderWithdrawal = ({ item }: ListRenderItemInfo<Withdrawal>) => <WithdrawalRow withdrawal={item} />;

export function TransactionsScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<ActivityFilter>("all");
  /**
   * Three ledgers, three segments, each paged on its own. Only the visible
   * one asks: the screen opens on "all" and every reader of the other two is
   * inside its own `filter === …` branch, so their pages were pure
   * speculation until that segment is tapped. A tab already visited keeps its
   * pages in cache, so switching back costs nothing.
   */
  const transactionsQuery = useTransactionsInfinite({ limit: LIST_PAGE_SIZE }, { enabled: filter === "all" });
  const depositsQuery = useDepositsInfinite({ limit: LIST_PAGE_SIZE }, { enabled: filter === "deposit" });
  const withdrawalsQuery = useWithdrawalsInfinite({ limit: LIST_PAGE_SIZE }, { enabled: filter === "withdraw" });

  // The one query the visible segment reads — narrowed by branch below where
  // the row type matters, read through this where only the state does.
  const activeQuery =
    filter === "deposit" ? depositsQuery : filter === "withdraw" ? withdrawalsQuery : transactionsQuery;
  const isLoading = activeQuery.isLoading;
  const isError = activeQuery.isError;
  const transactions = useMemo(() => flattenPages(transactionsQuery.data?.pages), [transactionsQuery.data]);
  const deposits = useMemo(() => flattenPages(depositsQuery.data?.pages), [depositsQuery.data]);
  const withdrawals = useMemo(() => flattenPages(withdrawalsQuery.data?.pages), [withdrawalsQuery.data]);

  /**
   * Stable identities for FlatList (a PureComponent): a fresh arrow or a fresh
   * `<RefreshControl>` element per render would force a whole VirtualizedList
   * pass every time a page lands. Both follow the VISIBLE segment: a pull
   * refetches every loaded page of that ledger, and its spinner is that
   * refetch only — the next-page fetch has the footer below. query-core binds
   * `refetch` and `fetchNextPage` in the observer constructor, so they hold.
   */
  const endReached = useCallback(() => {
    if (activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) activeQuery.fetchNextPage();
  }, [activeQuery.hasNextPage, activeQuery.isFetchingNextPage, activeQuery.fetchNextPage]);

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={activeQuery.isRefetching && !activeQuery.isFetchingNextPage}
        onRefresh={() => activeQuery.refetch()}
        tintColor={theme.colors.primary}
        colors={[theme.colors.primary]}
        progressBackgroundColor={theme.colors.surface}
      />
    ),
    [activeQuery.isRefetching, activeQuery.isFetchingNextPage, activeQuery.refetch],
  );

  const renderTransaction = useCallback(
    ({ item }: ListRenderItemInfo<Transaction>) => (
      <TransactionRow
        label={t.wallet.transactionTypes[item.type.toLowerCase() as Lowercase<typeof item.type>]}
        date={item.createdAt}
        amount={item.amount}
        type={item.type}
        status={item.status}
      />
    ),
    [t],
  );

  /**
   * Spinner while the next page streams in under the user's thumb — memoized
   * so its element identity (a FlatList prop) only moves with the flag.
   */
  const listFooter = useMemo(
    () => <ListFooterSpinner visible={activeQuery.isFetchingNextPage} />,
    [activeQuery.isFetchingNextPage],
  );

  return (
    <View style={styles.container}>
      <TopBar title={t.wallet.transactions} onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back}>
        <View style={styles.segmented}>
          <SegmentedControl
            options={[
              { value: "all", label: t.wallet.filterAll, icon: "receipt-outline" },
              { value: "deposit", label: t.wallet.depositButton, icon: "arrow-down-circle-outline" },
              { value: "withdraw", label: t.wallet.withdrawButton, icon: "arrow-up-circle-outline" },
            ]}
            value={filter}
            onChange={(value) => setFilter(value as ActivityFilter)}
          />
        </View>
      </TopBar>

      {isLoading ? (
        // Six blocks the height of a resting ledger row (minHeight 68), at
        // the list's own inset, so the first page lands without a shift.
        <View style={styles.skeletonList}>
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <Skeleton key={key} height={68} radius="xl" />
          ))}
        </View>
      ) : isError ? (
        <EmptyState message={t.common.somethingWentWrong} icon="alert-circle-outline" tone={theme.colors.danger} />
      ) : filter === "deposit" ? (
        deposits.length === 0 ? (
          <EmptyState message={t.wallet.depositEmpty} icon="arrow-down-circle-outline" tone={theme.colors.finance} />
        ) : (
          <FlatList
            key="deposits"
            data={deposits}
            keyExtractor={keyExtractor}
            ListFooterComponent={listFooter}
            contentContainerStyle={styles.listContent}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            windowSize={7}
            removeClippedSubviews
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
            onEndReachedThreshold={0.6}
            onEndReached={endReached}
            ItemSeparatorComponent={Separator}
            renderItem={renderDeposit}
          />
        )
      ) : filter === "withdraw" ? (
        withdrawals.length === 0 ? (
          <EmptyState message={t.wallet.withdrawEmpty} icon="arrow-up-circle-outline" tone={theme.colors.info} />
        ) : (
          <FlatList
            key="withdrawals"
            data={withdrawals}
            keyExtractor={keyExtractor}
            ListFooterComponent={listFooter}
            contentContainerStyle={styles.listContent}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            windowSize={7}
            removeClippedSubviews
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
            onEndReachedThreshold={0.6}
            onEndReached={endReached}
            ItemSeparatorComponent={Separator}
            renderItem={renderWithdrawal}
          />
        )
      ) : transactions.length === 0 ? (
        <EmptyState message={t.profile.empty} icon="receipt-outline" />
      ) : (
        <FlatList
          key="transactions"
          data={transactions}
          keyExtractor={keyExtractor}
          ListFooterComponent={listFooter}
          contentContainerStyle={styles.listContent}
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          windowSize={7}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          onEndReachedThreshold={0.6}
          onEndReached={endReached}
          ItemSeparatorComponent={Separator}
          renderItem={renderTransaction}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  segmented: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.spacing.sm },
  separator: { height: theme.spacing.sm },
  skeletonList: {
    padding: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  listContent: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.layout.tabBarClearance,
  },
});
