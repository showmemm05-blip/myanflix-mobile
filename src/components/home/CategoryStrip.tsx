import { ScrollView, StyleSheet, View } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { Surface } from "@/components/ui/Surface";
import { ThemedText } from "@/components/ui/ThemedText";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/common/Skeleton";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { Category } from "@/types/category";

interface Props {
  title: string;
  categories: Category[];
  onPressCategory: (categoryId: string) => void;
  loading?: boolean;
}

/**
 * The browse-by-genre strip: swipeable tiles, each a 44pt+ target showing the
 * genre and how many titles sit behind it (tabular figures so the counts line
 * up as they refresh).
 */
export function CategoryStrip({ title, categories, onPressCategory, loading }: Props) {
  const { t } = useLanguage();

  if (!loading && categories.length === 0) return null;

  return (
    <View style={styles.container}>
      <SectionHeader title={title} icon="grid-outline" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {loading && categories.length === 0
          ? Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} width={132} height={72} radius="xl" />
            ))
          : categories.map((category) => (
              <PressableScale
                key={category.id}
                onPress={() => onPressCategory(category.id)}
                accessibilityLabel={category.name}
              >
                <Surface radius="xl" padded style={styles.tile}>
                  <ThemedText variant="body" weight="semibold" numberOfLines={1}>
                    {category.name}
                  </ThemedText>
                  <ThemedText variant="caption" tabular numberOfLines={1}>
                    {t.search.resultsCount.replace("{n}", String(category.movieCount))}
                  </ThemedText>
                </Surface>
              </PressableScale>
            ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.xs },
  row: { paddingHorizontal: theme.layout.screenPadding, gap: theme.spacing.sm, paddingBottom: theme.spacing.xs },
  tile: { minWidth: 132, minHeight: 72, justifyContent: "center", gap: 2 },
});
