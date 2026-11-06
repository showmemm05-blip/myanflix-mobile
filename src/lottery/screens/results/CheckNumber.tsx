import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Keyboard, StyleSheet, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { LtButton } from "@/lottery/components/LtButton";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { NumberWindow } from "@/lottery/components/NumberWindow";
import { StatusPill } from "@/lottery/components/Pills";
import { Segmented, type SegmentedOption } from "@/lottery/components/Segmented";
import { LtCard, type LtHelpKind } from "@/lottery/components/Surfaces";
import { dateLong, ks, spaced } from "@/lottery/data/format";
import { pilesForDraw, type TicketPile } from "@/lottery/data/piles";
import { highlightMask, matchNumber, prizeTotal, type PrizeSheet, type PrizeWin } from "@/lottery/data/prizes";
import type { TicketItem } from "@/lottery/data/sample";
import { useDrawTickets } from "@/lottery/hooks/useTickets";
import { RESULTS_COPY, speakNumbers } from "@/lottery/screens/results/copy";
import { ltComma, ltSentence, ltStop } from "@/lottery/i18n";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";

const C = RESULTS_COPY.check;
/** The board's pretend check time: long enough to see "Checking…", short enough not to wait. */
const CHECK_MS = 600;

type CheckState = "idle" | "short" | "checking" | "done";

/**
 * "Check a number" (Results board `lt-check`, round 2): pick ONE draw (the
 * latest first), type six digits, and see EVERY prize the number wins in that
 * draw — all nine groups; the amounts add up — with the matching digits lit
 * gold in a small copy of the number, then whether the number is on the
 * customer's own tickets ("Check my tickets" for the latest draw, "See this
 * ticket" for an earlier one).
 *
 * The number window is the same input as Draw (digits only, the first six
 * kept, paste works, leading zeros kept). Check pretends to work for 600ms
 * ("Checking…"); picking another draw while a result shows checks the same
 * number again for that draw. One polite announcement per outcome ("0 5 8 3 1
 * 4: won 1st prize, 60,000,000 Ks. Draw 23."). The Lottery dock steps aside
 * while the keyboard is up (LotteryDock does that); Check closes the keyboard
 * so the answer is in view.
 *
 * The sheets are the API's (GET /lottery/results) and the check runs on the
 * phone against them; the customer's tickets for the picked draw are read
 * once (GET /lottery/tickets?drawNo) so "Your ticket … has this number" is
 * real.
 */
