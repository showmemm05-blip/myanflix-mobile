import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { SignageChip } from "@/components/arcade/ArcadeBadge";
import { theme } from "@/theme";
import { useLanguage } from "@/localization/LanguageProvider";

interface Props {
  style?: StyleProp<ViewStyle>;
}

/**
 * "Free" in ArcadeBadge's sharp signage chip — literally that chip now, not a
 * copy of it — in finance green, rendered wherever a kyat figure would sit for
 * a free game. The label is translated copy, so it renders in the sans face,
 * never the mono slug.
 */
export function FreeTag({ style }: Props) {
  const { t } = useLanguage();

  return (
    <SignageChip tone={theme.colors.finance} style={style}>
      <ThemedText variant="caption" weight="semibold" style={styles.label}>
        {t.arcade.price.free}
      </ThemedText>
    </SignageChip>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, lineHeight: 15, color: theme.colors.finance },
});
