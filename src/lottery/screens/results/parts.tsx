import { memo, useEffect, useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { LT, LT_EASE, LT_RADIUS } from "@/lottery/theme/tokens";

/**
 * Small pieces shared by the Results page's three parts (the latest prize
 * sheet, Check a number, Earlier results). Kept in this folder so the round-2
 * Results work never edits a shared component.
 */

/**
 * A chevron that turns to show open / closed, 200ms on the Lottery curve (at
 * once under reduced motion). `from` / `to` are the closed / open angles:
 * a "Show all" chevron points down and flips up (0 → 180); a row's chevron
 * points down and turns up (90 → −90, lt-base `.lt-xrow__chev`).
 */
export function TurningChevron({
  open,
  from,
  to,
  size,
  color,
  name = "down",
}: {
  open: boolean;
  from: number;
  to: number;
  size: number;
  color: string;
  name?: "down" | "next";
}) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(open ? to : from);
  useEffect(() => {
    const target = open ? to : from;
    turn.value = reduceMotion ? target : withTiming(target, { duration: 200, easing: LT_EASE });
  }, [open, from, to, reduceMotion, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <LtIcon name={name} size={size} color={color} />
    </Animated.View>
  );
}

/**
 * "Show all 50" / "Show fewer" (board `lt-pz__more` / `lt-mini__more`): a
 * ghost button (indigo text, sm 40 or xs 36 tall, reaching 44 with hitSlop)
 * whose chevron flips when open. It pulls 14pt left so its text lines up with
 * the list above it, as the board's `margin-left: -14px` does.
 */
export const MoreButton = memo(function MoreButton({
  open,
  label,
  onPress,
  size = "sm",
  accessibilityLabel,
  style,
}: {
  open: boolean;
  label: string;
  onPress: () => void;
  size?: "sm" | "xs";
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const height = size === "sm" ? 40 : 36;
  const slop = (44 - height) / 2;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: slop, bottom: slop }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => [styles.more, { height }, pressed && styles.morePressed, style]}
    >
      <LtText role="buttonSm" color={LT.indigo} numberOfLines={1}>
        {label}
      </LtText>
      <TurningChevron open={open} from={0} to={180} size={16} color={LT.indigo} />
    </Pressable>
  );
});

/**
 * A grid of prize numbers that keeps every number on one line on any phone:
 * the board's fixed column count (5 / 3 / 2) is the MOST, and fewer columns
 * are used when a cell would be narrower than `cellMin` at the reader's text
 * size (a 320pt phone, or a large OS text size). Rows are real rows, so a
 * short last row keeps the column widths (empty fillers).
 */
export function NumberGrid({
  items,
  maxCols,
  cellMin,
  columnGap,
  rowGap,
  maxScale,
  renderCell,
  style,
}: {
  items: readonly string[];
  maxCols: number;
  /** Narrowest cell (pt at text size 1) that still holds a six-digit number. */
  cellMin: number;
  columnGap: number;
  rowGap: number;
  /** The cells' own maxFontSizeMultiplier — the most the text can grow. */
  maxScale: number;
  renderCell: (item: string, index: number) => ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };
  const need = cellMin * Math.min(Math.max(fontScale, 1), maxScale);
  const cols = width ? Math.max(1, Math.min(maxCols, Math.floor((width + columnGap) / (need + columnGap)))) : maxCols;

  const rows: string[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));

  return (
    <View style={[{ gap: rowGap }, style]} onLayout={onLayout}>
      {rows.map((row, r) => (
        <View key={r} style={[styles.gridRow, { gap: columnGap }]}>
          {row.map((item, c) => (
            // Keyed by position too: a number drawn twice in one group is two cells (and two prizes).
            <View key={`${item}-${r * cols + c}`} style={styles.gridCell}>
              {renderCell(item, r * cols + c)}
            </View>
          ))}
          {row.length < cols
            ? Array.from({ length: cols - row.length }, (_, k) => <View key={`fill-${k}`} style={styles.gridCell} />)
            : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  more: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    marginLeft: -14,
    paddingHorizontal: 14,
    borderRadius: LT_RADIUS.button,
  },
  morePressed: { backgroundColor: LT.indigoPress },
  gridRow: { flexDirection: "row" },
  gridCell: { flex: 1, minWidth: 0 },
});
