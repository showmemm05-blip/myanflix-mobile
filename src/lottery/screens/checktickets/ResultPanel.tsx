import { memo, useEffect } from "react";
import { StyleSheet, View, type ViewInstance } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LtButton } from "@/lottery/components/LtButton";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { StatusPill } from "@/lottery/components/Pills";
import { ks } from "@/lottery/data/format";
import type { TicketPile } from "@/lottery/data/piles";
import { PRIZE_GROUP_COUNT, PRIZE_GROUPS } from "@/lottery/data/prizes";
import { CK_TIME } from "@/lottery/screens/checktickets/checkKit";
import { CountUp, PopIn } from "@/lottery/screens/checktickets/CheckMotion";
import { CHECK_COPY } from "@/lottery/screens/checktickets/copy";
import type { RowPhase } from "@/lottery/screens/checktickets/useCheckRun";
import { ltLanguage } from "@/lottery/i18n";
import { LT, LT_EASE, LT_RADIUS } from "@/lottery/theme/tokens";

const C = CHECK_COPY;
/** CSS `ease-in` (the panel turning away). */
const EASE_IN = Easing.bezier(0.42, 0, 1, 1);

export interface ResultPanelProps {
  pile: TicketPile;
  phase: RowPhase;
  /** The prize group being checked (0–8); only meaningful while scanning. */
  step: number;
  /** The result was just revealed by the animated check: flip in, pop, count up. */
  fresh: boolean;
  /** Another card is being checked: this Check waits. */
  disabled: boolean;
  /** "Saturday 31 October", or null when no next draw is set up yet. */
  nextDraw: string | null;
  onCheck: (key: string) => void;
  /** The panel's one focusable box (the screen moves the screen reader here). */
  panelRef: (node: ViewInstance | null) => void;
}

/**
 * THE RESULT PANEL under a ticket or a pile (`.ck-flip` / `.ck-res`):
 * Check → (Check all: "Waiting its turn…") → checking the nine prize groups
 * with a thin indigo bar (≈3 s) → "Almost there…" with a small pulse (0.5 s)
 * → the panel TURNS AWAY (rotateY 0 → 90°, 250 ms ease-in) and comes back
 * with the result (−90 → 0°, 300 ms): Won — the Won pill pops in, the prize
 * lines with the draw's amounts, "You won" counts up; Not won — a calm grey
 * line and the next draw's date.
 *
 * One focus stop: once checking starts, the whole panel is ONE accessible
 * element whose label says what it shows, so the screen reader never lands on
 * a half-drawn piece. Reduced motion: nothing turns, pulses or counts.
 */
