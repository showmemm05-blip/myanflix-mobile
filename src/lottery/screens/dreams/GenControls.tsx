import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { BOOKS, type GenWant } from "@/lottery/data/generator";
import { spaced } from "@/lottery/data/format";
import { DREAM_COPY } from "@/lottery/screens/dreams/copy";
import { BOOK_LOOK } from "@/lottery/screens/dreams/dreamBook";
import { PlacePattern } from "@/lottery/screens/dreams/DreamGlyphs";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";
import type { DreamBook } from "@/types/lottery";

const COPY = DREAM_COPY.gen;
const PLACES: readonly GenWant[] = ["start", "middle", "end", "mixed"];

/**
 * Where the dream digits go — Start · Middle · End · Mixed, each a two-line
 * segment with its little six-cell pattern (the control the owner kept from
 * the first design, 3 Nov 2026). No label or help line on the page: the
 * patterns say it, and a screen reader hears the sentence as each option's
 * hint.
 */
export const PlaceControl = memo(function PlaceControl({
  book,
  number,
  pos,
  onPos,
  style,
}: {
  book: DreamBook;
  number: string;
  pos: GenWant;
  onPos: (pos: GenWant) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { digits, mid } = BOOKS[book];
  const look = BOOK_LOOK[book];
  return (
    <View style={[styles.track, style]} accessibilityRole="radiogroup" accessibilityLabel={COPY.placeGroup(spaced(number))}>
      {PLACES.map((place) => {
        const on = place === pos;
        return (
          <Pressable
            key={place}
            onPress={() => {
              if (!on) onPos(place);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, checked: on }}
            accessibilityLabel={COPY.places[place]}
            accessibilityHint={COPY.placeHelp(place, spaced(number), digits, mid)}
            style={({ pressed }) => [styles.place, on && styles.placeOn, pressed && !on && styles.placePressed]}
          >
            <PlacePattern book={book} pos={place} mark={look.mark} />
            <LtText role="metaB" color={on ? LT.ink : LT.ink2} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {COPY.places[place]}
            </LtText>
          </Pressable>
        );
      })}
    </View>
  );
});

/**
 * Show other tickets (secondary, full width): every ticket that is NOT picked
 * is rolled again. While the new ones are being made it keeps its colours and
 * width, shows a spinner — three still dots under reduced motion — and
 * "Making tickets…", and ignores taps: one tap, one roll.
 */
export const GenerateButton = memo(function GenerateButton({
  busy,
  onPress,
  style,
}: {
  busy: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      onPress={busy ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={busy ? COPY.generating : COPY.showOthers}
      accessibilityHint={COPY.keepNote}
      accessibilityState={{ busy, disabled: busy }}
      style={({ pressed }) => [
        styles.button,
        pressed && !busy && styles.buttonPressed,
        pressed && !busy && !reduceMotion && styles.buttonDown,
        style,
      ]}
    >
      {busy ? (
        reduceMotion ? (
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.dot} />
            ))}
          </View>
        ) : (
          <ActivityIndicator size="small" color={LT.ink} />
        )
      ) : (
        <LtIcon name="refresh" size={16} color={LT.ink} />
      )}
      <LtText role="button" numberOfLines={1}>
        {busy ? COPY.generating : COPY.showOthers}
      </LtText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  /** The segmented track (lt-base `.lt-seg`), its options two lines tall (board `.lt-gseg`). */
  track: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    backgroundColor: LT.mist,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
  },
  place: {
    flex: 1,
    minWidth: 0,
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 7,
  },
  placeOn: { backgroundColor: LT.white, boxShadow: `${LT_SHADOW.s1}, 0 0 0 1px ${LT.lineStrong}` },
  placePressed: { backgroundColor: LT.whiteVeil },
  button: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    borderRadius: LT_RADIUS.button,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.lineStrong,
  },
  buttonPressed: { backgroundColor: LT.cream2 },
  buttonDown: { transform: [{ translateY: 1 }] },
  dots: { flexDirection: "row", alignItems: "center", gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: LT.ink },
});
