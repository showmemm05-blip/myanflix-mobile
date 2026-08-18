import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ui/ThemedText";
import { Surface } from "@/components/ui/Surface";
import { StatusChip } from "@/components/wallet/StatusChip";
import { useLanguage } from "@/localization/LanguageProvider";
import { usePaymentAccountTypes } from "@/hooks/usePaymentAccounts";
import { formatKyat } from "@/utils/currency";
import { theme } from "@/theme";
import type { Deposit } from "@/types/deposit";

interface Props {
  deposit: Deposit;
}

// paymentMethod is a free-typed label, sometimes with " - <bank name>"
// appended (see the deposit sheet's methodLabel() helper) — so an exact
// match against the catalog only works for non-bank methods; everything
// else needs the "<label> - " prefix check.
export function DepositRow({ deposit }: Props) {
  const { t } = useLanguage();
  const { data: types } = usePaymentAccountTypes();
  const statusLabel = t.wallet.depositStatus[deposit.status.toLowerCase() as Lowercase<Deposit["status"]>];
  const logoUrl =
    types?.find((ty) => deposit.paymentMethod === ty.label || deposit.paymentMethod.startsWith(`${ty.label} - `))
      ?.logoUrl ?? null;

  return (
    <Surface radius="xl" style={styles.row}>
      <View style={styles.iconTile}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.logoImage} contentFit="cover" />
        ) : (
          <Ionicons name="arrow-down-circle" size={20} color={theme.colors.finance} />
        )}
      </View>
      <View style={styles.info}>
        <ThemedText variant="body" weight="semibold" numberOfLines={1}>
          {deposit.paymentMethod}
        </ThemedText>
        <ThemedText variant="caption" tabular style={styles.sub} numberOfLines={1}>
          {t.wallet.depositReference.replace("{ref}", deposit.reference)} ·{" "}
          {new Date(deposit.createdAt).toLocaleDateString()}
        </ThemedText>
        {deposit.status === "REJECTED" && deposit.rejectionReason ? (
          <View style={styles.reasonBox}>
            <Ionicons name="information-circle" size={13} color={theme.colors.danger} />
            <ThemedText variant="caption" style={styles.rejectionReason} numberOfLines={2}>
              {deposit.rejectionReason}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.right}>
        {/* No +/- sign here: a deposit request is only money in once it's
            APPROVED, so the status chip below carries that meaning instead. */}
        <ThemedText variant="body" weight="bold" tabular numberOfLines={1} style={styles.amount}>
          {formatKyat(deposit.amount)}
        </ThemedText>
        <StatusChip status={deposit.status} label={statusLabel} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, padding: theme.spacing.md, minHeight: 68 },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.financeSoft,
    borderWidth: 1,
    borderColor: theme.colors.finance + "33",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: { width: 40, height: 40 },
  info: { flex: 1, gap: 2 },
  sub: { color: theme.colors.textFaint },
  reasonBox: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 2 },
  rejectionReason: { flex: 1, color: theme.colors.danger },
  right: { alignItems: "flex-end", gap: 6 },
  amount: { color: theme.colors.finance },
});
