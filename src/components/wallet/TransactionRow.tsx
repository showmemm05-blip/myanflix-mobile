import { memo } from "react";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import type Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityRow } from "@/components/wallet/ActivityRow";
import { maskedKyat } from "@/components/wallet/MaskedAmount";
import type { RowStatus } from "@/components/wallet/StatusLabel";
import { useWalletLayout } from "@/hooks/useWalletLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatKyat } from "@/utils/currency";
import { dateTimeLabel, timeLabel, type RowPosition } from "@/utils/walletDates";
import { theme } from "@/theme";
import type { TranslationShape } from "@/localization/translations";
import type { Transaction, TransactionStatus, TransactionType } from "@/types/wallet";

const POSITIVE_TYPES = new Set(["DEPOSIT", "REFUND", "ADJUSTMENT_CREDIT"]);
const ICONS: Record<TransactionType, keyof typeof Ionicons.glyphMap> = {
  DEPOSIT: "arrow-down",
  REFUND: "return-up-back",
  PURCHASE: "film-outline",
  SUBSCRIPTION: "star-outline",
  WITHDRAWAL: "arrow-up",
  ADJUSTMENT_CREDIT: "add",
  ADJUSTMENT_DEBIT: "remove",
};
/**
 * One colour per money role, so a ledger reads at a glance: emerald = money in,
 * gold = subscription, sky = money out, amber = an admin correction, violet =
 * a content purchase (the approved wallet design tints purchases violet).
 */
const TONES: Record<TransactionType, string> = {
  DEPOSIT: theme.colors.finance,
  REFUND: theme.colors.finance,
  ADJUSTMENT_CREDIT: theme.colors.finance,
  SUBSCRIPTION: theme.colors.premium,
  PURCHASE: theme.colors.primary,
  WITHDRAWAL: theme.colors.info,
  ADJUSTMENT_DEBIT: theme.colors.warning,
};
/** A purchase's glyph is the lighter text violet on its violet tint, as the design draws it. */
const INKS: Partial<Record<TransactionType, string>> = { PURCHASE: theme.colors.link };

type LedgerRowStatus = Extract<RowStatus, "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED">;

/**
 * The status a row shows, or null for a status this build does not know
 * (no label rather than a wrong one).
 *
 * A withdrawal holds its money the moment it is requested (a PENDING row);
 * rejecting it marks that row FAILED and returns the money as a separate
 * Refund row. Without a status that pair read as two real movements, so the
 * held row says what happened to it: Pending while it waits, Refunded once
 * the money is back. FAILED on any other type is plain Failed; a settled row
 * says Completed.
 */
function rowStatusFor(type: TransactionType, status: TransactionStatus): LedgerRowStatus | null {
  if (status === "PENDING") return "PENDING";
  if (status === "FAILED") return type === "WITHDRAWAL" ? "REFUNDED" : "FAILED";
  return status === "COMPLETED" ? "COMPLETED" : null;
}

function rowStatusLabel(rowStatus: LedgerRowStatus, t: TranslationShape): string {
  switch (rowStatus) {
    case "PENDING":
      return t.wallet.transactionStatus.pending;
    case "FAILED":
      return t.wallet.transactionStatus.failed;
    case "REFUNDED":
      return t.wallet.transactionStatus.refunded;
    default:
      return t.wallet.filterCompleted;
  }
}

/**
 * What a ledger row's status says in words — Pending, Failed, Refunded or
 * Completed — or null for a status this build does not know. For the
 * screen-reader news when a row settles (hooks/useWalletAnnouncements).
 */
export function ledgerStatusLabel(tx: Transaction, t: TranslationShape): string | null {
  const rowStatus = rowStatusFor(tx.type, tx.status);
  return rowStatus ? rowStatusLabel(rowStatus, t) : null;
}

/** A ledger type in words; a type this build does not know reads as its raw name. */
export function ledgerTypeLabel(type: TransactionType, t: TranslationShape): string {
  return t.wallet.transactionTypes[type.toLowerCase() as Lowercase<TransactionType>] ?? type;
}

interface Props {
  transaction: Transaction;
  position: RowPosition;
  /** "time" under a day header (default); "dateTime" where no header gives the day. */
  dateMode?: "time" | "dateTime";
  /** The user hid their balance: the amount shows as the mask and is not spoken. */
  masked?: boolean;
}

/** The ledger vocabulary on top of the shared `ActivityRow`. */
export const TransactionRow = memo(function TransactionRow({
  transaction: tx,
  position,
  dateMode = "time",
  masked = false,
}: Props) {
  const { t, language } = useLanguage();
  const { stacked } = useWalletLayout();
  const isPositive = POSITIVE_TYPES.has(tx.type);
  // The server's enum can grow past an installed binary; an unknown type
  // stays a readable, neutral row instead of an "undefined1F" colour.
  const tone = TONES[tx.type] ?? theme.colors.textMuted;
  const icon = ICONS[tx.type] ?? "swap-horizontal";
  const typeLabel = ledgerTypeLabel(tx.type, t);
  // A purchase names what was bought; the type moves to the sub-line.
  const movieTitle = tx.type === "PURCHASE" && tx.movieTitle ? tx.movieTitle : null;
  const when = dateMode === "dateTime" ? dateTimeLabel(tx.createdAt, language) : timeLabel(tx.createdAt, language);
  const rowStatus = rowStatusFor(tx.type, tx.status);
  const statusLabel = rowStatus ? rowStatusLabel(rowStatus, t) : null;
  const amount = formatKyat(tx.amount);

  return (
    <ActivityRow
      icon={icon}
      tone={tone}
      ink={INKS[tx.type]}
      title={movieTitle ?? typeLabel}
      subtitle={movieTitle ? `${typeLabel} · ${when}` : when}
      // A true minus sign (U+2212), as wide as the plus, so the figures line up.
      amountText={masked ? maskedKyat(tx.amount, true) : `${isPositive ? "+" : "\u2212"}${amount}`}
      amountColor={isPositive ? theme.colors.finance : theme.colors.text}
      status={rowStatus && statusLabel ? { status: rowStatus, label: statusLabel } : null}
      position={position}
      stacked={stacked}
      accessibilityLabel={[
        movieTitle ? `${movieTitle}, ${typeLabel}` : typeLabel,
        masked
          ? t.wallet.amountHiddenA11y
          : (isPositive ? t.wallet.amountInA11y : t.wallet.amountOutA11y).replace("{amount}", amount),
        statusLabel ?? "",
        dateTimeLabel(tx.createdAt, language),
      ]
        .filter(Boolean)
        .join(", ")}
    />
  );
});
