import { memo, useMemo, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LtText } from "@/lottery/components/LtText";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

/** The Tickets board's `waveAt`: a sine line starting at (x0, y0), 1pt steps. */
function waveAt(x0: number, y0: number, w: number, amp: number, period: number, phase: number): string {
  let d = "";
  for (let x = 0; x <= w; x += 1) {
    d += `${x ? "L" : "M"}${x0 + x} ${(y0 + amp * Math.sin((x / period) * 2 * Math.PI + phase)).toFixed(2)}`;
  }
  return d;
}

const TICKET_OUTLINE =
  "M10 22h52a2 2 0 0 1 2 2v7a5 5 0 0 0 0 10v7a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-7a5 5 0 0 0 0-10v-7a2 2 0 0 1 2-2z";

/** The mark on the stub: two print lines, or a plus (Draw's "Add your first number"). */
const MARK = { lines: "M51 33h7 M51 39h5", plus: "M55 31v10 M50 36h10" } as const;

/**
 * The empty state (lt-base 6.14): a 72pt line drawing — a ticket outline
 * with three guilloche hairlines — then a Literata 20 title, one line of
 * ink-2 and at most one action. "No tickets yet · Tickets you buy appear
 * here, one for each purchase. · Choose your number".
 *
 * `compact` is the one inside a card (Draw's "Your numbers"): no box of its
 * own, a 64pt drawing and an 18/24 title.
 */
export const LtEmpty = memo(function LtEmpty({
  title,
  text,
  action,
  mark = "lines",
  compact = false,
  style,
}: {
  title: string;
  text: string;
  /** One LtButton. */
  action?: ReactNode;
  mark?: keyof typeof MARK;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const art = compact ? 64 : 72;
  const waves = useMemo(
    () => [
      waveAt(13, 31, 28, 2.2, 9, 0),
      waveAt(13, 36, 28, 2.2, 9, Math.PI / 1.5),
      waveAt(13, 41, 28, 2.2, 9, Math.PI / 0.75),
    ],
    [],
  );
  return (
    <View style={[styles.box, compact && styles.boxCompact, style]}>
      <View
        style={compact ? styles.artCompact : styles.art}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width={art} height={art} viewBox="0 0 72 72" fill="none">
          <Path d={TICKET_OUTLINE} stroke={LT.ink3} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M46 22v4 M46 34v4 M46 46v4" stroke={LT.ink3} strokeWidth={1.5} strokeLinecap="round" />
          {waves.map((d, i) => (
            <Path key={i} d={d} stroke={LT.ink3} strokeWidth={0.75} />
          ))}
          <Path d={MARK[mark]} stroke={LT.ink3} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      </View>
      <LtText role="title" accessibilityRole="header" style={[styles.center, compact && styles.titleCompact]}>
        {title}
      </LtText>
      <LtText role="meta" color={LT.ink2} style={[styles.center, styles.text]}>
        {text}
      </LtText>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    gap: 8,
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    boxShadow: LT_SHADOW.s1,
  },
  /** Inside a card: no second card around it (board `.lt-lcard .lt-empty`: padding 12 8 4). */
  boxCompact: {
    paddingTop: 12,
    paddingHorizontal: 8,
    paddingBottom: 4,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 0,
    boxShadow: [],
  },
  art: { marginBottom: 8 },
  artCompact: { marginBottom: 4 },
  center: { textAlign: "center" },
  titleCompact: { fontSize: 18, lineHeight: 24 },
  text: { maxWidth: 280 },
  action: { marginTop: 12 },
});
