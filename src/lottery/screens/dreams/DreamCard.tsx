import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { DreamPicture } from "@/lottery/components/DreamPicture";
import { LtText } from "@/lottery/components/LtText";
import { ltLanguage } from "@/lottery/i18n";
import { DREAM_COPY } from "@/lottery/screens/dreams/copy";
import { BOOK_LOOK, dreamNames, type BookDream } from "@/lottery/screens/dreams/dreamBook";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";
import type { DreamBook } from "@/types/lottery";

/**
 * One dream in a book's grid (board `.lt-drcard`): the picture on its tint
 * disc ON TOP, the English name, the Burmese name (Noto Sans Myanmar), and
 * the dream number below on a cream-1 band across the foot of the card — the
 * ticket number window's paper, in big Literata digits. 1000: three per row,
 * indigo tint, 28pt digits · 100: four per row, seal tint, 24pt digits.
 *
 * A dream with one name shows that one; the number band stays at the foot,
 * so the cards of a row keep one height. A dream with no picture yet shows
 * the placeholder tile (DreamPicture).
 *
 * The whole card is one button that opens the dream's sample-ticket
 * generator; it is read as "Fish, ငါး, number 0 2 7. Open."
 * Pressed: the card dips 1pt onto paper (no dip under reduced motion).
 */
export const DreamCard = memo(function DreamCard({
  book,
  dream,
  disc,
  pic,
  onOpen,
}: {
  book: DreamBook;
  dream: BookDream;
  /** The tint disc and the picture on it, for this window (dreamBook.cardMetrics). */
  disc: number;
  pic: number;
  /** Opens the generator for this dream (its number). */
  onOpen: (number: string) => void;
}) {
  const look = BOOK_LOOK[book];
  // English keeps the board's two lines (English, then Burmese); Burmese leads with its own name.
  const burmese = ltLanguage() === "mm";
  const first = burmese ? dream.my || dream.en : dream.en;
  const second = burmese ? (dream.my ? dream.en : null) : dream.my;
  const firstIsMy = burmese && !!dream.my;
  const secondIsMy = !burmese;
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      onPress={() => onOpen(dream.num)}
      accessibilityRole="button"
      accessibilityLabel={DREAM_COPY.book.cardA11y(dreamNames(dream), dream.num)}
      style={({ pressed }) => [
        styles.card,
        { paddingTop: look.padTop, paddingHorizontal: look.padSide },
        pressed && styles.pressed,
        pressed && !reduceMotion && styles.down,
      ]}
    >
      <View style={[styles.disc, { width: disc, height: disc, borderRadius: disc / 2, backgroundColor: look.tint }]}>
        <DreamPicture pictureUrl={dream.pictureUrl} number={dream.num} size={pic} />
      </View>
      {/* The reader's language on the first, stronger line; the other name under it. */}
      <View style={[styles.names, { marginTop: look.small ? 6 : 8 }]}>
        {first ? (
          <LtText
            role={look.small ? "micro" : "metaB"}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
            style={[styles.center, firstIsMy ? (look.small ? styles.mySmall : styles.myLarge) : !look.small && styles.enLarge]}
          >
            {first}
          </LtText>
        ) : null}
        {second ? (
          <LtText
            role={look.small ? "caption" : "meta"}
            color={LT.ink2}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
            style={[styles.center, secondIsMy ? (look.small ? styles.mySmall : styles.myLarge) : !look.small && styles.enLarge]}
          >
            {second}
          </LtText>
        ) : null}
      </View>
      <View
        style={[
          styles.num,
          { height: look.numH, marginTop: look.small ? 6 : 8, marginHorizontal: -look.padSide },
        ]}
      >
        <LtText
          role="displayL"
          maxFontSizeMultiplier={1.15}
          style={{
            fontSize: look.numSize,
            // Room for Literata's tall figures; the strip centres the line (board: line-height 1 in a flex box).
            lineHeight: Math.round(look.numSize * 1.25),
            letterSpacing: look.numSize * 0.1,
            // Cancels the trailing letter-space so the digits sit truly centred (board: padding-left .1em).
            paddingLeft: look.numSize * 0.1,
          }}
        >
          {dream.num}
        </LtText>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    boxShadow: LT_SHADOW.s1,
    overflow: "hidden",
  },
  pressed: { backgroundColor: LT.paper },
  down: { transform: [{ translateY: 1 }] },
  disc: { alignItems: "center", justifyContent: "center" },
  /** Grows to the row's height, so the number band is the foot of every card in it. */
  names: { flexGrow: 1, alignSelf: "stretch", alignItems: "center", minWidth: 0 },
  center: { maxWidth: "100%", textAlign: "center" },
  /** Franklin 600 14/18 (100: 12/16). */
  enLarge: { lineHeight: 18 },
  /** Burmese: Noto Sans Myanmar 14/24 (100: 12/20) — LtText adds its +4 to these, landing on the board's values. */
  myLarge: { lineHeight: 20 },
  mySmall: { lineHeight: 16 },
  num: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.cream1,
    borderTopWidth: 1,
    borderTopColor: LT.line,
  },
});
