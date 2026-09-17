import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Surface } from "@/components/ui/Surface";
import { AuroraBackdrop } from "@/components/common/AuroraBackdrop";
import { Skeleton } from "@/components/common/Skeleton";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { TransactionRow } from "@/components/wallet/TransactionRow";
import { DepositRow } from "@/components/wallet/DepositRow";
import { DepositSheet } from "@/components/wallet/DepositSheet";
import { WithdrawalRow } from "@/components/wallet/WithdrawalRow";
import { WithdrawSheet } from "@/components/wallet/WithdrawSheet";
import { useWallet, useTransactions } from "@/hooks/useWallet";
import { useDeposits } from "@/hooks/useDeposits";
import { useWithdrawals } from "@/hooks/useWithdrawals";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatKyat } from "@/utils/currency";
import { displayNameOf } from "@/utils/format";
import { tabularNums, theme } from "@/theme";
import type { WalletStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<WalletStackParamList, "Wallet">;
type ActivityFilter = "all" | "deposit" | "withdraw";

export function WalletScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const walletQuery = useWallet();
  const transactionsQuery = useTransactions({ limit: 5 });
  const depositsQuery = useDeposits({ limit: 5 });
  const withdrawalsQuery = useWithdrawals({ limit: 5 });
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  // Presentation-only: drives the pull-to-refresh spinner while the queries
  // this screen already owns re-run. No new data source.
  const [refreshing, setRefreshing] = useState(false);

  const wallet = walletQuery.data;
  const transactions = transactionsQuery.data?.items ?? [];
  const deposits = depositsQuery.data?.items ?? [];
  const withdrawals = withdrawalsQuery.data?.items ?? [];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        walletQuery.refetch(),
        transactionsQuery.refetch(),
        depositsQuery.refetch(),
        withdrawalsQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <AuroraBackdrop tone="emerald" height={420} intensity={0.75} />
      {/* No page title: the tab bar already says which tab this is, and the
          balance card below is a better answer to "where am I" than the word
          "Wallet". Dropping it also collapses AppBar to its compact variant,
          which is what Home has always done. */}
      <AppTopBar />

      {walletQuery.isLoading ? (
        <View style={styles.content}>
          <Skeleton height={176} radius="3xl" />
          <Skeleton height={54} radius="2xl" />
          <Skeleton height={68} radius="xl" />
          <Skeleton height={68} radius="xl" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.finance}
              colors={[theme.colors.finance]}
              progressBackgroundColor={theme.colors.surface}
            />
          }
        >
          {/* A failed balance fetch must never render as "0 Ks" — the hero is
              replaced by an explicit error card with its own retry. */}
          {walletQuery.isError ? (
            <Surface radius="3xl" padded style={styles.errorHero}>
              <View style={styles.errorHeader}>
                <View style={styles.errorIconTile}>
                  <Ionicons name="cloud-offline-outline" size={22} color={theme.colors.danger} />
                </View>
                <View style={styles.errorText}>
                  <ThemedText variant="overline" style={styles.errorLabel}>
                    {t.wallet.balance.toUpperCase()}
                  </ThemedText>
                  <ThemedText variant="section" numberOfLines={2}>
                    {t.common.somethingWentWrong}
                  </ThemedText>
                </View>
              </View>
              <Button
                title={t.common.retry}
                icon="refresh"
                variant="soft"
                size="lg"
                fullWidth
                color={theme.colors.danger}
                loading={walletQuery.isFetching}
                onPress={() => walletQuery.refetch()}
              />
            </Surface>
          ) : (
            /* Balance hero — emerald is the money role across the whole app. */
            <View style={styles.hero}>
              <LinearGradient
                colors={[theme.colors.aurora.emerald, theme.colors.aurora.indigo]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {/* Two oversized, mostly-off-card translucent discs for the
                  "textured bank card" look — clipped by the hero's overflow. */}
              <View style={styles.heroGlowTopRight} />
              <View style={styles.heroGlowBottomLeft} />

              <View style={styles.heroTopRow}>
                <ThemedText variant="overline" style={styles.heroLabel}>
                  {t.wallet.balance.toUpperCase()}
                </ThemedText>
                <View style={styles.heroIconTile}>
                  <Ionicons name="wallet" size={18} color={theme.colors.text} />
                </View>
              </View>

              <ThemedText style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>
                {formatKyat(wallet?.balance ?? 0)}
              </ThemedText>

              {/* The card-owner line is a human name, so the display name wins. */}
              {displayNameOf(user) ? (
                <ThemedText variant="caption" weight="semibold" style={styles.heroOwner} numberOfLines={1}>
                  {displayNameOf(user)}
                </ThemedText>
              ) : null}
            </View>
          )}

          <View style={styles.actionsRow}>
            <Button
              title={t.wallet.depositButton}
              icon="add-circle-outline"
              size="lg"
              onPress={() => setDepositOpen(true)}
              style={styles.actionButton}
            />
            <Button
              title={t.wallet.withdrawButton}
              icon="arrow-up-circle-outline"
              variant="outline"
              size="lg"
              onPress={() => setWithdrawOpen(true)}
              style={styles.actionButton}
            />
          </View>

          <View style={styles.activity}>
            <SectionHeader
              title={t.wallet.recentTransactions}
              icon="receipt-outline"
              onSeeAll={() => navigation.navigate("Transactions")}
              seeAllLabel={t.common.seeAll}
              inset={false}
            />

            <SegmentedControl
              options={[
                { value: "all", label: t.wallet.filterAll, icon: "receipt-outline" },
                { value: "deposit", label: t.wallet.depositButton, icon: "arrow-down-circle-outline" },
                { value: "withdraw", label: t.wallet.withdrawButton, icon: "arrow-up-circle-outline" },
              ]}
              value={filter}
              onChange={(value) => setFilter(value as ActivityFilter)}
            />

            <View style={styles.list}>
              {filter === "all" &&
                (transactions.length === 0 ? (
                  <Surface tone="flat" style={styles.emptyCard}>
                    <EmptyState message={t.profile.empty} icon="receipt-outline" fill={false} />
                  </Surface>
                ) : (
                  transactions.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      label={t.wallet.transactionTypes[tx.type.toLowerCase() as Lowercase<typeof tx.type>]}
                      date={tx.createdAt}
                      amount={tx.amount}
                      type={tx.type}
                    />
                  ))
                ))}

              {filter === "deposit" &&
                (deposits.length === 0 ? (
                  <Surface tone="flat" style={styles.emptyCard}>
                    <EmptyState
                      message={t.wallet.depositEmpty}
                      icon="arrow-down-circle-outline"
                      tone={theme.colors.finance}
                      fill={false}
                    />
                  </Surface>
                ) : (
                  deposits.map((deposit) => <DepositRow key={deposit.id} deposit={deposit} />)
                ))}

              {filter === "withdraw" &&
                (withdrawals.length === 0 ? (
                  <Surface tone="flat" style={styles.emptyCard}>
                    <EmptyState
                      message={t.wallet.withdrawEmpty}
                      icon="arrow-up-circle-outline"
                      tone={theme.colors.info}
                      fill={false}
                    />
                  </Surface>
                ) : (
                  withdrawals.map((withdrawal) => <WithdrawalRow key={withdrawal.id} withdrawal={withdrawal} />)
                ))}
            </View>
          </View>
        </ScrollView>
      )}

      <DepositSheet visible={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawSheet visible={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.layout.tabBarClearance,
    gap: theme.spacing.md,
  },
  hero: {
    borderRadius: theme.radius["3xl"],
    padding: theme.spacing.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.finance + "3D",
    ...theme.shadow.lg,
    shadowColor: theme.colors.finance,
    shadowOpacity: 0.28,
  },
  errorHero: {
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.danger + "3D",
  },
  errorHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  errorIconTile: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: theme.colors.danger + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { flex: 1, gap: 2 },
  errorLabel: { color: theme.colors.danger },
  heroGlowTopRight: {
    position: "absolute",
    top: -46,
    right: -34,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: theme.colors.finance + "1A",
  },
  heroGlowBottomLeft: {
    position: "absolute",
    bottom: -54,
    left: -44,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: theme.colors.text + "0F",
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroLabel: { color: theme.colors.text, opacity: 0.72 },
  heroIconTile: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.text + "1F",
    borderWidth: 1,
    borderColor: theme.colors.ring,
    alignItems: "center",
    justifyContent: "center",
  },
  heroAmount: {
    ...tabularNums,
    fontFamily: theme.font.bold,
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -0.8,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
  },
  heroOwner: { color: theme.colors.text, opacity: 0.68, marginTop: theme.spacing.lg, letterSpacing: 0.8 },
  actionsRow: { flexDirection: "row", gap: theme.spacing.sm },
  actionButton: { flex: 1 },
  activity: { marginTop: theme.spacing.xs, gap: theme.spacing.sm },
  list: { gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  emptyCard: { paddingVertical: theme.spacing.md },
});
