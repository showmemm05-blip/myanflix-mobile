import { memo } from "react";
import { ActivityRow } from "@/components/wallet/ActivityRow";
import { maskedKyat } from "@/components/wallet/MaskedAmount";
import { useWalletLayout } from "@/hooks/useWalletLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatKyat } from "@/utils/currency";
import { dateTimeLabel, timeLabel, type RowPosition } from "@/utils/walletDates";
import { theme } from "@/theme";
import type { Withdrawal } from "@/types/withdrawal";

interface Props {
  withdrawal: Withdrawal;
  position: RowPosition;
  /** "time" under a day header (default); "dateTime" where no header gives the day. */
  dateMode?: "time" | "dateTime";
  /** The user hid their balance: the amount shows as the mask and is not spoken. */
  masked?: boolean;
}

/** The user's own receiving number, cut to its last four digits for the sub-line. */
function maskedNumber(accountNumber: string): string {
  return accountNumber.length > 4 ? `•••• ${accountNumber.slice(-4)}` : accountNumber;
}

/**
 * The withdrawal vocabulary on top of the shared `ActivityRow`: the sky
 * money-out arrow, "<account type> — <account name>" as the title, and the
 * time plus the receiving account's bank and last digits as the sub-line.
 */
export const WithdrawalRow = memo(function WithdrawalRow({
  withdrawal,
  position,
  dateMode = "time",
  masked = false,
}: Props) {
  const { t, language } = useLanguage();
  const { stacked } = useWalletLayout();
  const statusLabel = t.wallet.withdrawStatus[withdrawal.status.toLowerCase() as Lowercase<Withdrawal["status"]>];
  const title = `${withdrawal.accountType} — ${withdrawal.accountName}`;
  const when =
    dateMode === "dateTime"
      ? dateTimeLabel(withdrawal.createdAt, language)
      : timeLabel(withdrawal.createdAt, language);
  const reason = withdrawal.status === "REJECTED" && withdrawal.rejectionReason ? withdrawal.rejectionReason : null;
  const amount = formatKyat(withdrawal.amount);

  return (
    <ActivityRow
      icon="arrow-up"
      tone={theme.colors.info}
      title={title}
      subtitle={[when, withdrawal.bankName, maskedNumber(withdrawal.accountNumber)].filter(Boolean).join(" · ")}
      // No +/- sign: a request only moves money once it is APPROVED, so the
      // status under it carries that meaning instead.
      amountText={masked ? maskedKyat(withdrawal.amount, true) : amount}
      amountColor={theme.colors.text}
      // A status this build does not know gets no label rather than a broken one.
      status={statusLabel ? { status: withdrawal.status, label: statusLabel } : null}
      note={reason}
      position={position}
      stacked={stacked}
      accessibilityLabel={[
        `${t.wallet.transactionTypes.withdrawal}, ${title}`,
        masked ? t.wallet.amountHiddenA11y : amount,
        statusLabel ?? "",
        dateTimeLabel(withdrawal.createdAt, language),
        reason ?? "",
      ]
        .filter(Boolean)
        .join(", ")}
    />
  );
});
