import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Button } from "@/components/ui/Button";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  /** What failed, in one quiet line ("Something went wrong"). */
  message: string;
  /** Asks again for THIS shelf's request only. */
  onRetry: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * A Books hub shelf whose own request failed, drawn in the shelf's place:
 * one quiet line and a Retry for just that request, so one failed shelf
 * never vanishes silently and never takes the rest of the page down with it.
 * The row wraps — at 320pt or a 2× text size the button drops under the words
 * instead of squeezing them.
 */
export function ShelfRetry({ message, onRetry, style }: Props) {
  const { t } = useLanguage();
  return (
    <View style={[styles.row, style]}>
      <ThemedText variant="muted" color={theme.colors.textMuted} style={styles.message}>
        {message}
      </ThemedText>
      <Button title={t.common.retry} variant="secondary" onPress={onRetry} labelLines={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 12,
    rowGap: theme.spacing.sm,
    paddingHorizontal: theme.layout.screenPadding,
  },
  message: { flexGrow: 1, flexShrink: 1, flexBasis: 160 },
});
