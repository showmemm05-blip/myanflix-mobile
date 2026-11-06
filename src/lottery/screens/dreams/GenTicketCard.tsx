import { memo, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { Ticket, type TicketDraw } from "@/lottery/components/ticket/Ticket";
import { TICKET_ASPECT } from "@/lottery/components/ticket/template";
import type { GenPlace } from "@/lottery/data/generator";
import { DREAM_COPY } from "@/lottery/screens/dreams/copy";
import { BOOK_LOOK, placeSpan } from "@/lottery/screens/dreams/dreamBook";
import { LT, LT_EASE, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";
import type { DreamBook } from "@/types/lottery";

const COPY = DREAM_COPY.gen;

/** A fresh print (board `.is-fresh`): quicker and closer together than Printed's, because six print at once. */
const PRINT_MS = 600;
const PRINT_STAGGER_MS = 60;
/** The digits under the paper fade in as it lands. */
const DIGITS_FADE_MS = 200;
const DIGITS_AFTER_MS = 450;
/** The paper comes out of the slot from 12pt up (lt-base `lt-print`). */
const PRINT_RISE = 12;

/** Card padding + border around the ticket (board `.lt-gcard`: padding 6, 1pt line). */
export const GEN_CARD_INSET = 6 * 2 + 1 * 2;
/** Two cards per row, 10 apart (board `.lt-ggrid`). */
export const GEN_GRID_GAP = 10;

export interface GenTicketCardProps {
  book: DreamBook;
  /** The draw the mini ticket prints for (the current draw, or the sample one while there is none). */
  draw: TicketDraw;
  num: string;
  pos: GenPlace;
  picked: boolean;
  /** Not on sale (admin availability): greyed, no pick mark, a tap explains why. */
  off: boolean;
  /** Tickets of this number already held for the draw (the draw's answer). */
  held: number;
  /** At the draw's per-number limit: a tap explains why it cannot be picked. */
  full: boolean;
  /** The mini ticket's width (card width − GEN_CARD_INSET). */
  ticketWidth: number;
  /** Set for a ticket this roll just made: it prints in, `printIndex` × 60ms after the first. */
  printIndex: number | null;
  onToggle: (num: string) => void;
}

/**
 * One sample ticket (board `.lt-gcard`): a REAL mini Thai-style ticket for
 * the current draw — frame, picture, the number in its cells, digit words, dates, draw
 * No., price, overprint; no ticket ID, barcode or QR, which only exist after
 * buying (Ticket `mode="preview"`). Under 240pt a ticket is a picture only,
 * so the six digits are printed large under it with the dream digits marked
 * (the book's tint + a 2pt underline) and the pick mark on one row.
 *
 * The card is a checkbox: tap to pick (indigo ring + white tick on indigo).
 * Not on sale and the 20-per-number limit are never pickable — the card
 * stays readable and a tap says why (toast). "You hold N" is a status line.
 *
 * A freshly made ticket prints in: the paper comes out of the slot top first
 * (a clip that opens downwards) while it settles 12pt, 600ms on the Lottery
 * curve, 60ms after the previous one; its digits fade in as it lands. Picked
 * tickets never move. Reduced motion: no print, no press dip.
 */
export const GenTicketCard = memo(function GenTicketCard({
  book,
  draw,
  num,
  pos,
  picked,
  off,
  held,
  full,
  ticketWidth,
  printIndex,
  onToggle,
}: GenTicketCardProps) {
  const look = BOOK_LOOK[book];
  const reduceMotion = useReducedMotion();
  const ticketHeight = ticketWidth / TICKET_ASPECT;
  const [from, to] = placeSpan(book, pos);
  const label = COPY.cardA11y(num, COPY.placeSpoken[pos], off, held, draw.no);

  // The print runs once, on mount, for a ticket this roll made (never for a kept pick).
  const animate = printIndex !== null && !reduceMotion;
  const [printing, setPrinting] = useState(animate);
  const paper = useSharedValue(animate ? 0 : 1);
  const digits = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate || printIndex === null) return;
    const delay = printIndex * PRINT_STAGGER_MS;
    paper.value = withDelay(delay, withTiming(1, { duration: PRINT_MS, easing: LT_EASE }));
    // The digits land last (450 + 200 > 600), so their end is when the print is over and the clip can go.
    digits.value = withDelay(
      delay + DIGITS_AFTER_MS,
      withTiming(1, { duration: DIGITS_FADE_MS }, (finished) => {
        if (finished) runOnJS(setPrinting)(false);
      }),
    );
    // Mount-only: a card's print is decided when it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const slot = useAnimatedStyle(() => ({ height: paper.value * ticketHeight }));
  const rise = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - paper.value) * -PRINT_RISE }] }));
  const fade = useAnimatedStyle(() => ({ opacity: digits.value }));

  return (
    <Pressable
      onPress={() => onToggle(num)}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: picked, disabled: off || full }}
      style={({ pressed }) => [
        styles.card,
        // One shadow per state, never set then unset: resting, picked (the indigo ring), or none (not on sale).
        off ? styles.cardOff : picked ? styles.cardPicked : styles.cardRest,
        pressed && !off && !reduceMotion && styles.down,
      ]}
    >
      {/* The ticket's own label is the card's: hidden here so it is never read twice. */}
      <View
        style={[{ width: ticketWidth, height: ticketHeight }, off && styles.paperOff]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View style={[styles.slot, printing ? slot : styles.slotOpen]}>
          <Animated.View style={printing ? rise : undefined}>
            <Ticket draw={draw} number={num} width={ticketWidth} mode="preview" />
          </Animated.View>
        </Animated.View>
      </View>

      {/* The number and the pick mark on ONE row (canvas "Dream detail, simpler"): the digits centred, the mark at the right. */}
      <View style={styles.numRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.View style={[styles.num, printing ? fade : undefined]}>
          {num.slice(0, from) ? <NumRun text={num.slice(0, from)} off={off} /> : null}
          <View
            style={[
              styles.dream,
              off ? styles.dreamOff : { backgroundColor: look.tint, boxShadow: `inset 0 -2px 0 ${look.mark}` },
            ]}
          >
            <NumRun text={num.slice(from, to)} off={off} />
          </View>
          {num.slice(to) ? <NumRun text={num.slice(to)} off={off} /> : null}
        </Animated.View>
        <View style={[styles.tick, picked && styles.tickOn, off && styles.hidden]}>
          {picked ? <LtIcon name="tick" size={16} color={LT.white} strokeWidth={2} /> : null}
        </View>
      </View>

      {held > 0 && !off ? (
        <View style={[styles.stat, styles.statHeld]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <LtIcon name="tickets" size={14} color={LT.ink2} />
          <LtText role="microB" color={LT.ink2} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {COPY.held(held)}
          </LtText>
        </View>
      ) : null}
      {off ? (
        <View style={[styles.stat, styles.statOff]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <LtIcon name="lock" size={14} color={LT.ink2} />
          <LtText role="microB" color={LT.ink2} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {COPY.offSale}
          </LtText>
        </View>
      ) : null}
    </Pressable>
  );
});

/** Part of the six digits under the paper: Literata 700 24/30, +.06em, lining + tabular. */
function NumRun({ text, off }: { text: string; off: boolean }) {
  return (
    <LtText role="h" color={off ? LT.ink3 : LT.ink} style={styles.digits} maxFontSizeMultiplier={1.2}>
      {text}
    </LtText>
  );
}

/**
 * The place a ticket this roll is still making (board `.lt-gskel`): the
 * ticket's 1800 : 940 shape and the digits as soft blocks that pulse
 * for a moment (still under reduced motion). Hidden from screen readers — the
 * live count says "Making new sample tickets".
 */
export const GenTicketSkeleton = memo(function GenTicketSkeleton({ ticketWidth }: { ticketWidth: number }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(reduceMotion ? 1 : 0.55);
  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = 0.55;
    pulse.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, [reduceMotion, pulse]);
  const glow = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={styles.skel} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.skelTicket, { width: ticketWidth, height: ticketWidth / TICKET_ASPECT }, glow]} />
      <Animated.View style={[styles.skelNum, glow]} />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    paddingTop: 6,
    paddingHorizontal: 6,
    paddingBottom: 8,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
  },
  cardRest: { boxShadow: LT_SHADOW.s1 },
  /** Picked: the indigo ring (border + 1pt outside) over the card shadow. */
  cardPicked: { borderColor: LT.indigo, boxShadow: `0 0 0 1px ${LT.indigo}, ${LT_SHADOW.s2}` },
  cardOff: { backgroundColor: LT.mist, borderColor: LT.line },
  down: { transform: [{ translateY: 1 }] },
  /** Not on sale: the paper half-faded and grey (board: opacity .5 + grayscale). */
  paperOff: { opacity: 0.5, filter: [{ grayscale: 1 }] },
  slot: { overflow: "hidden" },
  slotOpen: { overflow: "visible" },
  numRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 2 },
  num: { flex: 1, minWidth: 0, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  digits: { fontSize: 24, lineHeight: 30, letterSpacing: 1.44 },
  dream: { marginHorizontal: 1, paddingLeft: 3, paddingRight: 1, borderRadius: LT_RADIUS.tag },
  dreamOff: { backgroundColor: "transparent", boxShadow: `inset 0 -2px 0 ${LT.lineStrong}` },
  /** The pick mark: an empty ring in field ink (3.35:1) until picked, then indigo with a white tick. */
  tick: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.white,
    borderWidth: 1.5,
    borderColor: LT.field,
  },
  tickOn: { backgroundColor: LT.indigo, borderColor: LT.indigo },
  hidden: { opacity: 0 },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 6,
    paddingVertical: 2,
    paddingLeft: 6,
    paddingRight: 8,
    borderRadius: LT_RADIUS.tag,
  },
  statHeld: { backgroundColor: LT.cream2 },
  statOff: { backgroundColor: LT.white, borderWidth: 1, borderColor: LT.lineStrong },
  skel: {
    flex: 1,
    minWidth: 0,
    paddingTop: 6,
    paddingHorizontal: 6,
    paddingBottom: 8,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
  },
  skelTicket: { backgroundColor: LT.mist, borderRadius: LT_RADIUS.ticket },
  skelNum: { alignSelf: "center", width: "70%", height: 24, marginTop: 11, backgroundColor: LT.mist, borderRadius: LT_RADIUS.input },
});
