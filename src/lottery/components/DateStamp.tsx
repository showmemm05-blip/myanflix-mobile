import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { LtText } from "@/lottery/components/LtText";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

/**
 * The date stamp (lt-base 6.1): 48 × 52, white, 1pt line, radius 4 — the
 * month in seal caps over the day in Literata 20. Decorative: the date is
 * always written out beside it, so screen readers skip it.
 */
export const DateStamp = memo(function DateStamp({ month, day }: { month: string; day: string }) {
  return (
    <View style={styles.stamp} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LtText role="microB" color={LT.seal} style={styles.month} maxFontSizeMultiplier={1.2}>
        {month}
      </LtText>
      <LtText role="title" style={styles.day} maxFontSizeMultiplier={1.2}>
        {day}
      </LtText>
    </View>
  );
});

const styles = StyleSheet.create({
  stamp: {
    width: 48,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.tag,
    boxShadow: LT_SHADOW.s1,
  },
  month: { textTransform: "uppercase", letterSpacing: 0.96 },
  day: { lineHeight: 24 },
});
