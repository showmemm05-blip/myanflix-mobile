import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { DreamPicture } from "@/lottery/components/DreamPicture";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { useDreams } from "@/lottery/hooks/useDreams";
import { HOME_COPY } from "@/lottery/screens/home/copy";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";
import type { DreamBook, LotteryDream } from "@/types/lottery";

/** The disc behind each tile's picture or glyph, and the picture on it (board `.lt-pick__disc` / `.lt-drpic`). */
const DISC = 72;
const PICTURE = 64;
const DICE = 34;

/**
 * 2 · PICK NUMBERS YOUR WAY (Main.dc.html `.lt-pick`): three equal tiles in
 * one row, one tap each — Dream 1000 (the three-digit dream book, a dream
 * picture on an indigo-tint disc), Dream 100 (the two-digit book, seal tint)
 * and Random (the dice on cream: the Draw page with Quick pick already
 * applied). The pictures are real: the first dream of each book that has
 * one (hooks/useDreams), else the placeholder tile with its number.
 */
export const PickWays = memo(function PickWays({
  onBook,
  onRandom,
}: {
  onBook: (book: DreamBook) => void;
  onRandom: () => void;
}) {
  const copy = HOME_COPY.pick;
  const book1000 = useDreams("1000");
  const book100 = useDreams("100");
  return (
    <View>
      <LtText role="title" accessibilityRole="header">
        {copy.title}
      </LtText>
      <View style={styles.grid}>
        <Tile name={copy.d1k.name} cap={copy.d1k.cap} onPress={() => onBook("1000")}>
          <View style={[styles.disc, styles.discIndigo]}>
            <DreamPicture {...pictureOf(book1000.data, "1000")} size={PICTURE} />
          </View>
        </Tile>
        <Tile name={copy.d100.name} cap={copy.d100.cap} onPress={() => onBook("100")}>
          <View style={[styles.disc, styles.discSeal]}>
            <DreamPicture {...pictureOf(book100.data, "100")} size={PICTURE} />
          </View>
        </Tile>
        <Tile name={copy.rng.name} cap={copy.rng.cap} onPress={onRandom}>
          <View style={[styles.disc, styles.discCream]}>
            <LtIcon name="dice" size={DICE} color={LT.indigo} />
          </View>
        </Tile>
      </View>
    </View>
  );
});

/** The first dream of the book with a picture (else the first dream, on the placeholder tile; else the book's own name). */
function pictureOf(dreams: readonly LotteryDream[] | undefined, book: DreamBook): { pictureUrl: string | null; number: string } {
  const dream = dreams?.find((d) => d.pictureUrl) ?? dreams?.[0];
  return { pictureUrl: dream?.pictureUrl ?? null, number: dream?.number ?? book };
}

/** One tile (`.lt-pick__tile`): the disc, a two-word name, a three-word caption; pressed it dips 1pt onto paper. */
function Tile({
  name,
  cap,
  onPress,
  children,
}: {
  name: string;
  cap: string;
  onPress: () => void;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={HOME_COPY.pick.tileA11y(name, cap)}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed, pressed && !reduceMotion && styles.down]}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {children}
      </View>
      <LtText role="buttonSm" tabular numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.name}>
        {name}
      </LtText>
      <LtText role="caption" numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.cap}>
        {cap}
      </LtText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", gap: 8, marginTop: 12 },
  tile: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    boxShadow: LT_SHADOW.s1,
  },
  pressed: { backgroundColor: LT.paper },
  down: { transform: [{ translateY: 1 }] },
  disc: { width: DISC, height: DISC, borderRadius: DISC / 2, alignItems: "center", justifyContent: "center" },
  discIndigo: { backgroundColor: LT.indigoTint },
  discSeal: { backgroundColor: LT.sealTint },
  discCream: { backgroundColor: LT.cream, borderWidth: 1, borderColor: LT.line },
  /** Franklin 700 14/18 (`.lt-pick__name`). */
  name: { marginTop: 10, maxWidth: "100%", lineHeight: 18, textAlign: "center" },
  cap: { marginTop: 2, maxWidth: "100%", textAlign: "center" },
});
