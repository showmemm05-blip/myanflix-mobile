import { StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { MethodLogo } from "@/components/wallet/MethodLogo";
import { PressScale } from "@/components/wallet/PressScale";
import { ROW_INSET } from "@/hooks/useWalletLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";
import type { PaymentAccount } from "@/types/payment-account";

interface Props {
  account: PaymentAccount;
  /** The payment method in words ("KBZPay", "Bank Account - AYA"). */
  methodLabel: string;
  logoUrl: string | null;
  copied: boolean;
  onCopy: () => void;
}

/** Holds the copied line's place, so the note under it never jumps when it appears. */
const COPIED_LINE = 20;

/**
 * The business account a deposit is sent to, on the confirm step
 * (DepositStep2.dc.html): the method and holder beside a 48pt logo tile, then
 * the number large (26pt Black, tabular, selectable) with a round copy button
 * beside it and a green "copied" line under it, then the bank and the admin's
 * note. Flat on the page. The copy button is its own 44pt target.
 */
export function PaymentAccountDetails({ account, methodLabel, logoUrl, copied, onCopy }: Props) {
  const { t } = useLanguage();

  return (
    <View style={styles.block}>
      <View style={styles.identity}>
        <MethodLogo logoUrl={logoUrl} label={methodLabel} bank={!!account.bankName} size={48} />
        <View style={styles.identityText}>
          <ThemedText weight="extrabold" style={styles.method}>
            {methodLabel}
          </ThemedText>
          <ThemedText variant="caption" weight="regular" style={styles.faint}>
            {account.accountName}
          </ThemedText>
        </View>
      </View>

      <ThemedText variant="caption" weight="regular" style={[styles.faint, styles.numberLabel]}>
        {t.wallet.depositAccountNumber}
      </ThemedText>
      <View style={styles.numberRow}>
        <ThemedText weight="black" tabular selectable style={styles.number}>
          {account.accountNumber}
        </ThemedText>
        <PressScale
          onPress={onCopy}
          hitSlop={4}
          style={[styles.copyButton, copied && styles.copyButtonDone]}
          accessibilityRole="button"
          accessibilityLabel={t.wallet.copyAccountNumber}
        >
          <Ionicons
            name={copied ? "checkmark" : "copy-outline"}
            size={20}
            color={copied ? theme.colors.finance : theme.colors.text}
          />
        </PressScale>
      </View>
      {/* The flow announces the copy itself, so this line is for the eyes only. */}
      <View style={styles.copiedLine} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {copied ? (
          <>
            <Ionicons name="checkmark" size={14} color={theme.colors.finance} />
            <ThemedText variant="caption" weight="bold" style={styles.copiedText}>
              {t.wallet.copied}
            </ThemedText>
          </>
        ) : null}
      </View>

      {account.bankName ? (
        <View style={styles.bankRow}>
          <ThemedText variant="caption" weight="regular" style={styles.faint}>
            {t.wallet.depositBankName}
          </ThemedText>
          <ThemedText variant="caption" weight="bold" style={styles.bankName}>
            {account.bankName}
          </ThemedText>
        </View>
      ) : null}

      {account.note ? (
        <ThemedText variant="caption" weight="regular" style={styles.note}>
          {account.note}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: ROW_INSET },
  identity: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 14 },
  identityText: { flex: 1 },
  method: { fontSize: 17 },
  faint: { color: theme.colors.textFaint },
  numberLabel: { marginTop: 20 },
  numberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 48,
    marginTop: 6,
  },
  number: { flexShrink: 1, fontSize: 26, lineHeight: 32, letterSpacing: -0.26 },
  copyButton: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    borderRadius: theme.layout.minTouch / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.tonal,
  },
  copyButtonDone: { backgroundColor: withAlpha(theme.colors.finance, 0.16) },
  copiedLine: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: COPIED_LINE, marginTop: 4 },
  copiedText: { flexShrink: 1, color: theme.colors.finance },
  bankRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: theme.spacing.sm, marginTop: 12 },
  bankName: { flexShrink: 1, color: theme.colors.textBody },
  note: { marginTop: 12, color: theme.colors.textMuted },
});
