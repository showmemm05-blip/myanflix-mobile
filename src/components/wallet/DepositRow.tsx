import { LedgerRow } from "@/components/wallet/LedgerRow";
import { useLanguage } from "@/localization/LanguageProvider";
import { usePaymentAccountTypes } from "@/hooks/usePaymentAccounts";
import { theme } from "@/theme";
import type { Deposit } from "@/types/deposit";

interface Props {
  deposit: Deposit;
}

/**
 * The deposit vocabulary on top of the shared `LedgerRow`: emerald money-in
 * tone, the payment method as the title, and the reference + date sub-line.
 */
export function DepositRow({ deposit }: Props) {
  const { t } = useLanguage();
  const { data: types } = usePaymentAccountTypes();
  const statusLabel = t.wallet.depositStatus[deposit.status.toLowerCase() as Lowercase<Deposit["status"]>];
  // paymentMethod is a free-typed label, sometimes with " - <bank name>"
  // appended (see the deposit sheet's methodLabel() helper) — so an exact
  // match against the catalog only works for non-bank methods; everything
  // else needs the "<label> - " prefix check.
  const logoUrl =
    types?.find((ty) => deposit.paymentMethod === ty.label || deposit.paymentMethod.startsWith(`${ty.label} - `))
      ?.logoUrl ?? null;

  return (
    <LedgerRow
      tone={theme.colors.finance}
      toneSoft={theme.colors.financeSoft}
      fallbackIcon="arrow-down-circle"
      logoUrl={logoUrl}
      title={deposit.paymentMethod}
      subtitle={`${t.wallet.depositReference.replace("{ref}", deposit.reference)} · ${new Date(
        deposit.createdAt,
      ).toLocaleDateString()}`}
      amount={deposit.amount}
      status={deposit.status}
      statusLabel={statusLabel}
      rejectionReason={deposit.rejectionReason}
    />
  );
}