export const CheckNumber = memo(function CheckNumber({
  sheets,
  latestDraw,
  onCheckMine,
  onOpenTicket,
}: {
  /** The published draws that can be checked, newest first. */
  sheets: readonly PrizeSheet[];
  /** The latest result's draw: its own tickets are opened on Check my tickets. */
  latestDraw: number;
  onCheckMine: () => void;
  onOpenTicket: (ticketId: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [drawNo, setDrawNo] = useState<number>(latestDraw);
  const [digits, setDigits] = useState("");
  const [dropped, setDropped] = useState(false);
  const [check, setCheck] = useState<CheckState>("idle");
  const [checked, setChecked] = useState<{ number: string; drawNo: number; run: number }>({
    number: "",
    drawNo: latestDraw,
    run: 0,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheet = sheets.find((s) => s.drawNo === drawNo) ?? sheets[0];
  const checkedSheet = sheets.find((s) => s.drawNo === checked.drawNo) ?? sheet;
  // The customer's tickets for the draw being checked; the announcement reads the ones of that moment.
  const mine = useDrawTickets(checked.drawNo);
  const tickets = mine.tickets;
  const ticketsRef = useRef(tickets);
  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);
  const sheetsRef = useRef(sheets);
  useEffect(() => {
    sheetsRef.current = sheets;
  }, [sheets]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const run = (number: string, draw: number) => {
    stop();
    Keyboard.dismiss();
    setCheck("checking");
    setChecked((cur) => ({ number, drawNo: draw, run: cur.run + 1 }));
    AccessibilityInfo.announceForAccessibility(C.live.checking(number, draw));
    timer.current = setTimeout(() => {
      timer.current = null;
      setCheck("done");
      const target = sheetsRef.current.find((s) => s.drawNo === draw);
      if (target) AccessibilityInfo.announceForAccessibility(describe(number, target, ticketsRef.current).live);
    }, CHECK_MS);
  };

  const onChange = (next: string, info: { dropped: boolean }) => {
    stop();
    setDigits(next);
    setDropped(info.dropped);
    setCheck("idle");
  };

  const onCheck = () => {
    if (check === "checking") return; // no double tap
    if (digits.length < 6) {
      setCheck("short");
      setDropped(false);
      return;
    }
    run(digits, drawNo);
  };

  // Another draw: a result on show (or on its way) is checked again for it; otherwise only the pick changes.
  const onPickDraw = (next: number) => {
    if (next === drawNo) return;
    setDrawNo(next);
    if ((check === "done" || check === "checking") && digits.length === 6) run(digits, next);
  };

  const onClear = () => {
    stop();
    setDigits("");
    setDropped(false);
    setCheck("idle");
  };

  // The help line under the window (board order: dropped, short, empty, partial, checking, checked, ready).
  const full = digits.length === 6;
  const short = check === "short" && !full;
  let help: { kind: LtHelpKind; text: string };
  if (dropped && !full) help = { kind: "err", text: C.help.dropped };
  else if (short) help = { kind: "err", text: C.help.short(digits.length) };
  else if (!digits.length) help = { kind: "info", text: C.help.empty };
  else if (!full) help = { kind: "info", text: C.help.partial(digits.length) };
  else if (check === "checking") help = { kind: "info", text: C.help.checking(checked.drawNo) };
  else if (check === "done") help = { kind: "info", text: C.help.checked(checked.drawNo) };
  else help = { kind: "ok", text: C.help.ready(digits, drawNo) };
  const invalid = (dropped && !full) || short;

  const done = check === "done" && checked.number.length === 6;
  const outcome = useMemo(
    () => (done && checkedSheet ? describe(checked.number, checkedSheet, tickets) : null),
    [done, checked.number, checkedSheet, tickets],
  );

  const options = useMemo<SegmentedOption<string>[]>(
    () => sheets.map((s) => ({ key: `${s.drawNo}`, label: `${s.drawNo}`, accessibilityLabel: C.drawA11y(s.drawNo) })),
    [sheets],
  );
  const fade = reduceMotion ? undefined : FadeIn.duration(200);

  if (!sheet) return null;

  return (
    <LtCard>
      <LtText role="title" accessibilityRole="header">
        {C.title}
      </LtText>
      <LtText role="meta" color={LT.ink2} style={styles.sub}>
        {C.sub}
      </LtText>

      <LtText role="metaB" color={LT.ink2} style={styles.label} importantForAccessibility="no" accessible={false}>
        {C.drawLabel}
      </LtText>
      <Segmented
        options={options}
        value={`${drawNo}`}
        onChange={(key) => {
          const next = sheets.find((s) => `${s.drawNo}` === key);
          if (next) onPickDraw(next.drawNo);
        }}
        accessibilityLabel={C.drawGroupA11y}
        style={styles.draws}
      />
      <LtText role="micro" color={LT.ink3} style={styles.drawLine}>
        {C.drawLine(drawNo, dateLong(sheet.dateIso), drawNo === latestDraw)}
      </LtText>

      <NumberWindow
        value={digits}
        onChange={onChange}
        state={invalid ? "error" : undefined}
        label={C.label}
        help={{ ...help, spoken: speakNumbers(help.text) }}
        style={styles.window}
      />

      <View style={styles.tools}>
        <LtButton
          variant="secondary"
          icon="results"
          label={C.button}
          busy={check === "checking"}
          busyLabel={C.busy}
          onPress={onCheck}
          style={styles.checkButton}
        />
        <LtButton
          variant="ghost"
          size="sm"
          label={C.clear}
          accessibilityLabel={C.clearA11y}
          disabled={!digits.length || check === "checking"}
          onPress={onClear}
        />
      </View>

      <View style={styles.out}>
        {!outcome ? (
          <View style={styles.idle} accessible accessibilityLabel={`${C.idleTitle(drawNo)}${ltStop()} ${C.idleBodyA11y}`}>
            <LtIcon name="info" size={20} color={LT.indigo} />
            <View style={styles.idleText}>
              <LtText role="buttonSm">{C.idleTitle(drawNo)}</LtText>
              <LtText role="meta" color={LT.ink2}>
                {C.idleBody}
              </LtText>
            </View>
          </View>
        ) : (
          <Animated.View
            key={checked.run}
            entering={fade}
            style={[styles.res, outcome.wins.length ? styles.resWon : null]}
          >
            <View style={styles.resTop}>
              <StatusPill kind={outcome.wins.length ? "won" : "notwon"} />
              <LtText role="button" accessibilityRole="header" style={styles.resTitle}>
                {outcome.wins.length ? C.wonTitle(outcome.wins.length, checked.drawNo) : C.noneTitle(checked.drawNo)}
              </LtText>
            </View>

            <DigitCells number={checked.number} mask={highlightMask(outcome.wins)} won={outcome.wins.length > 0} />

            {outcome.wins.length ? (
              <>
                <View style={styles.lines}>
                  {outcome.wins.map((w) => (
                    <PrizeLine key={`${w.group.key}-${w.matched}`} win={w} />
                  ))}
                </View>
                {outcome.wins.length > 1 ? (
                  <View style={styles.total} accessible accessibilityLabel={`${C.totalTerm} ${ks(outcome.each)}`}>
                    <LtText role="metaB">{C.totalTerm}</LtText>
                    <LtText role="h" color={LT.goldText} style={styles.totalSum}>
                      {ks(outcome.each)}
                    </LtText>
                  </View>
                ) : null}
                <View style={styles.note}>
                  <LtText role="caption" color={LT.ink2} style={styles.noteText}>
                    {C.paidNote}
                  </LtText>
                </View>
              </>
            ) : (
              <LtText
                role="meta"
                color={LT.ink2}
                accessibilityLabel={`${spaced(checked.number)}${C.noneBody(checked.drawNo)}`}
              >
                <LtText role="buttonSm" tabular>
                  {checked.number}
                </LtText>
                {C.noneBody(checked.drawNo)}
              </LtText>
            )}

            {outcome.pile ? (
              <View style={[styles.mine, outcome.wins.length ? styles.mineWon : null]}>
                <LtText role="meta" color={LT.ink2}>
                  {outcome.mineText}
                </LtText>
                {checked.drawNo === latestDraw ? (
                  <LtButton variant="secondary" size="sm" label={C.checkMine} onPress={onCheckMine} />
                ) : (
                  <LtButton
                    variant="secondary"
                    size="sm"
                    label={C.seeTicket}
                    onPress={() => {
                      if (outcome.pile) onOpenTicket(outcome.pile.front.id);
                    }}
                  />
                )}
              </View>
            ) : null}
          </Animated.View>
        )}
      </View>
    </LtCard>
  );
});

interface Outcome {
  wins: PrizeWin[];
  /** Ks for ONE ticket with this number (the amounts add up). */
  each: number;
  /** The customer's own tickets with this number in that draw, if any. */
  pile: TicketPile | undefined;
  mineText: string;
  /** The one polite announcement. */
  live: string;
}

/** Every prize, the customer's own tickets and the spoken outcome (board `prizesFor` + `ids` + `live`). */
function describe(number: string, sheet: PrizeSheet, tickets: readonly TicketItem[]): Outcome {
  const wins = matchNumber(sheet, number);
  const each = prizeTotal(wins);
  const pile = pilesForDraw(sheet.drawNo, tickets, undefined, sheet).find((p) => p.number === number);
  const ids = pile ? pile.tickets.map((t) => t.id) : [];
  let mineText = "";
  if (ids.length === 1) mineText = C.mineOne(ids[0]);
  else if (ids.length > 1) mineText = C.mineMany(ids, wins.length ? ks(each * ids.length) : undefined);
  let live = wins.length
    ? C.live.won(
        number,
        wins.map((w) => `${w.group.name}${ltComma()} ${ks(w.amount)}`),
        wins.length > 1 ? ks(each) : null,
        sheet.drawNo,
      )
    : C.live.none(number, sheet.drawNo);
  if (mineText) live += ` ${mineText}`;
  return { wins, each, pile, mineText, live };
}

/** One prize line: the group, how it matched, the amount (board `lt-cklines li`). */
function PrizeLine({ win }: { win: PrizeWin }) {
  const kind = win.group.kind;
  const how =
    kind === "all" ? C.allSix : kind === "front3" ? C.startsWith(win.matched) : C.endsWith(win.matched);
  const howA11y =
    kind === "all" ? C.allSixA11y : kind === "front3" ? C.startsWithA11y(win.matched) : C.endsWithA11y(win.matched);
  const amount = ks(win.amount);
  return (
    <View style={styles.line} accessible accessibilityLabel={`${win.group.name}${ltStop()} ${howA11y} ${ltSentence(amount)}`}>
      <View style={styles.lineName}>
        <LtText role="metaB">{win.group.name}</LtText>
        <LtText role="caption" color={LT.ink2} tabular>
          {how}
        </LtText>
      </View>
      <LtText role="h" numberOfLines={1} style={styles.lineAmount}>
        {amount}
      </LtText>
    </View>
  );
}

/**
 * The checked number as six small cells (board `lt-ckn`), hidden from screen
 * readers (the title and the announcement say it digit by digit). Won: the
 * matching cells gold, the others ink-3; not won: all plain.
 */
function DigitCells({ number, mask, won }: { number: string; mask: boolean[]; won: boolean }) {
  return (
    <View style={styles.cells} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {number.split("").map((d, i) => {
        const hit = won && mask[i];
        return (
          <View key={i} style={[styles.cell, hit && styles.cellHit]}>
            <LtText
              role="h"
              color={hit ? LT.ink : won ? LT.ink3 : LT.ink2}
              maxFontSizeMultiplier={1}
              style={styles.cellDigit}
            >
              {d}
            </LtText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 4 },
  /** `.lt-label` 16 above the draw pick. */
  label: { marginTop: 16 },
  draws: { marginTop: 8 },
  drawLine: { marginTop: 6 },
  /** The "Six-digit number" label 16 below the draw line; the window keeps 10 under it. */
  window: { marginTop: 16 },
  tools: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12 },
  checkButton: { flex: 1 },
  out: { marginTop: 16 },
  /** `.lt-match--idle`: cream, line edge, radius 8. */
  idle: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    minHeight: 84,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: LT.cream,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.button,
  },
  idleText: { flex: 1, minWidth: 0, gap: 2 },
  /** `.lt-ckres`: mist, line edge, radius 8, padding 14, 12 between parts; won = gold tint + gold line. */
  res: {
    gap: 12,
    padding: 14,
    backgroundColor: LT.mist,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.button,
  },
  resWon: { backgroundColor: LT.goldTint, borderColor: LT.goldLine },
  resTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 10, rowGap: 6 },
  /** Franklin 700 16/22. */
  resTitle: { lineHeight: 22, flexShrink: 1 },
  /** `.lt-ckn`: six cells 40 wide (narrower on a small phone), gap 4. */
  cells: { flexDirection: "row", gap: 4, maxWidth: 264 },
  cell: {
    flex: 1,
    maxWidth: 40,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.input,
  },
  cellHit: { backgroundColor: LT.gold, borderColor: LT.goldEdge },
  /** Literata 700 26. */
  cellDigit: { fontSize: 26, lineHeight: 30 },
  lines: { borderTopWidth: 1, borderTopColor: LT.goldLine },
  line: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: LT.goldLine,
  },
  lineName: { flex: 1, minWidth: 0 },
  /** Literata 700 16/22, never wrapped. */
  lineAmount: { fontSize: 16, lineHeight: 22 },
  total: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  /** Literata 700 22/28, gold text. */
  totalSum: { fontSize: 22, lineHeight: 28 },
  note: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 4 },
  noteText: { flexShrink: 1 },
  /** `.lt-ckres__mine`: a hairline above (gold on a win), 12 inside, 8 between text and button. */
  mine: { alignItems: "flex-start", gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: LT.line },
  mineWon: { borderTopColor: LT.goldLine },
});
