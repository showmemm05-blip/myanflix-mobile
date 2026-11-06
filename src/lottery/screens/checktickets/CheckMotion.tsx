import { memo, useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { LtText, type LtTextProps } from "@/lottery/components/LtText";
import { THAI_TEMPLATE } from "@/lottery/components/ticket/template";
import type { DigitRange } from "@/lottery/data/prizes";
import { CK_TIME } from "@/lottery/screens/checktickets/checkKit";
import { LT, LT_EASE, LT_SHADOW } from "@/lottery/theme/tokens";

/**
 * The reveal's moving parts (CheckTickets.dc.html board CSS), each one a
 * small react-native-reanimated piece that plays ONCE when it mounts with
 * `play` and otherwise just shows its end state. The screen never mounts the
 * decorative ones (sweep, confetti) under reduced motion, and never asks the
 * others to play then — so reduced motion = every result at once, still.
 * Everything here is hidden from screen readers; the cards speak for it.
 */

/** Hidden from VoiceOver and TalkBack, never takes a touch. */
const DECOR = {
  pointerEvents: "none",
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
} as const;

/* ── The soft light that sweeps across the card while it is checked (`.ck-row--scan::after`) ── */

/**
 * A band 55% of the card wide, a warm light in its middle, crossing from just
 * off the left edge to past the right every 1.5 s (ease-in-out) for as long
 * as the card is being checked. It lies over the ticket like light on paper;
 * the print underneath never changes.
 */
export const Sweep = memo(function Sweep({ width }: { width: number }) {
  const band = width * 0.55;
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: CK_TIME.sweep, easing: Easing.inOut(Easing.ease) }), -1, false);
    return () => cancelAnimation(t);
  }, [t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(t.value, [0, 1], [-1.1 * band, 2 * band]) }],
  }));
  return (
    <Animated.View {...DECOR} style={[styles.sweep, { width: band }, style]}>
      <LinearGradient
        colors={[LT.sweepClear, LT.sweepLight, LT.sweepClear]}
        start={{ x: 0, y: 0.41 }}
        end={{ x: 1, y: 0.59 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
});

/* ── A little gold paper confetti (`.ck-conf`) ── */

/** The board's fourteen papers: sideways reach, rise, turn (CheckTickets `conf`). */
const CONF_X = [-150, -112, -84, -58, -30, -8, 14, 38, 62, 88, 116, 146, -132, 128];
const CONF_UP = [-150, -205, -128, -228, -172, -246, -196, -236, -160, -214, -138, -182, -118, -250];
const CONF_TURN = [220, -180, 300, -260, 140, -320, 260, -200, 180, -240, 320, -150, 200, -280];
const CONF_INK = [LT.gold, LT.goldEdge, LT.goldLine];
/** Each paper leaves 22 ms after the one before. */
const CONF_STAGGER = 22;
const CONF_EASE = Easing.bezier(0.2, 0.6, 0.35, 1);

/**
 * Fourteen small gold papers thrown up from the "You won" line (row) or the
 * total (summary, `rise` 0.45 so they stay inside the shorter card), falling
 * away in 1.5 s; the whole layer takes itself away after `life`.
 */
export const Confetti = memo(function Confetti({
  bottom,
  rise = 1,
  life = CK_TIME.confettiLife,
}: {
  /** Where the papers start, from the card's bottom edge. */
  bottom: number;
  rise?: number;
  life?: number;
}) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setOn(false), life);
    return () => clearTimeout(id);
  }, [life]);
  if (!on) return null;
  return (
    <View {...DECOR} style={styles.confetti}>
      {CONF_X.map((x, i) => (
        <Paper key={i} i={i} x={x} up={Math.round(CONF_UP[i] * rise)} turn={CONF_TURN[i]} bottom={bottom} />
      ))}
    </View>
  );
});

function Paper({ i, x, up, turn, bottom }: { i: number; x: number; up: number; turn: number; bottom: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(i * CONF_STAGGER, withTiming(1, { duration: CK_TIME.confetti, easing: CONF_EASE }));
    return () => cancelAnimation(p);
  }, [i, p]);
  // Up and out by 45%, then a fall of 150 while it fades (the board's ck-conf keyframes).
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.45, 1], [1, 1, 0]),
    transform: [
      { translateX: interpolate(p.value, [0, 0.45, 1], [0, x * 0.8, x]) },
      { translateY: interpolate(p.value, [0, 0.45, 1], [0, up, up + 150]) },
      { rotate: `${interpolate(p.value, [0, 0.45, 1], [0, turn * 0.5, turn])}deg` },
    ],
  }));
  // nth-child(3n) is a smaller paper, nth-child(4n) a round one (the later rule wins, as in CSS).
  const n = i + 1;
  const shape = n % 4 === 0 ? styles.paperRound : n % 3 === 0 ? styles.paperSmall : styles.paperLong;
  return <Animated.View style={[styles.paper, shape, { bottom, backgroundColor: CONF_INK[i % 3] }, style]} />;
}

/* ── "You won" and the summary total count up from 0 (ease-out, in steps of 50 ms) ── */