export const ResultPanel = memo(function ResultPanel({
  pile,
  phase,
  step,
  fresh,
  disabled,
  nextDraw,
  onCheck,
  panelRef,
}: ResultPanelProps) {
  const reduceMotion = useReducedMotion();
  const rot = useSharedValue(0);
  const scanning = phase === "scan" || phase === "almost" || phase === "flip";

  useEffect(() => {
    if (reduceMotion) {
      rot.value = 0;
      return;
    }
    if (phase === "flip") {
      rot.value = withTiming(90, { duration: CK_TIME.flipOut, easing: EASE_IN });
    } else if (phase === "done" && fresh) {
      // The result was mounted edge-on; it turns back to face us.
      rot.value = -90;
      rot.value = withTiming(0, { duration: CK_TIME.flipIn, easing: LT_EASE });
    } else {
      rot.value = 0;
    }
    // `fresh` only ever changes together with the phase (a reveal, or a new run), so it never restarts a turn.
  }, [phase, fresh, reduceMotion, rot]);

  const flip = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${rot.value}deg` }],
  }));

  const won = pile.wins.length > 0;
  const groupName = PRIZE_GROUPS[Math.max(0, Math.min(PRIZE_GROUP_COUNT - 1, step))].name;

  let label: string | undefined;
  if (phase === "queued") label = C.check.waitingA11y(pile.number);
  // One steady label while checking: TalkBack re-reads a focused element whenever its label changes, and a
  // new label every 333 ms would drown the result. The start and the result are announced (useCheckRun).
  else if (scanning) label = C.scan.a11y(pile.number, PRIZE_GROUP_COUNT);
  else if (phase === "done") label = won ? C.won.a11y(pile) : C.lost.a11y(nextDraw);

  // Once checking starts the panel is ONE element; its pieces are hidden so TalkBack never stops on them too.
  const hideParts = phase !== "idle";

  return (
    <Animated.View style={[styles.flip, flip]}>
      <View
        ref={panelRef}
        accessible={phase !== "idle"}
        accessibilityLabel={label}
        accessibilityState={scanning ? { busy: true } : undefined}
        style={[
          styles.res,
          phase !== "idle" && styles.box,
          scanning && styles.boxScan,
          phase === "queued" && styles.boxWait,
          phase === "done" && won && styles.boxWon,
        ]}
      >
        <View
          accessibilityElementsHidden={hideParts}
          importantForAccessibility={hideParts ? "no-hide-descendants" : "auto"}
        >
          {phase === "idle" ? (
            <LtButton
              variant="secondary"
              label={C.check.label}
              icon="search"
              accessibilityLabel={C.check.a11y(pile.number, pile.count)}
              onPress={() => onCheck(pile.key)}
              disabled={disabled}
              style={styles.check}
            />
          ) : null}

          {phase === "queued" ? (
            <View style={styles.wait}>
              <LtIcon name="clock" size={16} color={LT.ink3} />
              <LtText role="metaB" color={LT.ink3}>
                {C.check.waiting}
              </LtText>
            </View>
          ) : null}

          {scanning ? <ScanBody phase={phase} step={step} groupName={groupName} /> : null}

          {phase === "done" && won ? <WonBody pile={pile} fresh={fresh && !reduceMotion} /> : null}

          {phase === "done" && !won ? (
            <>
              <StatusPill kind="notwon" label={C.lost.pill} />
              <LtText role="meta" color={LT.ink2} style={styles.lost}>
                {C.lost.text(nextDraw)}
              </LtText>
            </>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
});

/** Checking: kicker + "3 of 9", the group being checked, a thin indigo bar. */
function ScanBody({ phase, step, groupName }: { phase: RowPhase; step: number; groupName: string }) {
  const reduceMotion = useReducedMotion();
  const target = phase === "scan" ? (step + 1) / PRIZE_GROUP_COUNT : 1;
  const fill = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    fill.value = reduceMotion ? target : withTiming(target, { duration: CK_TIME.step, easing: Easing.linear });
  }, [fill, target, reduceMotion]);

  useEffect(() => {
    if (phase !== "almost" || reduceMotion) return;
    const half = CK_TIME.almost / 2;
    pulse.value = withSequence(
      withTiming(1.06, { duration: half, easing: Easing.inOut(Easing.ease) }),
      withTiming(1, { duration: half, easing: Easing.inOut(Easing.ease) }),
    );
  }, [phase, pulse, reduceMotion]);

  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  const grow = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View>
      <View style={styles.scanHead}>
        <LtText role="kicker" numberOfLines={1} style={styles.flexText}>
          {C.scan.kicker(PRIZE_GROUP_COUNT)}
        </LtText>
        <LtText role="micro" color={LT.ink3} tabular>
          {C.scan.count(phase === "scan" ? step + 1 : PRIZE_GROUP_COUNT, PRIZE_GROUP_COUNT)}
        </LtText>
      </View>
      <Animated.View style={[styles.scanTextBox, grow]}>
        <LtText role="title" color={LT.indigo} style={styles.scanText} numberOfLines={1}>
          {phase === "scan" ? C.scan.group(groupName) : C.scan.almost}
        </LtText>
      </Animated.View>
      <View style={styles.bar}>
        <Animated.View style={[styles.barFill, bar]} />
      </View>
    </View>
  );
}

/** Won: the pill, every prize line, the per-ticket note on a pile, "You won" counting up, where it was paid. */
function WonBody({ pile, fresh }: { pile: TicketPile; fresh: boolean }) {
  const burmese = ltLanguage() === "mm";
  return (
    <>
      <View style={styles.head}>
        <PopIn play={fresh}>
          <StatusPill kind="won" label={C.won.pill} />
        </PopIn>
      </View>
      <View style={styles.lines}>
        {pile.wins.map((w) => (
          <View key={`${w.group.key}-${w.matched}`} style={styles.line}>
            <LtText role="meta" color={LT.ink2} style={styles.flexText}>
              {w.group.name}
            </LtText>
            <LtText role="num" color={LT.goldText} style={styles.lineNum}>
              {w.matched}
            </LtText>
            <LtText role="metaB" tabular style={styles.lineAmount} numberOfLines={1}>
              {C.won.amount(w.amount, pile.count)}
            </LtText>
          </View>
        ))}
      </View>
      {pile.count > 1 ? (
        <LtText role="micro" color={LT.ink2} style={styles.each}>
          {C.won.each(pile.each, pile.count)}
        </LtText>
      ) : null}
      {/* Burmese: the longer label sits over the amount (right-aligned) from the first frame,
          so the count-up never jumps lines or cuts a big prize. */}
      <View style={[styles.youWon, burmese && styles.youWonStacked]}>
        <LtText role="metaB">{C.won.youWon}</LtText>
        <CountUp
          role="h"
          value={pile.total}
          format={ks}
          steps={CK_TIME.countSteps}
          delay={CK_TIME.countDelay}
          play={fresh}
          numberOfLines={1}
          style={[styles.youWonValue, burmese && styles.youWonValueStacked]}
        />
      </View>
      <LtText role="caption" style={styles.paid}>
        {C.won.paid}
      </LtText>
    </>
  );
}

const styles = StyleSheet.create({
  /** backfaceVisibility: the panel is never seen from behind while it turns. */
  flip: { marginTop: 12, backfaceVisibility: "hidden" },
  res: { borderRadius: LT_RADIUS.button },
  box: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
  },
  boxScan: { backgroundColor: LT.indigoTint, borderColor: LT.indigoPress },
  boxWon: { borderColor: LT.goldLine },
  /** "Waiting its turn…": a dashed box, no fill (`.ck-wait`). */
  boxWait: {
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: 0,
    backgroundColor: "transparent",
    borderStyle: "dashed",
    borderColor: LT.lineStrong,
  },
  check: { alignSelf: "stretch" },
  wait: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  scanHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  /** Grows from its left edge, like the board's `transform-origin: left center`. */
  scanTextBox: { alignSelf: "flex-start", marginTop: 4, transformOrigin: "left center" },
  /** Literata 600 18/24 (`.ck-scan__t`). */
  scanText: { fontSize: 18, lineHeight: 24 },
  bar: { height: 4, marginTop: 10, borderRadius: 2, backgroundColor: LT.indigoPress, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2, backgroundColor: LT.indigo, transformOrigin: "left center" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  lines: { marginTop: 10, gap: 6 },
  line: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  /** Literata 600 16/20, +.06em, gold text (`.ck-line__n`). */
  lineNum: { fontSize: 16, lineHeight: 20 },
  lineAmount: { minWidth: 96, textAlign: "right" },
  each: { marginTop: 4 },
  youWon: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: LT.goldLine,
  },
  youWonValue: { flexShrink: 1 },
  youWonStacked: { flexDirection: "column", alignItems: "stretch", gap: 2 },
  youWonValueStacked: { textAlign: "right" },
  paid: { marginTop: 4 },
  lost: { marginTop: 8 },
  flexText: { flex: 1, minWidth: 0 },
});
