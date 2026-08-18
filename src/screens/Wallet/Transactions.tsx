import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/common/Skeleton";
import { TopBar } from "@/components/layout/TopBar";
import { TransactionRow } from "@/components/wallet/TransactionRow";
import { DepositRow } from "@/components/wallet/DepositRow";
import { WithdrawalRow } from "@/components/wallet/WithdrawalRow";
import { useTransactions } from "@/hooks/useWallet";
import { useDeposits } from "@/hooks/useDeposits";
import { useWithdrawals } from "@/hooks/useWithdrawals";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { WalletStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<WalletStackParamList, "Transactions">;
type ActivityFilter = "all" | "deposit" | "withdraw";

const Separator = () => <View style={styles.separator} />;

export function TransactionsScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const transactionsQuery = useTransactions({ limit: 50 });
  const depositsQuery = useDeposits({ limit: 50 });
  const withdrawalsQuery = useWithdrawals({ limit: 50 });
  // Presentation-only spinner state for pull-to-refresh.
  const [refreshing, setRefreshing] = useState(false);

  const isLoading =
    filter === "deposit" ? depositsQuery.isLoading : filter === "withdraw" ? withdrawalsQuery.isLoading : transactionsQuery.isLoading;
  const isError =
    filter === "deposit" ? depositsQuery.isError : filter === "withdraw" ? withdrawalsQuery.isError : transactionsQuery.isError;
  const transactions = transactionsQuery.data?.items ?? [];
  const deposits = depositsQuery.data?.items ?? [];
  const withdrawals = withdrawalsQuery.data?.items ?? [];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await (filter === "deposit"
        ? depositsQuery.refetch()
        : filter === "withdraw"
          ? withdrawalsQuery.refetch()
          : transactionsQuery.refetch());
    } finally {
      setRefreshing(false);
    }
  };

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tintColor={theme.colors.primary}
      colors={[theme.colors.primary]}
      progressBackgroundColor={theme.colors.surface}
    />
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
            data={deposits}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            windowSize={7}
            removeClippedSubviews
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
            ItemSeparatorComponent={Separator}
            renderItem={({ item }) => <DepositRow deposit={item} />}
          />
        )
      ) : filter === "withdraw" ? (
        withdrawals.length === 0 ? (
          <EmptyState message={t.wallet.withdrawEmpty} icon="arrow-up-circle-outline" tone={theme.colors.info} />
        ) : (
          <FlatList
            data={withdrawals}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            windowSize={7}
            removeClippedSubviews
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
            ItemSeparatorComponent={Separator}
            renderItem={({ item }) => <WithdrawalRow withdrawal={item} />}
          />
        )
      ) : transactions.length === 0 ? (
        <EmptyState message={t.profile.empty} icon="receipt-outline" />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          windowSize={7}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          ItemSeparatorComponent={Separator}
          renderItem={({ item }) => (
            <TransactionRow
              label={t.wallet.transactionTypes[item.type.toLowerCase() as Lowercase<typeof item.type>]}
              date={item.createdAt}
              amount={item.amount}
              type={item.type}
            />
          )}
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
