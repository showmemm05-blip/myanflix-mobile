import { Fragment, useCallback, useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { ActivityRowSkeleton } from "@/components/wallet/ActivityRow";
import { DayHeader } from "@/components/wallet/DayHeader";
import { DepositRow } from "@/components/wallet/DepositRow";
import { ListState } from "@/components/wallet/ListState";
import { PressScale } from "@/components/wallet/PressScale";
import { TransactionRow } from "@/components/wallet/TransactionRow";
import { UnderlineTabs, type TabOption } from "@/components/wallet/UnderlineTabs";
import { WithdrawalRow } from "@/components/wallet/WithdrawalRow";
import { ROW_INSET, useWalletLayout } from "@/hooks/useWalletLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { dayLabel, positionIn, withDayHeaders, type RowPosition } from "@/utils/walletDates";
import { theme } from "@/theme";
import type { PaginatedResponse } from "@/types/api";
import type { Deposit } from "@/types/deposit";
import type { Transaction } from "@/types/wallet";
import type { Withdrawal } from "@/types/withdrawal";

export type ActivitySegment = "all" | "deposit" | "withdraw";

/** The three ledgers' tabs — the same strip on the wallet and in History. */
export function useActivitySegments(): readonly TabOption<ActivitySegment>[] {
  const { t } = useLanguage();
  // Stable per language, so the memoized tab strip can bail out.
  return useMemo(
    () => [
      { value: "all", label: t.wallet.filterAll },
      { value: "deposit", label: t.wallet.transactionTypes.deposit },
      { value: "withdraw", label: t.wallet.transactionTypes.withdrawal },
    ],
    [t],
  );
}

/** The parts of a list query this section reads — a React Query result fits as is. */
interface ListQuery<T> {
  data: PaginatedResponse<T> | undefined;
  isLoading: boolean;
  refetch: () => unknown;
}

/** How many pending deposits the "Awaiting approval" group shows before "See all". */
const AWAITING_LIMIT = 3;

interface Props {
  segment: ActivitySegment;
  onSegmentChange: (segment: ActivitySegment) => void;
  ledger: ListQuery<Transaction>;
  deposits: ListQuery<Deposit>;
  withdrawals: ListQuery<Withdrawal>;
  /**
   * Pending deposits, shown above the ledger on "All". A deposit only enters
   * the ledger once approved, so they would otherwise be invisible there —
   * and nothing in this group can also appear below it.
   */
  pendingDeposits: readonly Deposit[];
  /** The user hid their balance: row amounts are masked too (shown and spoken). */
  hidden: boolean;
  onSeeAll: () => void;
  onDeposit: () => void;
}

/**
 * The newest five of each ledger, grouped by day, flat on the page under a
 * "See all" header and a row of tab chips (Wallet.dc.html), with honest
 * states: rows while loading are skeletons, a list with nothing to show that
 * is not loading — failed, or paused offline — says so with a retry, and only
 * a loaded, empty list shows the empty state.
 */
export function RecentActivity({
  segment,
  onSegmentChange,
  ledger,
  deposits,
  withdrawals,
  pendingDeposits,
  hidden,
  onSeeAll,
  onDeposit,
}: Props) {
  const { t, language } = useLanguage();
  const { fontScale } = useWalletLayout();
  const reduceMotion = useReducedMotion();
  const segments = useActivitySegments();

  const labelFor = useCallback(
    (date: string) => dayLabel(date, language, { today: t.wallet.today, yesterday: t.wallet.yesterday }),
    [language, t],
  );

  /** Day headers + rows. */
  function grouped<T extends { id: string; createdAt: string }>(
    rows: readonly T[],
    renderRow: (row: T, position: RowPosition) => ReactNode,
  ) {
    return withDayHeaders(rows, (row) => row.createdAt, labelFor).map((item) =>
      item.kind === "day" ? (
        <DayHeader key={item.key} label={item.label} />
      ) : (
        <Fragment key={item.key}>{renderRow(item.row, item.position)}</Fragment>
      ),
    );
  }

  function body<T extends { id: string; createdAt: string }>(
    query: ListQuery<T>,
    renderRows: (rows: T[]) => ReactNode,
    empty: ReactNode,
    prefix?: ReactNode,
  ) {
    if (query.isLoading) {
      return (
        <View>
          {(["first", "middle", "last"] as const).map((position) => (
            <ActivityRowSkeleton key={position} position={position} fontScale={fontScale} />
          ))}
        </View>
      );
    }
    // No data and not loading: the fetch failed, or it is paused offline
    // (isLoading is false then) — either way, not "nothing here yet".
    if (!query.data) {
      return (
        <ListState
          message={t.wallet.listError}
          icon="alert-circle-outline"
          tone={theme.colors.danger}
          actionLabel={t.common.retry}
          onAction={() => void query.refetch()}
        />
      );
    }
    const rows = query.data.items;
    if (rows.length === 0 && !prefix) return empty;
    return (
      <>
        {prefix}
        {renderRows(rows)}
      </>
    );
  }

  const awaiting = pendingDeposits.slice(0, AWAITING_LIMIT);
  const awaitingGroup =
    awaiting.length > 0 ? (
      <>
        <DayHeader label={t.wallet.awaitingApproval} kind="awaiting" />
        {awaiting.map((deposit, index) => (
          <DepositRow
            key={`awaiting-${deposit.id}`}
            deposit={deposit}
            position={positionIn(index, awaiting.length)}
            dateMode="dateTime"
            masked={hidden}
          />
        ))}
      </>
    ) : undefined;

  let content: ReactNode;
  if (segment === "deposit") {
    content = body(
      deposits,
      (rows) =>
        grouped(rows, (deposit, position) => <DepositRow deposit={deposit} position={position} masked={hidden} />),
      <ListState
        message={t.wallet.depositEmpty}
        icon="arrow-down"
        tone={theme.colors.finance}
        actionLabel={t.wallet.depositButton}
        actionVariant="play"
        actionIcon="arrow-down"
        onAction={onDeposit}
      />,
    );
  } else if (segment === "withdraw") {
    content = body(
      withdrawals,
      (rows) =>
        grouped(rows, (withdrawal, position) => (
          <WithdrawalRow withdrawal={withdrawal} position={position} masked={hidden} />
        )),
      <ListState message={t.wallet.withdrawEmpty} icon="arrow-up" tone={theme.colors.info} />,
    );
  } else {
    content = body(
      ledger,
      (rows) =>
        grouped(rows, (tx, position) => <TransactionRow transaction={tx} position={position} masked={hidden} />),
      <ListState
        message={t.profile.empty}
        icon="receipt-outline"
        actionLabel={t.wallet.depositButton}
        actionVariant="play"
        actionIcon="arrow-down"
        onAction={onDeposit}
      />,
      awaitingGroup,
    );
  }

  return (
    <View>
      <View style={styles.header}>
        <ThemedText variant="section" accessibilityRole="header" style={styles.title}>
          {t.wallet.recentTransactions}
        </ThemedText>
        <PressScale
          onPress={onSeeAll}
          accessibilityRole="link"
          accessibilityLabel={`${t.common.seeAll}, ${t.wallet.recentTransactions}`}
          hitSlop={{ left: 8, right: 8 }}
          style={styles.seeAll}
        >
          <ThemedText weight="extrabold" style={styles.seeAllText}>
            {t.common.seeAll}
          </ThemedText>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.link} />
        </PressScale>
      </View>
      <View style={styles.tabs}>
        <UnderlineTabs
          options={segments}
          value={segment}
          onChange={onSegmentChange}
          accessibilityLabel={t.wallet.recentTransactions}
        />
      </View>
      {/* The board's `.rise`: each tab's list settles up into place (a plain fade under reduce motion). */}
      <Animated.View
        key={segment}
        entering={reduceMotion ? FadeIn.duration(150) : FadeInDown.duration(280)}
        style={styles.list}
      >
        {content}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Wraps "See all" under the title at large text sizes rather than squeezing either. */
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    minHeight: theme.layout.minTouch,
    paddingHorizontal: ROW_INSET,
  },
  title: { flexShrink: 1 },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: theme.layout.minTouch },
  seeAllText: { fontSize: 14, color: theme.colors.link },
  tabs: { marginTop: theme.spacing.sm },
  list: { marginTop: theme.spacing.sm },
});
