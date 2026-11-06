import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type ViewInstance } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { LtText } from "@/lottery/components/LtText";
import { Ticket, type TicketDraw } from "@/lottery/components/ticket/Ticket";
import { TicketPile } from "@/lottery/components/ticket/TicketPile";
import { TICKET_ASPECT } from "@/lottery/components/ticket/template";
import { ks } from "@/lottery/data/format";
import type { TicketPile as TicketPileData } from "@/lottery/data/piles";
import { highlightRanges } from "@/lottery/data/prizes";
import { CK_TIME } from "@/lottery/screens/checktickets/checkKit";
import { Confetti, GoldMarks, Sweep } from "@/lottery/screens/checktickets/CheckMotion";
import { CHECK_COPY } from "@/lottery/screens/checktickets/copy";
import { ResultPanel } from "@/lottery/screens/checktickets/ResultPanel";
import type { RowPhase } from "@/lottery/screens/checktickets/useCheckRun";
import { LT, LT_EASE, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

const C = CHECK_COPY;

export interface CheckRowProps {
  pile: TicketPileData;
  /** The pile's draw — what every paper prints (its picture and frame). */
  draw: TicketDraw;
  phase: RowPhase;
  step: number;
  fresh: boolean;
  disabled: boolean;
  /** "Saturday 31 October", or null when no next draw is set up yet. */
  nextDraw: string | null;
  onCheck: (key: string) => void;
  /** The screen keeps each result panel so it can move the screen reader there. */
  onPanel: (key: string, node: ViewInstance | null) => void;
  /** y and height inside the list, for following a Check all run down the page. */
  onPlaced: (key: string, y: number, height: number) => void;
}

/**
 * ONE CARD PER NUMBER (`.ck-row`): the real Thai ticket at the card's width
 * (a number bought twice or more is ONE pile — the Tickets cascade, shared
 * TicketPile, papers as pictures here: the card's one action is Check), its
 * caption, then the result panel.
 *
 * While it is checked the card's edge turns indigo and a soft light sweeps
 * across it. Won: the card turns light gold with a gold ring, the winning
 * digits are marked in gold on every paper's number band, and a little gold
 * confetti rises from the "You won" line. Not won: the card turns calm grey.
 */
export const CheckRow = memo(function CheckRow({
  pile,
  draw,
  phase,
  step,
  fresh,
  disabled,
  nextDraw,
  onCheck,
  onPanel,
  onPlaced,
}: CheckRowProps) {
  const reduceMotion = useReducedMotion();
  const [rowWidth, setRowWidth] = useState(0);
  const [confetti, setConfetti] = useState(false);
  const won = pile.wins.length > 0;
  const done = phase === "done";
  const scanning = phase === "scan" || phase === "almost" || phase === "flip";
  const marked = done && won;
  const play = fresh && !reduceMotion;
  const ranges = useMemo(() => highlightRanges(pile.wins), [pile.wins]);

  // The card's fill and edge fade over 300 ms on the Lottery curve (the board's `.ck-row` transition): the edge
  // turns indigo while it is checked, then the card turns light gold (won) or calm grey (not won). At once under
  // reduced motion. The gold ring itself (box shadow) simply appears with the result.
  const fill: string = done ? (won ? LT.goldTint : LT.mist) : LT.white;
  const edge: string = done ? (won ? LT.goldEdge : LT.line) : scanning ? LT.indigoPress : LT.line;
  const fillV = useSharedValue<string>(fill);
  const edgeV = useSharedValue<string>(edge);
  useEffect(() => {
    const to = (color: string) =>
      reduceMotion ? color : withTiming(color, { duration: CK_TIME.tint, easing: LT_EASE });
    fillV.value = to(fill);
    edgeV.value = to(edge);
  }, [fill, edge, reduceMotion, fillV, edgeV]);
  const tint = useAnimatedStyle(() => ({ backgroundColor: fillV.value, borderColor: edgeV.value }));

  // A little gold confetti right after a WON result is revealed (never under reduced motion, never after Skip).
  useEffect(() => {
    setConfetti(done && won && play);
  }, [done, won, play]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { y, width, height } = event.nativeEvent.layout;
    if (Math.abs(width - rowWidth) > 0.5) setRowWidth(width);
    onPlaced(pile.key, y, height);
  };

  const panelRef = useCallback((node: ViewInstance | null) => onPanel(pile.key, node), [onPanel, pile.key]);

  const overlay = useCallback(
    (_: unknown, size: { width: number; height: number }) => (
      <GoldMarks ranges={ranges} width={size.width} height={size.height} play={play} />
    ),
    [ranges, play],
  );

  const front = pile.front;
  const bought = C.row.bought(front.boughtAt);
  // The cost is the draw's price × the count: left out while the draw's price is not known.
  const cost = pile.cost > 0 ? ks(pile.cost) : null;

  return (
    <Animated.View onLayout={onLayout} style={[styles.row, marked && styles.rowWon, tint]}>
      {pile.count === 1 ? (
        <SingleTicket pile={pile} draw={draw} marked={marked} play={play} ranges={ranges} />
      ) : (
        <TicketPile pile={pile} draw={draw} renderPaperOverlay={marked ? overlay : undefined} />
      )}

      {pile.count === 1 ? (
        <View style={styles.cap} accessible accessibilityLabel={C.row.singleA11y(front.id, bought)}>
          <LtText role="metaB" tabular style={styles.id}>
            {front.id}
          </LtText>
          <LtText role="micro" color={LT.ink3}>
            {bought}
          </LtText>
        </View>
      ) : (
        <View style={styles.cap} accessible accessibilityLabel={C.row.pileSumA11y(pile.number, pile.count, cost, bought)}>
          <View style={styles.pileSum}>
            <LtText role="num">{pile.number}</LtText>
            <LtText role="metaB" color={LT.ink2} tabular>
              {C.row.pileSum(pile.count, cost)}
            </LtText>
          </View>
          <LtText role="micro" color={LT.ink3}>
            {bought}
          </LtText>
        </View>
      )}

      <ResultPanel
        pile={pile}
        phase={phase}
        step={step}
        fresh={fresh}
        disabled={disabled}
        nextDraw={nextDraw}
        onCheck={onCheck}
        panelRef={panelRef}
      />

      {scanning && !reduceMotion && rowWidth > 0 ? <Sweep width={rowWidth} /> : null}
      {confetti ? <Confetti bottom={52} /> : null}
    </Animated.View>
  );
});

/**
 * A number bought once: the Thai ticket at the card's full width with the
 * gold marks laid over it once it has won (`.ck-tt` + `.ck-mark`).
 */
function SingleTicket({
  pile,
  draw,
  marked,
  play,
  ranges,
}: {
  pile: TicketPileData;
  draw: TicketDraw;
  marked: boolean;
  play: boolean;
  ranges: ReturnType<typeof highlightRanges>;
}) {
  const [width, setWidth] = useState(0);
  const t = pile.front;
  return (
    <View
      style={styles.single}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (Math.abs(next - width) > 0.5) setWidth(next);
      }}
    >
      <Ticket draw={draw} number={t.number} ticketId={t.id} />
      {marked && width > 0 ? (
        <GoldMarks ranges={ranges} width={width} height={width / TICKET_ASPECT} play={play} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Overflow hidden keeps the sweep and the confetti inside the card (the pile's seal reaches 9 of its 16 padding). */
  row: {
    position: "relative",
    overflow: "hidden",
    padding: 16,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    boxShadow: LT_SHADOW.s1,
  },
  /** Won: the gold ring (fill and edge come from the animated tint above). */
  rowWon: { boxShadow: LT_SHADOW.wonRing },
  single: { position: "relative" },
  /** `.ck-cap`: the ID (or the pile's sum) and when it was bought, on one line when they fit. */
  cap: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: 10,
    rowGap: 2,
    marginTop: 10,
    paddingHorizontal: 2,
  },
  /** `.lt-titem__id`: Franklin 600 14/20, tabular, +.02em. */
  id: { letterSpacing: 0.28 },
  pileSum: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 8, rowGap: 4 },
});
