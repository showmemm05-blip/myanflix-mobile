import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "@/theme";

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The storefront's section rhythm: every section below the hero opens with a
 * 1px hairline rule (inset to the page gutter so full-bleed rails inside the
 * section can still run edge to edge) and the standard xl/lg breathing room.
 */
export function SectionRule({ children, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.rule} />
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: theme.spacing.xl },
  rule: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.layout.screenPadding,
  },
  body: { paddingTop: theme.spacing.lg },
});
