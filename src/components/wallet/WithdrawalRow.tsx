import { LedgerRow } from "@/components/wallet/LedgerRow";
import { useLanguage } from "@/localization/LanguageProvider";
import { usePaymentAccountTypes } from "@/hooks/usePaymentAccounts";
import { theme } from "@/theme";
import type { Withdrawal } from "@/types/withdrawal";

interface Props {
  withdrawal: Withdrawal;
}

/**
 * The withdrawal vocabulary on top of the shared `LedgerRow`: sky money-out
 * tone, "<account type> — <account name>" as the title, and the date alone as
 * the sub-line (a withdrawal has no user-facing reference to show).
 */
export function WithdrawalRow({ withdrawal }: Props) {
  const { t } = useLanguage();
  const { data: types } = usePaymentAccountTypes();
  const statusLabel = t.wallet.withdrawStatus[withdrawal.status.toLowerCase() as Lowercase<Withdrawal["status"]>];
  const logoUrl = types?.find((ty) => ty.value === withdrawal.accountType)?.logoUrl ?? null;

  return (
    <LedgerRow
      tone={theme.colors.info}
      toneSoft={theme.colors.infoSoft}
      fallbackIcon="arrow-up-circle"
      logoUrl={logoUrl}
      title={`${withdrawal.accountType} — ${withdrawal.accountName}`}
      subtitle={new Date(withdrawal.createdAt).toLocaleDateString()}
      amount={withdrawal.amount}
      status={withdrawal.status}
      statusLabel={statusLabel}
      rejectionReason={withdrawal.rejectionReason}
    />
  );
}
