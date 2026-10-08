import { View, StyleSheet } from "react-native";
// The crown is an SVG (CrownGlyph), the same shape MediaCard and the rails draw.
import { CrownGlyph } from "@/components/common/CrownGlyph";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { AccessType } from "@/types/movie";

/**
 * The app's ONE access badge — Marquee's label chip: 24pt tall, radius 6,
 * 11pt extra-bold capitals (Latin only; Burmese is never uppercased or
 * tracked — ThemedText drops the tracking for it). PREMIUM is gold ink with a
 * crown on the gold tint (9.2:1); FREE is green ink on the green tint (7.8:1).
 * Lives in common/ because the detail/home/subscribe screens stamp it beside a
 * title — one implementation keeps them from drifting apart.
 */
export function AccessBadge({ accessType }: { accessType: AccessType }) {
  const { t } = useLanguage();
  const isFree = accessType === "FREE";
  const ink = isFree ? theme.colors.finance : theme.colors.premium;

  return (
    <View style={[styles.container, isFree ? styles.free : styles.premium]}>
      {!isFree && <CrownGlyph size={11} color={ink} />}
      <ThemedText variant="overline" color={ink}>
        {(isFree ? t.movie.free : t.movie.premium).toUpperCase()}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 24,
    borderRadius: 6,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
  },
  free: { backgroundColor: theme.colors.financeSoft },
  premium: { backgroundColor: theme.colors.premiumSoft },
});
