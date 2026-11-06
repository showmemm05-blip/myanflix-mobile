import { StyleSheet } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

interface Props {
  /** Already phrased: "Search everything for “rain”". */
  label: string;
  onPress: () => void;
}

/**
 * The quiet way out of a locked search (MediaSearchMovies.dc.html): one
 * full-width 48pt row under the results — or under the empty state — that
 * reopens the search on every section with the same term. Text and a
 * chevron, no fill: it is an escape, not a call to action.
 */
export function SearchEverythingLink({ label, onPress }: Props) {
  return (
    <PressableScale onPress={onPress} dimOnPress accessibilityLabel={label} style={styles.row}>
      <ThemedText variant="body" weight="bold" color={theme.colors.textBody} numberOfLines={2} style={styles.label}>
        {label}
      </ThemedText>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.textFaint} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 48,
    marginTop: 12,
    marginHorizontal: theme.layout.screenPadding,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.button,
  },
  label: { flexShrink: 1, textAlign: "center" },
});
