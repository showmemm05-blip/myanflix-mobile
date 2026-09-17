import { Pressable, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Surface } from "@/components/ui/Surface";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { languageLabel, languageSubLabel } from "@/utils/bookLanguages";
import { withAlpha, theme } from "@/theme";
import type { BookEdition } from "@/types/book";

interface Props {
  editions: BookEdition[];
  selectedEditionId: string | null | undefined;
  onSelect: (edition: BookEdition) => void;
}

/**
 * "Available languages" — the edition picker. Language is the organising axis
 * of a book (each edition holds its own chapters and its own bookmark), so
 * choosing a row re-points everything below it on the detail screen.
 */
export function LanguagePanel({ editions, selectedEditionId, onSelect }: Props) {
  const { t } = useLanguage();
  if (editions.length === 0) return null;

  return (
    <View style={styles.container}>
      <ThemedText variant="overline">{t.books.availableLanguages.toUpperCase()}</ThemedText>

      {editions.length === 1 ? (
        <Surface tone="flat" radius="xl" style={styles.row}>
          <LanguageLabels code={editions[0].language} />
        </Surface>
      ) : (
        <View style={styles.rows}>
          {editions.map((edition) => {
            const selected = edition.id === selectedEditionId;
            return (
              <Pressable
                key={edition.id}
                onPress={() => onSelect(edition)}
                accessibilityRole="button"
                accessibilityLabel={languageLabel(edition.language)}
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.row,
                  styles.pressableRow,
                  selected && styles.selectedRow,
                  pressed && styles.pressed,
                ]}
              >
                <LanguageLabels code={edition.language} />
                {selected && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function LanguageLabels({ code }: { code: string }) {
  const sub = languageSubLabel(code);
  return (
    <View style={styles.labels}>
      <ThemedText variant="body" weight="semibold" numberOfLines={1}>
        {languageLabel(code)}
      </ThemedText>
      {sub && (
        <ThemedText variant="caption" numberOfLines={1}>
          {sub}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm },
  rows: { gap: theme.spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    minHeight: theme.layout.minTouch + 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  pressableRow: {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  selectedRow: {
    borderColor: withAlpha(theme.colors.primary, 0.24),
    backgroundColor: theme.colors.accent,
  },
  pressed: { opacity: 0.75 },
  labels: { flex: 1, gap: 1 },
});
