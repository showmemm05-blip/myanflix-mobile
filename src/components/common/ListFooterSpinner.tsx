import { ActivityIndicator, StyleSheet, View } from "react-native";
import { theme } from "@/theme";

/**
 * The "next page is on the wire" row at the foot of an endless list — the
 * same small violet spinner the Media screen draws under its results, spelled
 * once so every paged list (watch history, notifications, the wallet ledgers,
 * a category) ends the same way. Renders nothing while idle, so a list that
 * has reached its last page ends flush against its own bottom padding.
 *
 * Hand `ListFooterComponent` the ELEMENT, built under a `useMemo` keyed on
 * `isFetchingNextPage`. FlatList is a PureComponent that compares the prop by
 * identity, so a fresh `<ListFooterSpinner/>` per render (or an inline arrow)
 * would count as a changed prop on every parent render; memoized, the
 * identity only moves when the spinner should appear or go.
 */
export function ListFooterSpinner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.footer}>
      <ActivityIndicator size="small" color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  /** The Media screen's own `footerLoading` — same inset, so the two footers match. */
  footer: { paddingVertical: theme.spacing.md, alignItems: "center" },
});
