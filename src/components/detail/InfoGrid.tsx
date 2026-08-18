import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

interface InfoItem {
  label: string;
  value: string;
}

/** Two-column key/value block under a detail synopsis — quiet wells, tabular values. */
export function InfoGrid({ items }: { items: InfoItem[] }) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.label} style={styles.cell}>
          <ThemedText variant="overline" numberOfLines={1}>
            {item.label.toUpperCase()}
          </ThemedText>
          <ThemedText variant="body" weight="semibold" numberOfLines={1} tabular>
            {item.value}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  cell: {
    flexGrow: 1,
    flexBasis: "45%",
    gap: 3,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
