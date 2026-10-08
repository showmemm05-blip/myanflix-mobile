import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

/**
 * The library boards' page title: 34/38 black under the back button, 8pt
 * down and 16pt in, scrolling WITH the page (it is the first thing in the
 * list, not pinned in the bar). It wraps instead of clamping, so a long
 * Burmese title at a large font size simply takes another line. `meta` is the
 * quiet line under it ("24 titles · Newest first").
 */
export function PageHeading({
  title,
  meta,
  style,
}: {
  title: string;
  meta?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.container, style]}>
      <ThemedText variant="display" accessibilityRole="header">
        {title}
      </ThemedText>
      {meta ? <View style={styles.meta}>{meta}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: theme.layout.screenPadding, paddingTop: theme.spacing.sm },
  meta: { marginTop: theme.spacing.xs },
});
