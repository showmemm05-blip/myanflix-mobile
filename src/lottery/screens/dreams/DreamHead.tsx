import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { DreamPicture } from "@/lottery/components/DreamPicture";
import { LtText } from "@/lottery/components/LtText";
import { DREAM_COPY } from "@/lottery/screens/dreams/copy";
import { BOOK_LOOK, dreamName, dreamSecondName } from "@/lottery/screens/dreams/dreamBook";
import { LT, LT_RADIUS, LT_SPACE } from "@/lottery/theme/tokens";
import type { DreamBook, LotteryDream } from "@/types/lottery";

const COPY = DREAM_COPY.gen;
/** The dream number's window cells (canvas "Dream detail, simpler" v12: 40 wide, 48 tall). */
const CELL_W = 40;

/**
 * The page's header (canvas "Dream detail, simpler", 3 Nov 2026): ONE row on
 * the cream band — the dream's picture on the book's tint disc (56 / 44), its
 * name in the reader's language as the page heading (the other one when
 * that is not set) with the other language's name under it, and the dream
 * number at the right
 * in the ticket's number-window language (one tinted strip of 3 or 2 cells
 * with a line-strong ring 3pt outside). The first design's kicker, Sample
 * tag, Change dream, "Dream number" label, digit words and Copy number are
 * gone: the owner wanted the page simple, and the number alone says it.
 */
export const DreamHead = memo(function DreamHead({ book, dream }: { book: DreamBook; dream: LotteryDream }) {
  const look = BOOK_LOOK[book];
  const number = dream.number;
  const digits = number.split("");
  const heading = dreamName(dream);
  const second = dreamSecondName(dream);
  return (
    <View style={styles.band}>
      <View style={[styles.disc, { backgroundColor: look.tint }]}>
        <DreamPicture pictureUrl={dream.pictureUrl} number={number} size={44} />
      </View>
      <View style={styles.names}>
        <View accessible accessibilityRole="header" accessibilityLabel={heading}>
          <LtText role="h" style={styles.name} numberOfLines={2}>
            {heading}
          </LtText>
        </View>
        {second ? (
          <LtText role="metaB" color={LT.ink2} style={styles.my} numberOfLines={1}>
            {second}
          </LtText>
        ) : null}
      </View>
      <View style={styles.ring} accessible accessibilityLabel={COPY.numberA11y(number)}>
        <View style={[styles.strip, { backgroundColor: look.tint }]}>
          {digits.map((digit, i) => (
            <View key={i} style={[styles.cell, i > 0 && styles.cellLine]}>
              <LtText role="digit" maxFontSizeMultiplier={1}>
                {digit}
              </LtText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  /** Full bleed under the top bar (canvas: padding 10 16 12), everything on one row. */
  band: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: -LT_SPACE.gutter,
    paddingTop: 10,
    paddingHorizontal: LT_SPACE.gutter,
    paddingBottom: 12,
    backgroundColor: LT.cream,
    borderBottomWidth: 1,
    borderBottomColor: LT.line,
  },
  /** The 44 picture on a 56 tint disc leaves a 6pt ring of the book's accent. */
  disc: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  names: { flex: 1, minWidth: 0 },
  /** The canvas heading: Literata 700 at 20/26 (`.lt-h` shrunk by `.lt-ghead--tight`). */
  name: { fontSize: 20, lineHeight: 26 },
  /** Burmese name: Noto Sans Myanmar 600 15/22 — LtText adds its +4 to this 18. */
  my: { fontSize: 15, lineHeight: 18 },
  /** The 1pt line-strong outline 3pt outside the strip (board: outline-offset 3), drawn as a frame. */
  ring: {
    flexShrink: 0,
    padding: 3,
    borderWidth: 1,
    borderColor: LT.lineStrong,
    borderRadius: LT_RADIUS.window + 4,
  },
  strip: {
    flexDirection: "row",
    height: 48,
    borderWidth: 1,
    borderColor: LT.field,
    borderRadius: LT_RADIUS.window,
    overflow: "hidden",
  },
  cell: { width: CELL_W, alignItems: "center", justifyContent: "center" },
  cellLine: { borderLeftWidth: 1, borderLeftColor: LT.lineStrong },
});
