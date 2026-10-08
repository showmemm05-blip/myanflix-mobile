import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { FlowButton } from "@/components/wallet/MoneyFlow";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The wallet's small "this part failed" line — a red glyph, the message and a
 * 44pt tonal Retry (pulsing dots while it retries) — for a piece of a screen
 * or sheet that could not load, where a whole error state would be out of
 * proportion. It wraps instead of squeezing, and the message is a polite live
 * region so TalkBack hears it.
 */
export function InlineError({ message, onRetry, retrying, style }: Props) {
  const { t } = useLanguage();

  return (
    <View style={[styles.row, style]}>
      <View style={styles.message} accessible accessibilityLiveRegion="polite" accessibilityLabel={message}>
        <Ionicons name="alert-circle-outline" size={18} color={theme.colors.danger} />
        <ThemedText weight="regular" style={styles.text}>
          {message}
        </ThemedText>
      </View>
      <FlowButton title={t.common.retry} variant="tonal" size="sm" onPress={onRetry} loading={retrying} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 10, rowGap: theme.spacing.xs },
  message: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  text: { flexShrink: 1, color: theme.colors.textBody },
});
