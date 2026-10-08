import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { FlowButton } from "@/components/wallet/MoneyFlow";
import { ROW_INSET } from "@/hooks/useWalletLayout";
import { theme, withAlpha } from "@/theme";

interface Props {
  message: string;
  /** One quiet line under the message — what to try next. */
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  /**
   * The state's role colour — danger for a failed list, green for deposits,
   * blue for withdrawals. It draws the glyph and tints its disc; neutral
   * (muted ink on white at 8%) by default.
   */
  tone?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** tonal (default) = white at 16%; play = the white primary (the empty wallet's Deposit). */
  actionVariant?: "tonal" | "play";
  actionIcon?: keyof typeof Ionicons.glyphMap;
  /** md = the wallet's recent list (64pt disc, 17pt line); lg = History's page states (72pt disc, 19pt line). */
  size?: "md" | "lg";
  style?: StyleProp<ViewStyle>;
}

const LOOK = {
  md: { disc: 64, glyph: 28, top: 36, messageGap: theme.spacing.md, actionGap: 18, messageSize: 17 },
  lg: { disc: 72, glyph: 30, top: 64, messageGap: 18, actionGap: theme.spacing.lg - 4, messageSize: 19 },
} as const;

/**
 * A wallet list's empty / no-results / failed state (Wallet.dc.html,
 * WalletHistory.dc.html): a glyph on a soft round disc in the state's role
 * colour, one centred ExtraBold line, an optional quiet hint and, when there
 * is something to do about it, one 48pt button. Flat on the page, no card.
 */
export function ListState({
  message,
  hint,
  icon,
  tone,
  actionLabel,
  onAction,
  actionVariant = "tonal",
  actionIcon,
  size = "md",
  style,
}: Props) {
  const look = LOOK[size];
  const ink = tone ?? theme.colors.textMuted;
  const tint = tone ? withAlpha(tone, 0.14) : theme.colors.tonalSoft;

  return (
    <View style={[styles.container, { paddingTop: look.top }, style]} accessibilityLiveRegion="polite">
      <View
        style={[
          styles.disc,
          { width: look.disc, height: look.disc, borderRadius: look.disc / 2, backgroundColor: tint },
        ]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Ionicons name={icon} size={look.glyph} color={ink} />
      </View>
      <ThemedText
        variant="section"
        style={[styles.message, { marginTop: look.messageGap, fontSize: look.messageSize }]}
      >
        {message}
      </ThemedText>
      {hint ? <ThemedText style={styles.hint}>{hint}</ThemedText> : null}
      {actionLabel && onAction ? (
        <FlowButton
          title={actionLabel}
          variant={actionVariant}
          size="md"
          icon={actionIcon}
          onPress={onAction}
          style={{ marginTop: look.actionGap }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingBottom: theme.spacing.sm,
    paddingHorizontal: ROW_INSET * 2,
  },
  disc: { alignItems: "center", justifyContent: "center" },
  message: { textAlign: "center" },
  hint: { marginTop: 6, maxWidth: 280, textAlign: "center", color: theme.colors.textMuted },
});
