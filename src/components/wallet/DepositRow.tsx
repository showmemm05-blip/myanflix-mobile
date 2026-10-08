import { memo } from "react";
import { ActivityRow } from "@/components/wallet/ActivityRow";
import { maskedKyat } from "@/components/wallet/MaskedAmount";
import { useWalletLayout } from "@/hooks/useWalletLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatKyat } from "@/utils/currency";
import { dateTimeLabel, timeLabel, type RowPosition } from "@/utils/walletDates";
import { theme } from "@/theme";
import type { Deposit } from "@/types/deposit";

interface Props {
  deposit: Deposit;
  position: RowPosition;
  /** "time" under a day header (default); "dateTime" where no header gives the day. */
  dateMode?: "time" | "dateTime";
  /** The user hid their balance: the amount shows as the mask and is not spoken. */
  masked?: boolean;
}

/**
 * The deposit vocabulary on top of the shared `ActivityRow`: the emerald
 * money-in arrow and amount, the payment method as the title, and the
 * reference + time sub-line.
 */
export const DepositRow = memo(function DepositRow({ deposit, position, dateMode = "time", masked = false }: Props) {
  const { t, language } = useLanguage();
  const { stacked } = useWalletLayout();
  const statusLabel = t.wallet.depositStatus[deposit.status.toLowerCase() as Lowercase<Deposit["status"]>];
  const reference = t.wallet.depositReference.replace("{ref}", deposit.reference);
  const when =
    dateMode === "dateTime" ? dateTimeLabel(deposit.createdAt, language) : timeLabel(deposit.createdAt, language);
  const reason = deposit.status === "REJECTED" && deposit.rejectionReason ? deposit.rejectionReason : null;
  const amount = formatKyat(deposit.amount);

  return (
    <ActivityRow
      icon="arrow-down"
      tone={theme.colors.finance}
      title={deposit.paymentMethod}
      subtitle={`${reference} · ${when}`}
      // No +/- sign: a request only moves money once it is APPROVED, so the
      // status under it carries that meaning instead.
      amountText={masked ? maskedKyat(deposit.amount, true) : amount}
      amountColor={theme.colors.finance}
      // A status this build does not know gets no label rather than a broken one.
      status={statusLabel ? { status: deposit.status, label: statusLabel } : null}
      note={reason}
      position={position}
      stacked={stacked}
      accessibilityLabel={[
        `${t.wallet.transactionTypes.deposit}, ${deposit.paymentMethod}`,
        masked ? t.wallet.amountHiddenA11y : amount,
        statusLabel ?? "",
        dateTimeLabel(deposit.createdAt, language),
        reference,
        reason ?? "",
      ]
        .filter(Boolean)
        .join(", ")}
    />
  );
});
