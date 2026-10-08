import { StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressScale } from "@/components/wallet/PressScale";
import { ROW_INSET } from "@/hooks/useWalletLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  onDeposit: () => void;
  onWithdraw: () => void;
  onHistory: () => void;
}

interface Action {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  fill: string;
  ink: string;
  onPress: () => void;
}

/**
 * The three things people come to a wallet to do, one tap each and always on
 * screen (even while the balance is loading or failed): three equal 68pt
 * tiles, radius 12, a 22pt glyph over a 13pt ExtraBold label (Wallet.dc.html).
 * Deposit is the one white tile; Withdraw and History are white at 12% over
 * the hero art. Same three actions in the same order as before.
 */
export function QuickActions({ onDeposit, onWithdraw, onHistory }: Props) {
  const { t } = useLanguage();

  const actions: Action[] = [
    {
      key: "deposit",
      label: t.wallet.depositButton,
      icon: "arrow-down",
      fill: theme.colors.play,
      ink: theme.colors.onPlay,
      onPress: onDeposit,
    },
    {
      key: "withdraw",
      label: t.wallet.withdrawButton,
      icon: "arrow-up",
      fill: theme.colors.tonal,
      ink: theme.colors.text,
      onPress: onWithdraw,
    },
    {
      key: "history",
      label: t.wallet.historyButton,
      icon: "time-outline",
      fill: theme.colors.tonal,
      ink: theme.colors.text,
      onPress: onHistory,
    },
  ];

  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <PressScale
          key={action.key}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={[styles.tile, { backgroundColor: action.fill }]}
        >
          <Ionicons name={action.icon} size={22} color={action.ink} />
          {/* Wraps under the glyph at large text sizes rather than being cut. */}
          <ThemedText variant="caption" weight="extrabold" style={[styles.label, { color: action.ink }]}>
            {action.label}
          </ThemedText>
        </PressScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: theme.spacing.sm, paddingHorizontal: ROW_INSET },
  tile: {
    // Equal thirds, never a fixed minimum width: on a 320pt phone each third
    // is ~90pt, and anything narrower must shrink rather than overflow.
    flex: 1,
    minHeight: 68,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.button,
  },
  label: { textAlign: "center" },
});
