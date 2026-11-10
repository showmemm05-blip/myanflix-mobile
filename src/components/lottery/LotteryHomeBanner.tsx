import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root (TabBar explains).
import Ionicons from "@expo/vector-icons/Ionicons";
import { HUB_SECTION_GAP } from "@/components/hub/hubLayout";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { LtEmblem } from "@/lottery/components/Ornaments";
import { LT } from "@/lottery/theme/tokens";
import { theme } from "@/theme";

/**
 * The Lottery's door on the movies Home (owner, 2026-10-15, entry point B): a
 * small WHITE card between the hero and the rows — a glimpse of the Ivory
 * app on the dark page — with the lotus emblem, the LOTTERY kicker in seal
 * red, the four games, and one seal "Open Lottery" button that opens the
 * Lottery tab's hub. ThemedText only (Noto Sans Myanmar): Home never loads
 * the Lottery's fonts. It asks for nothing and shows no numbers.
 */
export const LotteryHomeBanner = memo(function LotteryHomeBanner({
  first,
  onOpen,
}: {
  first?: boolean;
  onOpen: () => void;
}) {
  const { t } = useLanguage();
  return (
    <View style={[styles.section, first ? styles.first : styles.later]}>
      <View style={styles.card}>
        <View style={styles.kickerRow}>
          <LtEmblem size={28} />
          <ThemedText variant="overline" color={LT.seal} style={styles.kicker}>
            {t.lottery.bannerKicker}
          </ThemedText>
        </View>
        <ThemedText variant="section" color={LT.ink} accessibilityRole="header" style={styles.title}>
          {t.lottery.bannerTitle}
        </ThemedText>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={t.lottery.bannerA11y}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <ThemedText weight="bold" color={LT.white} numberOfLines={1}>
            {t.lottery.bannerCta}
          </ThemedText>
          <Ionicons name="chevron-forward" size={18} color={LT.white} accessible={false} importantForAccessibility="no" />
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { paddingHorizontal: theme.layout.screenPadding },
  /** First under the hero: 20pt under the hero's dots row (the board's gap there). */
  first: { marginTop: 20 },
  later: { marginTop: HUB_SECTION_GAP },
  card: {
    padding: 16,
    backgroundColor: LT.paper,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: 16,
  },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  kicker: { textTransform: "uppercase" },
  title: { marginTop: 10 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    minHeight: theme.layout.minTouch,
    marginTop: 14,
    paddingLeft: 18,
    paddingRight: 14,
    borderRadius: theme.radius.button,
    backgroundColor: LT.seal,
  },
  buttonPressed: { backgroundColor: LT.sealPress },
});
