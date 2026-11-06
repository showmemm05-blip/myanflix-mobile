import { memo, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { LT } from "@/lottery/theme/tokens";

/**
 * The Ivory Press ornaments (spec §1.6): the lotus emblem, the guilloche band,
 * the double rule and the dashed rule. All decorative — hidden from screen readers.
 */

const EMBLEM_PETALS =
  "M16 9c2 2.5 2 6 0 9-2-3-2-6.5 0-9zM16 18c-2.6-.6-5-2.6-6-5.4 2.8.3 5 2.2 6 5.4zM16 18c2.6-.6 5-2.6 6-5.4-2.8.3-5 2.2-6 5.4zM10 21h12M12 23.5h8";

/** The original lotus medallion — our own emblem, never a real lottery's seal. */
export const LtEmblem = memo(function LtEmblem({ size = 26, color = LT.seal }: { size?: number; color?: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Circle cx={16} cy={16} r={15} stroke={color} strokeWidth={1.25} />
      <Circle cx={16} cy={16} r={12.5} stroke={color} strokeWidth={1.25} strokeDasharray="1 1.6" />
      <Path d={EMBLEM_PETALS} stroke={color} strokeWidth={1.25} />
    </Svg>
  );
});

/** One sine line of the band (the spec's `wave(w, h, amp, period, phase)`, 2pt steps). */
export function wavePath(width: number, height: number, amp: number, period: number, phase: number): string {
  let d = "";
  for (let x = 0; x <= width; x += 2) {
    const y = height / 2 + amp * Math.sin((x / period) * 2 * Math.PI + phase);
    d += `${x ? "L" : "M"}${x} ${y.toFixed(2)}`;
  }
  return d;
}

interface GuillocheProps {
  width: number;
  height: number;
  /** Wave height; the spec's band uses 18. */
  amp?: number;
  /** Wave length; the spec's band uses 36. */
  period?: number;
  /** How wide the six waves are drawn (defaults to `width`); the boards draw a 360 band into a 200 box. */
  pathWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Six phase-shifted sine hairlines in indigo at 16% — the only decoration
 * Ivory Press allows (hero corners, the draw card, empty states). Drawn at
 * `pathWidth` and clipped to `width` × `height`, like the boards' SVG.
 */
export const Guilloche = memo(function Guilloche({
  width,
  height,
  amp = 18,
  period = 36,
  pathWidth,
  style,
}: GuillocheProps) {
  const paths = useMemo(() => {
    const w = pathWidth ?? width;
    return Array.from({ length: 6 }, (_, k) => wavePath(w, height, amp, period, (k * Math.PI) / 3));
  }, [width, height, amp, period, pathWidth]);
  return (
    <View
      style={[{ width, height, overflow: "hidden", opacity: 0.16 }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={pathWidth ?? width} height={height} fill="none">
        {paths.map((d, k) => (
          <Path key={k} d={d} stroke={LT.indigo} strokeWidth={0.75} />
        ))}
      </Svg>
    </View>
  );
});

/**
 * The printed edge (spec §1.6): 4pt tall, a 1pt line top and bottom — seal
 * on draw cards, gold edge on result cards.
 */
export const DoubleRule = memo(function DoubleRule({
  tone,
  style,
}: {
  tone: "seal" | "gold";
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[styles.rule, { borderColor: tone === "seal" ? LT.seal : LT.goldEdge }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
});

/**
 * A dashed hairline across its box (the receipt lines, the voucher's tear): an
 * svg line, as a one-sided dashed border is not drawn the same on Android and
 * iOS. `dash` is the svg dash pattern ("3 3").
 */
export const DashedRule = memo(function DashedRule({
  color = LT.line,
  dash = "3 3",
  style,
}: {
  color?: string;
  dash?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.dashed, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height={1}>
        <Line x1={0} y1={0.5} x2="100%" y2={0.5} stroke={color} strokeWidth={1} strokeDasharray={dash} />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  rule: { height: 4, borderTopWidth: 1, borderBottomWidth: 1 },
  dashed: { height: 1 },
});
