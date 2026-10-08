import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "@/components/common/Skeleton";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/**
 * The player's first wait (Player.dc.html, "loading"): the black strip under
 * the cutout, the 16:9 stage as one pulsing block, then the title, meta line,
 * the two action buttons, the category chips and three lines of synopsis —
 * the shape of what is about to land, never a spinner. The pulse holds still
 * under reduce motion (Skeleton).
 */
export function PlayerLoading() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t.common.loading}
    >
      <View style={[styles.cutout, { height: insets.top }]} />
      <Skeleton height={Math.round((width * 9) / 16)} radius="xs" style={styles.stage} />
      <View style={styles.column}>
        <Skeleton width={220} height={26} radius="sm" />
        <Skeleton width={168} height={14} radius="xs" style={styles.meta} />
        <View style={styles.row}>
          <Skeleton width={176} height={48} radius="lg" />
          <Skeleton width={104} height={48} radius="lg" />
        </View>
        <View style={styles.chips}>
          <Skeleton width={72} height={34} radius="xl" />
          <Skeleton width={72} height={34} radius="xl" />
          <Skeleton width={132} height={34} radius="xl" />
        </View>
        <Skeleton height={12} radius="xs" style={styles.firstLine} />
        <Skeleton width="92%" height={12} radius="xs" style={styles.line} />
        <Skeleton width="60%" height={12} radius="xs" style={styles.line} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  cutout: { backgroundColor: "#000" },
  // The stage, 16:9 of the window's width like the real one, square-cornered.
  stage: { borderRadius: 0, backgroundColor: theme.colors.surface },
  column: { paddingTop: 20, paddingHorizontal: theme.layout.screenPadding },
  meta: { marginTop: 14 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.md },
  firstLine: { marginTop: theme.spacing.xl },
  line: { marginTop: 10 },
});
