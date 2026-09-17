import { View, StyleSheet } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Surface } from "@/components/ui/Surface";
import { formatKyat } from "@/utils/currency";
import { theme, withAlpha } from "@/theme";
import type { TransactionType } from "@/types/wallet";

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

interface Props {
  label: string;
  date: string;
  amount: number;
  type: TransactionType;
}

export function TransactionRow({ label, date, amount, type }: Props) {
  const isPositive = POSITIVE_TYPES.has(type);
  // The server's enum can grow past an installed binary; an unknown type
  // stays a readable, neutral row instead of an "undefined1F" colour.
  const tone = TONES[type] ?? theme.colors.textMuted;
  const icon = ICONS[type] ?? "swap-horizontal";

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
  positive: { color: theme.colors.finance },
  negative: { color: theme.colors.text },
});
