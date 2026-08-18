import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/ThemedText";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/** Below this a description always fits, so the toggle would be noise. */
const COLLAPSE_THRESHOLD = 180;
const COLLAPSED_LINES = 4;

interface Props {
  text: string;
  /** Heading above the copy — pass `t.movie.synopsis`. */
  title: string;
}

/** Description block that collapses long copy behind a Show more / Show less toggle. */
export function Synopsis({ text, title }: Props) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const trimmed = text?.trim() ?? "";

  if (trimmed.length === 0) return null;
  const collapsible = trimmed.length > COLLAPSE_THRESHOLD;

  return (
    <View style={styles.container}>
      <SectionHeader title={title} inset={false} style={styles.header} />
      <ThemedText
        variant="body"
        numberOfLines={collapsible && !expanded ? COLLAPSED_LINES : undefined}
        style={styles.body}
      >
        {trimmed}
      </ThemedText>

      {collapsible && (
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          style={styles.toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? t.common.showLess : t.common.showMore}
        >
          <ThemedText variant="label" weight="semibold" style={styles.toggleText}>
            {expanded ? t.common.showLess : t.common.showMore}
          </ThemedText>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={theme.colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.xs },
  header: { marginBottom: theme.spacing.xs },
  body: { color: theme.colors.textMuted },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: theme.layout.minTouch,
    alignSelf: "flex-start",
  },
  toggleText: { color: theme.colors.primary },
});
