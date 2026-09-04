import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Surface } from "@/components/ui/Surface";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  releaseYear?: number | null;
  language?: string | null;
  genre?: string | null;
}

interface FactRow {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

/**
 * The quiet facts table at the foot of the series spine — hairline-separated
 * label/value rows, reusing the movie detail's keys so the two screens never
 * mint duplicate wording.
 */
export function SeriesFacts({ releaseYear, language, genre }: Props) {
  const { t } = useLanguage();

  const rows: FactRow[] = [];
  if (releaseYear != null) {
    rows.push({ key: "year", icon: "calendar-outline", label: t.movie.releaseYear, value: String(releaseYear) });
  }
  if (language) {
    rows.push({ key: "language", icon: "language-outline", label: t.movie.language, value: language });
  }
  if (genre) {
    rows.push({ key: "genre", icon: "pricetags-outline", label: t.movie.genre, value: genre });
  }

  if (rows.length === 0) return null;

  return (
    <Surface tone="flat" radius="xl">
      {rows.map((row, index) => (
        <View key={row.key} style={[styles.row, index < rows.length - 1 && styles.rowDivider]}>
          <View style={styles.labelSide}>
            <Ionicons name={row.icon} size={14} color={theme.colors.textFaint} />
            <ThemedText variant="caption" numberOfLines={1} color={theme.colors.textMuted}>
              {row.label}
            </ThemedText>
          </View>
          <ThemedText variant="caption" numberOfLines={1} tabular color={theme.colors.text} style={styles.value}>
            {row.value}
          </ThemedText>
        </View>
      ))}
    </Surface>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  labelSide: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexShrink: 1 },
  value: { flexShrink: 1, textAlign: "right" },
});
