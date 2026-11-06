import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { LtIcon, type LtIconName } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { HOME_COPY } from "@/lottery/screens/home/copy";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";

/** The three steps' glyphs: the dock's Draw, Tickets and Results icons. */
const ICONS: readonly LtIconName[] = ["draw", "tickets", "results"];

/**
 * 5 · PICK · BUY · CHECK (Main.dc.html `.lt-steps`): one quiet cream band —
 * three line icons on white discs joined by a dashed hairline, a seal step
 * number on each, two or three words under each. It replaced "How it works".
 * Read as one line, with its step numbers; the discs are decoration.
 *
 * The dashed joint is an svg line: a one-sided dashed border is not drawn
 * the same on Android and iOS.
 */
export const StepsStrip = memo(function StepsStrip() {
  const copy = HOME_COPY.steps;
  return (
    <View style={styles.band} accessible accessibilityLabel={copy.a11y(copy.title, copy.items)}>
      <View style={styles.list}>
        <View style={styles.joint} pointerEvents="none">
          <Svg width="100%" height={1}>
            <Line x1={0} y1={0.5} x2="100%" y2={0.5} stroke={LT.lineStrong} strokeWidth={1} strokeDasharray="3 3" />
          </Svg>
        </View>
        {copy.items.map((text, i) => (
          <View key={text} style={styles.item}>
            <View style={styles.disc}>
              <LtIcon name={ICONS[i]} size={22} color={LT.indigo} />
              <View style={styles.badge}>
                <LtText role="h" color={LT.white} style={styles.badgeText} maxFontSizeMultiplier={1}>
                  {String(i + 1)}
                </LtText>
              </View>
            </View>
            <LtText role="micro" color={LT.ink2} numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.text}>
              {text}
            </LtText>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  band: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: LT.cream,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
  },
  list: { flexDirection: "row" },
  /** From the first disc's centre to the last one's (`left/right 16.67%`), at the discs' middle. */
  joint: { position: "absolute", top: 20, left: "16.67%", right: "16.67%", height: 1 },
  item: { flex: 1, minWidth: 0, alignItems: "center" },
  disc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.lineStrong,
  },
  badge: {
    position: "absolute",
    top: -6,
    left: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.seal,
  },
  /** Literata 700 11, line height 1 (`.lt-steps__n`). */
  badgeText: { fontSize: 11, lineHeight: 13, includeFontPadding: false },
  text: { marginTop: 8, maxWidth: "100%", textAlign: "center" },
});
