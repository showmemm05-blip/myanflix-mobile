import { View, StyleSheet } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ui/ThemedText";
import { Surface } from "@/components/ui/Surface";
import { StatusChip, type LedgerStatus } from "@/components/wallet/StatusChip";
import { formatKyat } from "@/utils/currency";
import { theme, withAlpha } from "@/theme";

interface Props {
  /** The role colour of this ledger: emerald for money in, sky for money out. */
  tone: string;
  /** The same role at surface strength, behind the icon tile. */
  toneSoft: string;
  /** Shown only when the payment type has no logo of its own. */
  fallbackIcon: keyof typeof Ionicons.glyphMap;
  logoUrl: string | null;
  title: string;
  subtitle: string;
  amount: number;
  status: LedgerStatus;
  statusLabel: string;
  rejectionReason?: string | null;
}

/**
 * The one request row behind the deposit and withdrawal lists. It owns the
 * layout — tile, info column, rejection notice, amount + status chip — and
 * nothing about either domain: the callers translate their own vocabulary
 * (which logo to look up, how to phrase the sub-line) into these props.
 *
 * Written once because a fix to the shared parts, above all the REJECTED
 * block, used to have to be made twice and in practice drifted instead.
 */
export function LedgerRow({
  tone,
  toneSoft,
  fallbackIcon,
  logoUrl,
  title,
  subtitle,
  amount,
  status,
  statusLabel,
  rejectionReason,
}: Props) {
  return (
    <Surface radius="xl" style={styles.row}>
      <View style={[styles.iconTile, { backgroundColor: toneSoft, borderColor: withAlpha(tone, 0.2) }]}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.logoImage} contentFit="cover" />
        ) : (
          <Ionicons name={fallbackIcon} size={20} color={tone} />
        )}
      </View>
      <View style={styles.info}>
        <ThemedText variant="body" weight="semibold" numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText variant="caption" tabular style={styles.sub} numberOfLines={1}>
          {subtitle}
        </ThemedText>
        {status === "REJECTED" && rejectionReason ? (
          <View style={styles.reasonBox}>
            <Ionicons name="information-circle" size={13} color={theme.colors.danger} />
            <ThemedText variant="caption" style={styles.rejectionReason} numberOfLines={2}>
              {rejectionReason}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.right}>
        {/* No +/- sign: a request is only money moved once it is APPROVED, so
            the status chip below carries that meaning instead. */}
        <ThemedText variant="body" weight="bold" tabular numberOfLines={1} style={{ color: tone }}>
          {formatKyat(amount)}
        </ThemedText>
        <StatusChip status={status} label={statusLabel} />
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
    borderWidth: 1,
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
});
