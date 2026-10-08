import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

interface Props {
  /** The quiet line above the title ("The shelf"). */
  eyebrow: string;
  title: string;
  /** Drawn inline right after the title (the live section's pulsing dot). */
  adornment?: ReactNode;
  /** Air above the section — 36 between sections, 28 under the hero pager. */
  spacing?: number;
  /** Air between the header and the section body (the board: 14; the live list: 6). */
  bodyGap?: number;
  /** Page inset for the header — the screen gutter. */
  gutter?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The storefront's section rhythm (Main.dc.html): no rule, no tile — a quiet
 * 13/18 eyebrow over a 19/26 extra-bold title, then the body. Both lines wrap
 * instead of truncating: Burmese headings run ~50% longer than English and
 * must survive 320pt and 2× text.
 */
export function ArcadeSection({
  eyebrow,
  title,
  adornment,
  spacing = 36,
  bodyGap = 14,
  gutter = theme.layout.screenPadding,
  children,
  style,
}: Props) {
  return (
    <View style={[{ marginTop: spacing }, style]}>
      <View style={[styles.header, { paddingHorizontal: gutter, marginBottom: bodyGap }]}>
        <ThemedText variant="caption" weight="semibold" color={theme.colors.textFaint}>
          {eyebrow}
        </ThemedText>
        <View style={styles.titleRow}>
          <ThemedText variant="section" accessibilityRole="header" style={styles.title}>
            {title}
          </ThemedText>
          {adornment}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { flexShrink: 1 },
});
