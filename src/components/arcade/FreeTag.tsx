import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme, withAlpha } from "@/theme";
import { useLanguage } from "@/localization/LanguageProvider";

interface Props {
  style?: StyleProp<ViewStyle>;
}

/**
 * "Free" in the same sharp signage chip as ArcadeBadge, in finance green —
 * rendered wherever a kyat figure would sit for a free game. The label is
 * translated copy, so it renders in the sans face, never the mono slug.
 */
export function FreeTag({ style }: Props) {
  const { t } = useLanguage();

  return (
    <View style={[styles.chip, style]}>
      <ThemedText variant="caption" weight="semibold" style={styles.label}>
        {t.arcade.price.free}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.finance, 0.4),
    backgroundColor: withAlpha(theme.colors.finance, 0.16),
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  label: { fontSize: 11, lineHeight: 15, color: theme.colors.finance },
});
