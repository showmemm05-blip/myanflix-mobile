import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

/** Gold star + tabular figures, so a row of ratings never jitters. */
export function RatingBadge({ rating }: { rating: number }) {
  return (
    <View style={styles.container}>
      <Ionicons name="star" size={12} color={theme.colors.premium} />
      <ThemedText variant="caption" weight="semibold" tabular style={styles.text}>
        {rating.toFixed(1)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.overlay,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.ring,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  text: { color: theme.colors.text },
});
