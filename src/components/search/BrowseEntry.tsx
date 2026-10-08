import { StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/**
 * The search screen's door to the Browse page (All / Movies, before a
 * search) — the owner's 2026-10-02 decision that Browse (and through it every
 * category) must be reachable; MediaSearch.dc.html draws it as one quiet
 * full-width row: a crimson-tinted glyph tile, the label, a chevron.
 */
export function BrowseEntry({ onPress }: { onPress: () => void }) {
  const { t } = useLanguage();
  return (
    <PressableScale onPress={onPress} dimOnPress accessibilityLabel={t.search.browseCategories} style={styles.row}>
      <View style={styles.tile}>
        <Ionicons name="grid-outline" size={20} color={theme.colors.primary} />
      </View>
      <View style={styles.text}>
        <ThemedText weight="extrabold">{t.search.browseCategories}</ThemedText>
        <ThemedText variant="caption" weight="regular" color={theme.colors.textFaint}>
          {t.search.browseCategoriesBody}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textFaint} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    marginHorizontal: theme.layout.screenPadding,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.surfaceElevated,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, minWidth: 0 },
});