/**
 * A money amount that counts up from 0 in `steps` steps of 50 ms after
 * `delay`, easing out (1 − (1 − t)³), landing exactly on `value`. The board
 * changes the text every 50 ms, so this does too: reanimated runs the clock
 * and hands each new step to React (18 or 24 renders of one Text in all).
 * Without `play` it simply shows `value`.
 */
export const CountUp = memo(function CountUp({
  value,
  format,
  steps,
  delay = 0,
  play,
  ...text
}: {
  value: number;
  format: (n: number) => string;
  steps: number;
  delay?: number;
  play: boolean;
} & Omit<LtTextProps, "children">) {
  const [shown, setShown] = useState(play ? 0 : value);
  const t = useSharedValue(0);

  useEffect(() => {
    if (!play) return;
    t.value = withDelay(delay, withTiming(steps, { duration: steps * CK_TIME.countStep, easing: Easing.linear }));
    return () => cancelAnimation(t);
    // One count per mount in practice: the reveal mounts a fresh panel for every result, and these never change.
  }, [play, delay, steps, t]);

  const apply = (step: number) =>
    setShown(step >= steps ? value : Math.round(value * (1 - Math.pow(1 - step / steps, 3))));

  useAnimatedReaction(
    () => Math.floor(t.value + 1e-6),
    (now, before) => {
      if (play && now !== before && before !== null) scheduleOnRN(apply, now);
    },
    [play, steps, value],
  );

  return <LtText {...text}>{format(play ? shown : value)}</LtText>;
});

/* ── The Won pill pops in (`.ck-pop`) ── */

/** Scales .4 → 1.12 → 1 and fades in, 340 ms, 160 ms after the panel starts turning back. */
export function PopIn({ play, children, style }: { play: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useSharedValue(play ? 0.4 : 1);
  const o = useSharedValue(play ? 0 : 1);
  useEffect(() => {
    if (!play) {
      // Not playing (or Skip stopped it mid-pop): stand still at the end.
      s.value = 1;
      o.value = 1;
      return;
    }
    const rise = CK_TIME.pop * 0.65;
    s.value = withDelay(
      CK_TIME.popDelay,
      withSequence(
        withTiming(1.12, { duration: rise, easing: LT_EASE }),
        withTiming(1, { duration: CK_TIME.pop - rise, easing: LT_EASE }),
      ),
    );
    o.value = withDelay(CK_TIME.popDelay, withTiming(1, { duration: rise }));
  }, [play, s, o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/* ── The winning digits, marked over the ticket's number band (`.ck-mark`) ── */

/** One digit cell of the ticket's number band (its x and w from the template, six equal cells). */
const BAND = THAI_TEMPLATE.fields.number;
const CELL = BAND.w / 6;

/**
 * A gold highlighter over the matching digits of the ticket's printed number
 * (all six · first 3 · last 3 · last 2), drawn ON TOP of the ticket in a box
 * exactly the ticket's size; the print underneath never changes. Each mark
 * reaches .6% past its cells on both sides and 5.2–18.6% down the ticket.
 * `play`: lands from 1.35× while fading in (420 ms, after 120 ms).
 */
export const GoldMarks = memo(function GoldMarks({
  ranges,
  width,
  height,
  play,
}: {
  ranges: readonly DigitRange[];
  width: number;
  height: number;
  play: boolean;
}) {
  return (
    <View {...DECOR} style={[StyleSheet.absoluteFill, { width, height }]}>
      {ranges.map((r) => (
        <Mark key={`${r.start}-${r.length}`} range={r} width={width} height={height} play={play} />
      ))}
    </View>
  );
});

function Mark({ range, width, height, play }: { range: DigitRange; width: number; height: number; play: boolean }) {
  const p = useSharedValue(play ? 0 : 1);
  useEffect(() => {
    // Not playing (or Skip stopped it mid-landing): the mark simply sits on the digits.
    p.value = play ? withDelay(CK_TIME.markDelay, withTiming(1, { duration: CK_TIME.mark, easing: LT_EASE })) : 1;
  }, [play, p]);
  const anim = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: interpolate(p.value, [0, 1], [1.35, 1]) }],
  }));
  const place: ViewStyle = {
    top: height * 0.052,
    height: height * 0.134,
    left: width * (BAND.x + range.start * CELL - 0.006),
    width: width * (range.length * CELL + 0.012),
  };
  return <Animated.View style={[styles.mark, place, anim]} />;
}

const styles = StyleSheet.create({
  sweep: { position: "absolute", top: 0, bottom: 0, left: 0, zIndex: 1 },
  confetti: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 2, overflow: "hidden" },
  paper: { position: "absolute", left: "50%", marginLeft: -3, borderRadius: 1 },
  paperLong: { width: 7, height: 11 },
  paperSmall: { width: 5, height: 8 },
  paperRound: { width: 6, height: 6, borderRadius: 3 },
  mark: {
    position: "absolute",
    borderWidth: 2,
    borderColor: LT.goldEdge,
    borderRadius: 5,
    backgroundColor: LT.goldMark,
    boxShadow: LT_SHADOW.goldMark,
  },
});
