import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type ViewInstance,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LotteryFooter } from "@/lottery/components/LotteryFooter";
import { LotteryScreen } from "@/lottery/components/LotteryScreen";
import { LtButton } from "@/lottery/components/LtButton";
import { LtEmpty } from "@/lottery/components/LtEmpty";
import { LtText } from "@/lottery/components/LtText";
import { LtChip } from "@/lottery/components/Pills";
import { PrizeClaim } from "@/lottery/components/claim/PrizeClaim";
import type { TicketDraw } from "@/lottery/components/ticket/Ticket";
import { dateLong, dateTimeLabel, ks } from "@/lottery/data/format";
import { drawCheck, type DrawCheck } from "@/lottery/data/piles";
import { PRIZE_GROUP } from "@/lottery/data/prizes";
import { useLotteryFocusRefresh } from "@/lottery/hooks/lotteryKeys";
import { useCurrentDraw } from "@/lottery/hooks/useCurrentDraw";
import { useDraw } from "@/lottery/hooks/useDraws";
import { useLtClearance } from "@/lottery/hooks/useLtClearance";
import { isResultsNotPublished, useDrawResults, useResults } from "@/lottery/hooks/useResults";
import { useDrawTickets } from "@/lottery/hooks/useTickets";
import type { LotteryCheckTicketsScreenProps } from "@/lottery/navigation/types";
import { focusNode } from "@/lottery/screens/checktickets/checkKit";
import { CheckHead, CheckSummary, ResultStrip } from "@/lottery/screens/checktickets/CheckParts";
import { CheckRow } from "@/lottery/screens/checktickets/CheckRow";
import { CHECK_COPY } from "@/lottery/screens/checktickets/copy";
import { useCheckRun, type CheckEntry } from "@/lottery/screens/checktickets/useCheckRun";
import { DrawStripSkeleton } from "@/lottery/screens/draw/DrawStates";
import { DreamErrorBanner, DreamLoadingLine } from "@/lottery/screens/dreams/DreamStates";
import { LT_LAYOUT } from "@/lottery/theme/tokens";

const C = CHECK_COPY;

/** Give VoiceOver / TalkBack a moment after the content changes before moving focus. */
const FOCUS_DELAY = 150;
const NO_CHECK: DrawCheck = { drawNo: 0, piles: [], tickets: 0, wonTickets: 0, total: 0 };
const NO_ENTRIES: CheckEntry[] = [];
const NO_COUNTS: Record<string, number> = {};

/**
 * CHECK MY TICKETS (CheckTickets.dc.html, owner 15 Oct 2026) — pushed inside
 * the Results tab (its own small stack, so the dock keeps Results current and
 * Back returns to Results). Checking results is exciting but SIMPLE: one
 * number at a time, about 4–5 s each — the nine prize groups with a thin
 * indigo bar and a soft light sweeping the card, "Almost there…", then the
 * result panel turns over: Won (light gold card, gold ring, Won pill, gold
 * marks over the matching digits, prize lines, "You won" counting up, a
 * little gold confetti) or Not won (calm grey, the next draw's date).
 *
 * From the top: page head; the compact result (1st prize · Last 2 digits ·
 * All prizes ›); "Check all my tickets (4)" (one after another, 0.4 s apart)
 * + "Skip to the results" (everything at once); the gold summary once every
 * card is checked ("3 of 4 tickets won · 60,040,000 Ks"); one card per
 * number — the same number bought twice is ONE pile with ONE result.
 *
 * Check all follows the card being checked down the page and ends on the
 * summary. Screen readers hear "Checking 0 5 8 3 1 4." and then the result;
 * focus moves to the card checked, or to the summary. Reduced motion: every
 * result appears at once, nothing moves or vibrates.
 *
 * Real since phase 3 (2026-10-19): the sheet is the draw's published result
 * (GET /lottery/draws/:drawNo/results; the latest from GET /lottery/results
 * when no draw is named), the tickets the customer's own for that draw
 * (GET /lottery/tickets?drawNo), matched on the phone against all nine
 * groups exactly as the server awarded them. The papers print on the draw's
 * own picture and frame (GET /lottery/draws/:drawNo).
 *
 * Prize payment by request (PrizeClaim board, 24 Oct 2026): nothing is paid
 * at publish any more. When something was won, the gold summary carries the
 * prize-claim block (components/claim/PrizeClaim: GET /lottery/claims/draws/
 * :drawNo) — "Request payment" opens the sheet that posts ONE claim for every
 * winning ticket in the draw; then Requested · Paid · Rejected · Expired.
 */
