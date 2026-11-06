import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { BOOKS, placeAt, type GenPlace, type GenWant } from "@/lottery/data/generator";
import { LT } from "@/lottery/theme/tokens";
import type { DreamBook } from "@/types/lottery";

/**
 * The Dream pages' own drawings, copied from the boards' inline SVG: the two
 * kicker marks, Dream Number 1000's intro line art, the empty-search art and
 * the little six-cell place pattern. They live here rather than in LtIcon
 * because only the dream pages use them (LtIcon is a frozen foundation file).
 * All decorative — the words beside them carry the meaning.
 */

const HIDDEN = {
  accessible: false,
  importantForAccessibility: "no-hide-descendants",
  pointerEvents: "none",
} as const;

/** The moon (Dream Number 1000's kicker): a 24-grid line icon. */
export const MoonGlyph = memo(function MoonGlyph({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...HIDDEN}>
      <Path
        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

/** Nine squares (Dream Number 100's kicker: the Home's 20 × 5 grid of dream symbols, in small). */
export const GridGlyph = memo(function GridGlyph({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...HIDDEN}>
      <Path
        d="M4 4h4v4H4z M10 4h4v4h-4z M16 4h4v4h-4z M4 10h4v4H4z M10 10h4v4h-4z M16 10h4v4h-4z M4 16h4v4H4z M10 16h4v4h-4z M16 16h4v4h-4z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

/** Dream Number 1000's intro art (Home's name band): moon, stars, a cloud and an open book, filled white. */
export const DreamLineArt = memo(function DreamLineArt({ color }: { color: string }) {
  const line = { stroke: color, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const filled = { ...line, fill: LT.white };
  return (
    <Svg width={150} height={103} viewBox="0 0 160 110" fill="none" {...HIDDEN}>
      <Path {...filled} d="M108.6 18.5A22 22 0 1 0 124.7 47.5A17.5 17.5 0 0 1 108.6 18.5Z" />
      <Path {...line} d="M24 18l1.2 2.8 2.8 1.2-2.8 1.2L24 26l-1.2-2.8L20 22l2.8-1.2z" />
      <Path {...line} d="M142 26l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
      <Path {...line} d="M58 10l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z" />
      <Path {...filled} d="M70 66h44a9 9 0 0 0 0-18 13 13 0 0 0-24-5 10 10 0 0 0-17 7 8 8 0 0 0-3 16z" />
      <Path {...filled} d="M30 88c12-6 26-6 38 0v16c-12-6-26-6-38 0z" />
      <Path {...filled} d="M68 88c12-6 26-6 38 0v16c-12-6-26-6-38 0z" />
      <Path {...line} strokeWidth={1} d="M36 94c8-3 18-3 26 0 M36 99c8-3 18-3 26 0 M74 94c8-3 18-3 26 0 M74 99c8-3 18-3 26 0" />
      <Path {...line} strokeWidth={2.5} d="M40 46h.01 M138 62h.01 M86 18h.01" />
    </Svg>
  );
});

/** The empty search (board `.lt-empty__art`): a magnifier over a moon, a star, two lines. */
export const EmptySearchArt = memo(function EmptySearchArt() {
  const line = { stroke: LT.ink3, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72" {...HIDDEN}>
      <Circle {...line} cx={31} cy={31} r={19} />
      <Path {...line} d="M45 45l15 15" />
      <Path {...line} d="M34 20.5a11 11 0 1 0 8.5 15a8.5 8.5 0 0 1-8.5-15z" />
      <Path {...line} d="M60 8l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
      <Path {...line} d="M14 58h12 M18 63h6" />
    </Svg>
  );
});

const PLACES: readonly GenPlace[] = ["start", "middle", "end"];

/**
 * The place pattern (board `.lt-pat`): six 5 × 8 cells = the six digits, the
 * dream's cells filled with the book's accent. Mixed draws three short rows —
 * one Start, one Middle, one End. Decorative: the place's word sits beside it.
 */
export const PlacePattern = memo(function PlacePattern({
  book,
  pos,
  mark,
}: {
  book: DreamBook;
  pos: GenWant;
  mark: string;
}) {
  const rows = pos === "mixed" ? PLACES : [pos];
  const digits = BOOKS[book].digits;
  const cellH = pos === "mixed" ? 4 : 8;
  return (
    <View style={[styles.pattern, pos === "mixed" && styles.patternMixed]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {rows.map((row) => {
        const at = placeAt(book, row);
        return (
          <View key={row} style={styles.patternRow}>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const on = i >= at && i < at + digits;
              return (
                <View
                  key={i}
                  style={[styles.cell, { height: cellH }, on && { backgroundColor: mark, borderColor: mark }]}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  pattern: { height: 16, justifyContent: "center" },
  patternMixed: { gap: 2 },
  patternRow: { flexDirection: "row", gap: 1 },
  cell: {
    width: 5,
    borderRadius: 1,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.field,
  },
});
