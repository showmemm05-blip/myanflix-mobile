import { View, StyleSheet } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Surface } from "@/components/ui/Surface";
import { StatusChip, type ChipStatus } from "@/components/wallet/StatusChip";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatKyat } from "@/utils/currency";
import { theme, withAlpha } from "@/theme";
import type { TransactionStatus, TransactionType } from "@/types/wallet";

const POSITIVE_TYPES = new Set(["DEPOSIT", "REFUND", "ADJUSTMENT_CREDIT"]);
const ICONS: Record<TransactionType, keyof typeof Ionicons.glyphMap> = {
  DEPOSIT: "arrow-down-circle",
  REFUND: "return-up-back",
  PURCHASE: "cart",
  SUBSCRIPTION: "star",
  WITHDRAWAL: "arrow-up-circle",
  ADJUSTMENT_CREDIT: "add-circle",
  ADJUSTMENT_DEBIT: "remove-circle",
};
/**
 * One colour per money role, so a ledger reads at a glance: emerald = money in,
 * gold = subscription, sky = money out, amber = an admin correction, quiet grey
 * = an ordinary content purchase. Violet is the app's ACTION colour and never
 * carries data, so no row is ever tinted with it.
 */
const TONES: Record<TransactionType, string> = {
  DEPOSIT: theme.colors.finance,
  REFUND: theme.colors.finance,
  ADJUSTMENT_CREDIT: theme.colors.finance,
  SUBSCRIPTION: theme.colors.premium,
  PURCHASE: theme.colors.textMuted,
  WITHDRAWAL: theme.colors.info,
  ADJUSTMENT_DEBIT: theme.colors.warning,
};

type RowChip = Extract<ChipStatus, "PENDING" | "FAILED" | "REFUNDED">;

/**
 * The chip a row carries, or null for an ordinary settled (COMPLETED) one.
 *
 * A withdrawal holds its money the moment it is requested (a PENDING row);
 * rejecting it marks that row FAILED and returns the money as a separate
 * Refund row. Without a chip that pair read as two real movements, so the
 * held row says what happened to it: Pending while it waits, Refunded once
 * the money is back. FAILED on any other type is plain Failed, and a status
 * this build does not know gets no chip rather than a wrong one.
 */
function chipFor(type: TransactionType, status: TransactionStatus): RowChip | null {
  if (status === "PENDING") return "PENDING";
  if (status === "FAILED") return type === "WITHDRAWAL" ? "REFUNDED" : "FAILED";
  return null;
}

interface Props {
  label: string;
  date: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
}

export function TransactionRow({ label, date, amount, type, status }: Props) {
  const { t } = useLanguage();
  const isPositive = POSITIVE_TYPES.has(type);
  // The server's enum can grow past an installed binary; an unknown type
  // stays a readable, neutral row instead of an "undefined1F" colour.
  const tone = TONES[type] ?? theme.colors.textMuted;
  const icon = ICONS[type] ?? "swap-horizontal";
  const chip = chipFor(type, status);
  const chipLabels: Record<RowChip, string> = {
    PENDING: t.wallet.transactionStatus.pending,
    FAILED: t.wallet.transactionStatus.failed,
    REFUNDED: t.wallet.transactionStatus.refunded,
  };

  return (
    <Surface radius="xl" style={styles.row}>
      <View
        style={[
          styles.iconTile,
          { backgroundColor: withAlpha(tone, 0.12), borderColor: withAlpha(tone, 0.2) },
        ]}
      >
        <Ionicons name={icon} size={18} color={tone} />
      </View>
      <View style={styles.info}>
        <ThemedText variant="body" weight="semibold" numberOfLines={1}>
          {label}
        </ThemedText>
        <ThemedText variant="caption" tabular style={styles.date}>
          {new Date(date).toLocaleDateString()}
        </ThemedText>
      </View>
      <View style={styles.right}>
        <ThemedText
          variant="body"
          weight="bold"
          tabular
          numberOfLines={1}
          style={isPositive ? styles.positive : styles.negative}
        >
          {isPositive ? "+" : "-"}
          {formatKyat(amount)}
        </ThemedText>
        {chip ? <StatusChip status={chip} label={chipLabels[chip]} /> : null}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    minHeight: 68,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: 2 },
  date: { color: theme.colors.textFaint },
  right: { alignItems: "flex-end", gap: 6 },
  positive: { color: theme.colors.finance },
  negative: { color: theme.colors.text },
});