export function LotteryCheckTicketsScreen({ navigation, route }: LotteryCheckTicketsScreenProps) {
  useLotteryFocusRefresh();
  const results = useResults();
  const drawNo = route.params?.drawNo ?? results.sheets[0]?.drawNo;
  const sheetQuery = useDrawResults(drawNo);
  const sheet = sheetQuery.sheet;
  const drawQuery = useDraw(drawNo);
  const mine = useDrawTickets(drawNo);
  const current = useCurrentDraw();
  const reduceMotion = useReducedMotion();

  const tickets = mine.tickets;
  const check = useMemo(
    // The draw's own price, or none while it loads: never the sample's.
    () => (sheet && drawNo !== undefined ? drawCheck(drawNo, tickets, sheet, drawQuery.info?.price) : NO_CHECK),
    [sheet, drawNo, tickets, drawQuery.info?.price],
  );
  const entries = useMemo<CheckEntry[]>(
    () =>
      check === NO_CHECK
        ? NO_ENTRIES
        : check.piles.map((p) => ({ key: p.key, number: p.number, won: p.wins.length > 0, live: C.live.result(p) })),
    [check],
  );
  const counts = useMemo(
    () => (check === NO_CHECK ? NO_COUNTS : Object.fromEntries(check.piles.map((p) => [p.key, p.count]))),
    [check],
  );
  const summaryTitle = check.total ? C.summary.title(check.wonTickets, check.tickets) : C.summary.none;
  const summaryLive = C.live.summary(summaryTitle, drawNo ?? 0, ks(check.total));

  const run = useCheckRun(entries, counts, { instant: reduceMotion, summaryLive });
  const { state } = run;

  // "Next draw: Saturday 31 October" — the draw on sale or coming up (the year is plain from the page).
  const upcoming = current.data?.info;
  const nextDraw =
    upcoming && upcoming.status !== "published" && upcoming.no !== drawNo
      ? dateLong(upcoming.dateIso).replace(/ \d{4}$/, "")
      : null;
  const stripValues = useMemo(
    () =>
      sheet
        ? [
            { name: PRIZE_GROUP.first.name, digits: sheet.first },
            { name: PRIZE_GROUP.back2.name, digits: sheet.nums.back2[0] ?? "" },
          ]
        : [],
    [sheet],
  );
  /** What the papers print: the draw's own picture and frame once it has loaded, else the sheet's facts. */
  const paperDraw: TicketDraw | null = sheet
    ? (drawQuery.info ?? { no: sheet.drawNo, dateIso: sheet.dateIso, price: 0 })
    : null;

  const toResults = useCallback(() => navigation.popTo("LotteryResults"), [navigation]);

  /* ── Where things are on the page, to follow a Check all run and to land on the summary ── */
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const place = useRef({ section: 0, list: 0, sum: { y: 0, h: 0 }, rows: {} as Record<string, { y: number; h: number }> });
  const panels = useRef<Record<string, ViewInstance | null>>({});
  const summaryNode = useRef<ViewInstance | null>(null);

  const { height: windowH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const clearance = useLtClearance();
  const viewH = windowH - insets.top - LT_LAYOUT.topBarH - clearance.dock;

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);

  /** Scrolls so a block (page y, height) is in view, unless it already is. */
  const showBlock = useCallback(
    (y: number, h: number) => {
      const top = scrollY.current;
      if (y >= top + 8 && y + h <= top + viewH - 8) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: !reduceMotion });
    },
    [viewH, reduceMotion],
  );

  // Leaving the page (another tab, the phone's back) mid-check: finish quietly instead of ticking off-screen.
  useEffect(() => navigation.addListener("blur", run.settle), [navigation, run.settle]);

  // Check all: bring each card into view as its turn starts.
  useEffect(() => {
    if (!state.all || !state.cur) return;
    const row = place.current.rows[state.cur];
    if (row) showBlock(place.current.section + place.current.list + row.y, row.h);
  }, [state.all, state.cur, showBlock]);

  // Move the screen reader (and, for the summary, the page) where the last action asked.
  useEffect(() => {
    const req = run.focus;
    if (!req) return;
    const id = setTimeout(() => {
      if (req.target.kind === "sum") {
        showBlock(place.current.sum.y, place.current.sum.h);
        focusNode(summaryNode.current);
      } else {
        focusNode(panels.current[req.target.key]);
      }
    }, FOCUS_DELAY);
    return () => clearTimeout(id);
  }, [run.focus, showBlock]);

  const onPanel = useCallback((key: string, node: ViewInstance | null) => {
    panels.current[key] = node;
  }, []);
  const onRowPlaced = useCallback((key: string, y: number, h: number) => {
    place.current.rows[key] = { y, h };
  }, []);
  const onSumPlaced = useCallback((y: number, h: number) => {
    place.current.sum = { y, h };
  }, []);
  const summaryRef = useCallback((node: ViewInstance | null) => {
    summaryNode.current = node;
  }, []);

  const busyAll = run.running && state.all;
  const allLabel =
    run.ticketsLeft < check.tickets ? C.actions.checkOther(run.ticketsLeft) : C.actions.checkAll(check.tickets);

  // ----- what the page shows before the check can start -----
  let state0: ReactNode = null;
  if (drawNo === undefined) {
    state0 = results.isPending ? (
      <DreamLoadingLine text={C.loading} />
    ) : results.isError ? (
      <DreamErrorBanner title={C.errorTitle} text={C.errorText} retryLabel={C.retry} onRetry={() => results.refetch()} />
    ) : (
      <LtEmpty
        title={C.noResults.title}
        text={C.noResults.text}
        action={<LtButton variant="secondary" label={C.top.back} onPress={toResults} />}
      />
    );
  } else if (sheetQuery.isError) {
    state0 = isResultsNotPublished(sheetQuery.error) ? (
      <LtEmpty
        title={C.notPublished.title(drawNo)}
        text={C.notPublished.text}
        action={<LtButton variant="secondary" label={C.top.back} onPress={toResults} />}
      />
    ) : (
      <DreamErrorBanner title={C.errorTitle} text={C.errorText} retryLabel={C.retry} onRetry={() => sheetQuery.refetch()} />
    );
  } else if (!sheet) {
    state0 = (
      <View style={styles.loading}>
        <DreamLoadingLine text={C.loading} />
        <DrawStripSkeleton />
      </View>
    );
  }

  return (
    <LotteryScreen
      topBar={{
        variant: "page",
        backLabel: C.top.back,
        backA11y: C.top.backA11y,
        title: { pre: C.top.pre, big: C.top.big(drawNo) },
      }}
      scrollRef={scrollRef}
      onScroll={onScroll}
      contentStyle={styles.content}
      footer={<LotteryFooter />}
    >
      {state0 ?? (sheet && drawNo !== undefined && paperDraw ? (
        <>
          <CheckHead drawNo={drawNo} day={dateLong(sheet.dateIso)} publishedAt={dateTimeLabel(sheet.publishedAt)} />

          <ResultStrip drawNo={drawNo} values={stripValues} onAllPrizes={toResults} />

          {mine.isPending ? (
            <View style={styles.loading}>
              <DreamLoadingLine text={C.loadingTickets} />
              <DrawStripSkeleton />
            </View>
          ) : mine.isError ? (
            <DreamErrorBanner
              title={C.ticketsErrorTitle}
              text={C.ticketsErrorText}
              retryLabel={C.retry}
              onRetry={() => mine.refetch()}
            />
          ) : check.piles.length === 0 ? (
            <LtEmpty
              title={C.empty.title(drawNo)}
              text={C.empty.text}
              action={<LtButton variant="secondary" label={C.empty.action} onPress={toResults} />}
            />
          ) : (
            <>
              {/* ----- Actions: check all (one after another) · skip to the results · after: watch again ----- */}
              {!run.sumShow ? (
                <View style={styles.actions}>
                  <LtButton
                    variant="primary"
                    size="block"
                    icon="search"
                    label={allLabel}
                    busy={busyAll}
                    busyLabel={C.actions.checking}
                    disabled={run.running}
                    onPress={run.checkAll}
                  />
                  <LtButton variant="ghost" label={C.actions.skip} onPress={run.skip} style={styles.skip} />
                </View>
              ) : !reduceMotion ? (
                <LtButton variant="secondary" size="block" icon="refresh" label={C.actions.again} onPress={run.again} />
              ) : null}

              {/* ----- The gold summary, once every ticket is checked ----- */}
              {run.sumShow ? (
                <CheckSummary
                  drawNo={drawNo}
                  title={summaryTitle}
                  total={check.total}
                  fresh={state.sumFresh}
                  summaryRef={summaryRef}
                  onPlaced={onSumPlaced}
                  claim={
                    <PrizeClaim
                      drawNo={drawNo}
                      place="summary"
                      publishedAt={sheet.publishedAt}
                      enabled={check.wonTickets > 0}
                    />
                  }
                />
              ) : null}

              {/* ----- Your tickets: one card per number ----- */}
              <View
                style={styles.section}
                onLayout={(e: LayoutChangeEvent) => {
                  place.current.section = e.nativeEvent.layout.y;
                }}
              >
                <View style={styles.sectionHead}>
                  <LtText role="title" accessibilityRole="header" style={styles.flexText}>
                    {C.list.title(drawNo)}
                  </LtText>
                  <LtChip text={C.list.count(check.tickets)} style={styles.chip} />
                </View>
                <View
                  style={styles.list}
                  onLayout={(e: LayoutChangeEvent) => {
                    place.current.list = e.nativeEvent.layout.y;
                  }}
                >
                  {check.piles.map((pile) => {
                    const phase = run.phaseOf(pile.key);
                    return (
                      <CheckRow
                        key={pile.key}
                        pile={pile}
                        draw={paperDraw}
                        phase={phase}
                        step={phase === "scan" ? state.step : 0}
                        fresh={!!state.fresh[pile.key]}
                        disabled={run.running}
                        nextDraw={nextDraw}
                        onCheck={run.checkOne}
                        onPanel={onPanel}
                        onPlaced={onRowPlaced}
                      />
                    );
                  })}
                </View>
              </View>
            </>
          )}
        </>
      ) : null)}
    </LotteryScreen>
  );
}

const styles = StyleSheet.create({
  /** The board's `.lt-ck .lt-main{padding-top:20px}`. */
  content: { paddingTop: 20 },
  loading: { gap: 16 },
  actions: { gap: 8 },
  /** `.ck-skip`: a 44-tall ghost button in the middle. */
  skip: { alignSelf: "center", height: 44 },
  section: { gap: 12 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  flexText: { flex: 1, minWidth: 0 },
  chip: { alignSelf: "center" },
  list: { gap: 16 },
});
