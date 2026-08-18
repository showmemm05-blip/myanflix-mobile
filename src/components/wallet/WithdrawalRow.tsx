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
import type { Withdrawal } from "@/types/withdrawal";

interface Props {
  withdrawal: Withdrawal;
}

export function WithdrawalRow({ withdrawal }: Props) {
  const { t } = useLanguage();
  const { data: types } = usePaymentAccountTypes();
  const statusLabel = t.wallet.withdrawStatus[withdrawal.status.toLowerCase() as Lowercase<Withdrawal["status"]>];
  const logoUrl = types?.find((ty) => ty.value === withdrawal.accountType)?.logoUrl ?? null;

  return (
    <Surface radius="xl" style={styles.row}>
      <View style={styles.iconTile}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.logoImage} contentFit="cover" />
        ) : (
          <Ionicons name="arrow-up-circle" size={20} color={theme.colors.info} />
        )}
      </View>
      <View style={styles.info}>
        <ThemedText variant="body" weight="semibold" numberOfLines={1}>
          {withdrawal.accountType} — {withdrawal.accountName}
        </ThemedText>
        <ThemedText variant="caption" tabular style={styles.sub} numberOfLines={1}>
          {new Date(withdrawal.createdAt).toLocaleDateString()}
        </ThemedText>
        {withdrawal.status === "REJECTED" && withdrawal.rejectionReason ? (
          <View style={styles.reasonBox}>
            <Ionicons name="information-circle" size={13} color={theme.colors.danger} />
            <ThemedText variant="caption" style={styles.rejectionReason} numberOfLines={2}>
              {withdrawal.rejectionReason}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.right}>
        {/* Unsigned, like the deposit row: the balance only moves on approval. */}
        <ThemedText variant="body" weight="bold" tabular numberOfLines={1} style={styles.amount}>
          {formatKyat(withdrawal.amount)}
        </ThemedText>
        <StatusChip status={withdrawal.status} label={statusLabel} />
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
    backgroundColor: theme.colors.infoSoft,
    borderWidth: 1,
    borderColor: theme.colors.info + "33",
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
  amount: { color: theme.colors.info },
});
