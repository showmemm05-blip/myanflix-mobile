import { StyleSheet, View } from "react-native";
import { Surface } from "@/components/ui/Surface";
import { ThemedText } from "@/components/ui/ThemedText";
import { Pill } from "@/components/ui/Pill";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { MovieCategoryRef } from "@/types/category";

interface Props {
  /** Genre words stay Latin (web rule) — rendered as the violet kicker. */
  genre?: string | null;
  description?: string | null;
  categories?: MovieCategoryRef[];
}

/**
 * The web series page's storyline block: genre kicker, "Storyline" heading,
 * the synopsis, and the category chips in one card.
 */
export function StorylineCard({ genre, description, categories = [] }: Props) {
  const { t } = useLanguage();

  if (!description && categories.length === 0) return null;

  return (
    <Surface padded radius="xl">
      <View style={styles.inner}>
        {genre ? (
          <ThemedText variant="overline" numberOfLines={1} color={theme.colors.primary}>
            {genre.toUpperCase()}
          </ThemedText>
        ) : null}

        <ThemedText variant="section">{t.series.storyline}</ThemedText>

        {description ? (
          <ThemedText variant="body" color={theme.colors.textMuted}>
            {description}
          </ThemedText>
        ) : null}

        {categories.length > 0 && (
          <View style={styles.chips}>
            {categories.map((category) => (
              <Pill key={category.id} tone="neutral">
                {category.name}
              </Pill>
            ))}
          </View>
        )}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  inner: { gap: theme.spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.xs },
});
