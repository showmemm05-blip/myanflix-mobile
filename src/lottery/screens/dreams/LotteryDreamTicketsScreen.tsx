import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useWallet } from "@/hooks/useWallet";
import { BuyBar } from "@/lottery/components/BuyBar";
import { ConfirmSheet, type ConfirmLine } from "@/lottery/components/ConfirmSheet";
import { LotteryFooter } from "@/lottery/components/LotteryFooter";
import { LotteryScreen } from "@/lottery/components/LotteryScreen";
import { LtButton } from "@/lottery/components/LtButton";
import { LtEmpty } from "@/lottery/components/LtEmpty";
import { LtText } from "@/lottery/components/LtText";
import { useLtToast } from "@/lottery/components/LtToast";
import { StatusPill } from "@/lottery/components/Pills";
import { saleStatus } from "@/lottery/data/draws";
import { dayOf, ks, monthShort, spaced } from "@/lottery/data/format";
import { firstFit, firstPage, placeAt, regen, type GenConfig, type GenTicket, type GenWant } from "@/lottery/data/generator";
import { SAMPLE_CURRENT_DRAW, SAMPLE_DRAWS, type DrawInfo, type DrawStatus, type PurchaseItem } from "@/lottery/data/sample";
import { useAvailability } from "@/lottery/hooks/useAvailability";
import { useCurrentDraw, useLotteryNow } from "@/lottery/hooks/useCurrentDraw";
import { isDreamNotFound, useDream } from "@/lottery/hooks/useDreams";
import { useKeyboardShown } from "@/lottery/hooks/useKeyboardShown";
import type { LotteryHomeScreenProps } from "@/lottery/navigation/types";
import { DREAM_COPY } from "@/lottery/screens/dreams/copy";
import { useAnnounceWhenStill } from "@/lottery/screens/dreams/DreamBits";
import { columnWidth, dreamName } from "@/lottery/screens/dreams/dreamBook";
import { DreamHead } from "@/lottery/screens/dreams/DreamHead";
import { DreamErrorBanner, DreamLoadingLine } from "@/lottery/screens/dreams/DreamStates";
import { GenerateButton, PlaceControl } from "@/lottery/screens/dreams/GenControls";
import { GEN_CARD_INSET, GEN_GRID_GAP, GenTicketCard, GenTicketSkeleton } from "@/lottery/screens/dreams/GenTicketCard";
import { LT } from "@/lottery/theme/tokens";
import type { DreamBook } from "@/types/lottery";

const COPY = DREAM_COPY.gen;
/** The short shimmer before new tickets print (board GEN_MS). */
const GEN_MS = 650;
/** Tickets on the page: six, two per row (canvas "Dream detail, simpler"). */
const TICKETS = 6;
/** No draw on sale: nothing is held, nothing is off sale. */
const NO_NUMBERS: readonly string[] = [];

interface GenState {
  cfg: GenConfig;
  list: GenTicket[];
  /** Picked numbers (only ones that can be bought are ever added). */
  picked: Set<string>;
}

/** The first page for a dream (its number in this book). */
function startState(book: DreamBook, number: string): GenState {
  const cfg: GenConfig = { dream: number, pos: "mixed", count: TICKETS, roll: 0 };
  return { cfg, list: firstPage(book, cfg), picked: new Set() };
}

/**
 * A DREAM'S PAGE — the simpler design (canvas "Dream detail, simpler",
 * PRE6JJF945aEEkuGksgpF4, the owner's comments of 3 Nov 2026), pushed from
 * a dream card in the book: the dream on one row (picture, both names, its
 * number) → one line about the current draw (its sale pill, number, date,
 * price) → "Tickets with 027": where the dream digits go, six tickets two per
 * row (each a mini Thai ticket with its number and pick mark on one row),
 * Show other tickets, a line that says picked tickets stay, Copy numbers →
 * the footer, with the buy bar floating over the dock while the draw is on
 * sale.
 *
 * Gone since the first design: the Current draw card, "Make sample tickets"
 * (its explanation, the 10 / 15 choice, the second Generate button), Select
 * all / Clear, the legend, the position tag under each ticket, the rules
 * note, Change dream and Copy number. Going back to the book is how you
 * change the dream.
 *
 * Pick the tickets you like and "Buy 3 tickets · 3,000 Ks" opens Confirm
 * (v3 · compact): one row per picked number, its dream digits as one tint
 * chip and "Fish · dream 027" under it, × 1 to start. A quantity raised there
 * is kept for that pick (the buy bar counts it), and a number removed there
 * is let go here when the sheet closes. After the purchase the Draw tab's
 * Printed page shows the tickets coming out.
 *
 * THE DREAM IS REAL: the route carries its number and useDream loads it
 * (from the book's cached list when it came from there) — "Loading the
 * dream…", the error banner with Try again, and "This dream is not in the
 * book" (a 404: missing, switched off or unnamed) with a way back to the
 * book. THE DRAW IS REAL: the current draw from the API, and every number on
 * the page is asked whether it is on sale and how many of it are held (POST
 * …/availability). The tickets are SAMPLES until bought: every one comes
 * from data/generator.ts — deterministic, so the page is the same each time.
 */
export function LotteryDreamTicketsScreen({ navigation, route }: LotteryHomeScreenProps<"LotteryDreamTickets">) {
  const { book, number: routeDream } = route.params;
  const toast = useLtToast();
  const { width } = useWindowDimensions();
  const keyboardUp = useKeyboardShown();
  const wallet = useWallet();
  const balance = wallet.data?.balance;

  const dreamQuery = useDream(book, routeDream);
  const dream = dreamQuery.data;
  const current = useCurrentDraw();
  const draw = current.data?.info ?? null;
  const nowMs = useLotteryNow();
  const status = draw ? saleStatus(draw, nowMs) : null;
  const open = status === "open";
  const drawNo = draw?.no ?? 0;
  const price = draw?.price ?? 0;
  const most = draw?.maxPerNumber ?? 1;
  /** What the mini tickets print: the current draw, or the sample one while there is none. */
  const printOn = draw ?? SAMPLE_DRAWS[SAMPLE_CURRENT_DRAW];

  const [gen, setGen] = useState<GenState>(() => startState(book, routeDream));
  const [generating, setGenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** Tickets per picked number, when Confirm raised it above 1 (a pick starts at 1). */
  const [qtys, setQtys] = useState<Readonly<Record<string, number>>>({});

  const genTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (genTimer.current) clearTimeout(genTimer.current);
    },
    [],
  );

  // A new dream arriving in the params (navigate to this page with another dream) starts fresh.
  const [seenRouteDream, setSeenRouteDream] = useState(routeDream);
  if (routeDream !== seenRouteDream) {
    setSeenRouteDream(routeDream);
    if (routeDream !== gen.cfg.dream) {
      setGen(startState(book, routeDream));
      setQtys({});
    }
  }

  const { cfg, list, picked } = gen;
  /** The dream number the tickets are made with — the route's, which the loaded dream carries too. */
  const dn = cfg.dream;

  /** The shimmer: new tickets show as skeletons for a moment, then print in. One roll per tap. */
  const shimmer = useCallback(() => {
    if (genTimer.current) clearTimeout(genTimer.current);
    setGenerating(true);
    genTimer.current = setTimeout(() => {
      genTimer.current = null;
      setGenerating(false);
    }, GEN_MS);
  }, []);

  // ---------- what can be bought: the draw's answer for every number on the page ----------
  const numbers = useMemo(() => (open ? list.map((t) => t.num) : NO_NUMBERS), [open, list]);
  const availability = useAvailability(open ? drawNo : null, numbers);
  const availabilityOf = availability.of;
  const heldOf = useCallback((num: string) => availabilityOf(num)?.held ?? 0, [availabilityOf]);
  const isOff = useCallback((num: string) => !!availabilityOf(num)?.offSale, [availabilityOf]);
  const pickable = useCallback((num: string) => !isOff(num) && heldOf(num) < most, [isOff, heldOf, most]);
  const pickedNums = useMemo(
    () => list.filter((t) => picked.has(t.num) && pickable(t.num)).map((t) => t.num),
    [list, picked, pickable],
  );
  const np = pickedNums.length;

  // ---------- changing the tickets ----------
  const reroll = useCallback(
    (next: GenConfig) => {
      setGen((prev) => {
        const out = regen(book, prev.list, prev.picked, next);
        return { cfg: next, list: out.list, picked: out.picked };
      });
      shimmer();
    },
    [book, shimmer],
  );
  const again = () => {
    if (generating) return;
    reroll({ ...cfg, roll: cfg.roll + 1 });
  };
  const changePlace = (pos: GenWant) => {
    if (pos === cfg.pos) return;
    reroll({ ...cfg, pos });
  };

  const toggle = useCallback(
    (num: string) => {
      if (isOff(num) || heldOf(num) >= most) {
        // A pick the draw has since refused is let go, so it is not kept through every later roll.
        setGen((prev) => {
          if (!prev.picked.has(num)) return prev;
          const next = new Set(prev.picked);
          next.delete(num);
          return { ...prev, picked: next };
        });
        if (isOff(num)) {
          toast.show(COPY.offToast(num, drawNo), { kind: "warn", spoken: COPY.offToastSpoken(num, drawNo) });
        } else {
          toast.show(COPY.fullToast(num, most), { kind: "warn", spoken: COPY.fullToastSpoken(num, most) });
        }
        return;
      }
      setGen((prev) => {
        const next = new Set(prev.picked);
        if (next.has(num)) next.delete(num);
        else next.add(num);
        return { ...prev, picked: next };
      });
      // A pick (or a pick again) starts at 1 ticket.
      setQtys((prev) => forget(prev, [num]));
    },
    [isOff, heldOf, most, drawNo, toast],
  );
  const clearPicks = () => {
    setGen((prev) => ({ ...prev, picked: new Set() }));
    setQtys({});
  };

  // ---------- copying (a clipboard failure is a quiet no-op, as in DepositSheet) ----------
  const copyNumbers = async () => {
    // Picked ones, or every number on sale; numbers that are not on sale are never copied.
    const nums = np ? pickedNums : list.filter((t) => !isOff(t.num)).map((t) => t.num);
    if (!nums.length) return;
    try {
      await Clipboard.setStringAsync(nums.join(", "));
    } catch {
      return;
    }
    toast.show(COPY.copiedSome(nums), { spoken: COPY.copiedSomeSpoken(nums.length) });
  };

  // ---------- buying ----------
  // One line per picked number (in page order, once each), with where the dream's digits sit in it.
  const name = dream ? dreamName(dream) : dn;
  const lines = useMemo<ConfirmLine[]>(() => {
    const seen = new Set<string>();
    const out: ConfirmLine[] = [];
    for (const t of list) {
      if (seen.has(t.num) || !picked.has(t.num) || !pickable(t.num)) continue;
      seen.add(t.num);
      const place = firstFit(book, t.num, dn, t.pos) ?? firstFit(book, t.num, dn, "mixed");
      out.push({
        number: t.num,
        quantity: qtys[t.num] ?? 1,
        dream: place ? { name, number: dn, at: placeAt(book, place) } : undefined,
      });
    }
    return out;
  }, [list, picked, pickable, qtys, book, dn, name]);
  /** Tickets to buy: the picks, each × its quantity. */
  const nt = lines.reduce((sum, line) => sum + line.quantity, 0);

  const onSheetQuantity = useCallback((number: string, quantity: number) => {
    setQtys((prev) => ({ ...prev, [number]: quantity }));
  }, []);
  const onSheetClose = (left: readonly ConfirmLine[]) => {
    setConfirmOpen(false);
    // A number removed in the sheet is let go here too, so the page shows what you left.
    const kept = new Set(left.map((line) => line.number));
    const gone = lines.map((line) => line.number).filter((number) => !kept.has(number));
    if (!gone.length) return;
    setGen((prev) => {
      const next = new Set(prev.picked);
      for (const number of gone) next.delete(number);
      return { ...prev, picked: next };
    });
    setQtys((prev) => forget(prev, gone));
  };
  const onBought = (purchase: PurchaseItem) => {
    // Counted from the purchase that stands (a lost answer settled by its ref may be an earlier basket's).
    const count = purchase.ticketIds.length;
    setConfirmOpen(false);
    clearPicks();
    navigation.navigate("LotteryDrawTab", { screen: "LotteryPrinted", params: { purchaseId: purchase.ref }, initial: false });
    toast.show(COPY.bought(count, purchase.drawNo));
  };

  // ---------- the count, spoken only: the page no longer prints it ----------
  const countSpoken = generating ? COPY.resultsBusySpoken : COPY.resultsCountSpoken(list.length, np);
  useAnnounceWhenStill(countSpoken, 400);

  // ---------- the grid: two per row ----------
  const ticketWidth = Math.floor((columnWidth(width) - GEN_GRID_GAP) / 2 - GEN_CARD_INSET);
  const cells = useMemo(() => {
    let fresh = 0;
    const seen = new Set<string>();
    return list.map((t, i) => {
      const key = seen.has(t.num) ? `${t.num}-${i}` : t.num;
      seen.add(t.num);
      return { t, key, printIndex: t.fresh ? fresh++ : null };
    });
  }, [list]);
  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));

  const total = ks(nt * price);

  const topBar = {
    variant: "detail" as const,
    backA11y: COPY.backA11y(book),
    onBack: () => navigation.popTo("LotteryDreamBook", { book }),
    title: { pre: DREAM_COPY.titlePre, big: book },
  };
  const footer = (
    <View style={styles.footer}>
      <LotteryFooter lines={[{ icon: "info", text: DREAM_COPY.book.footerLine }]} />
    </View>
  );

  // ---------- the dream itself: loading, failed, or not in the book ----------
  if (!dream) {
    let state;
    if (dreamQuery.isPending) {
      state = <DreamLoadingLine text={COPY.loading} />;
    } else if (isDreamNotFound(dreamQuery.error)) {
      state = (
        <LtEmpty
          title={COPY.missingTitle}
          text={COPY.missingText(book)}
          action={
            <LtButton
              variant="secondary"
              size="sm"
              icon="back"
              label={COPY.backToBook(book)}
              onPress={() => navigation.popTo("LotteryDreamBook", { book })}
            />
          }
        />
      );
    } else {
      state = (
        <DreamErrorBanner
          title={COPY.errorTitle}
          text={COPY.errorText}
          retryLabel={COPY.retry}
          onRetry={() => dreamQuery.refetch()}
        />
      );
    }
    return (
      <LotteryScreen topBar={topBar} footer={footer}>
        <View style={styles.state}>{state}</View>
      </LotteryScreen>
    );
  }

  return (
    <LotteryScreen
      topBar={topBar}
      contentStyle={styles.column}
      withBuyBar={open}
      footer={footer}
      overlay={
        open ? (
          <BuyBar
            caption={COPY.barCaption(np, drawNo)}
            walletText={balance === undefined ? undefined : COPY.barWallet(ks(balance))}
            label={np ? COPY.barBuy(nt, total) : COPY.barNone}
            accessibilityLabel={np ? COPY.barBuyA11y(nt, total, pickedNums, drawNo) : COPY.barNone}
            onPress={() => setConfirmOpen(true)}
            disabled={np === 0}
            keyboardUp={keyboardUp}
          />
        ) : null
      }
    >
      <DreamHead book={book} dream={dream} />

      <DrawLine
        draw={draw}
        status={status}
        loading={current.isPending}
        failed={current.isError}
        onRetry={() => current.refetch()}
      />

      {/* ---------- the tickets ---------- */}
      <View style={styles.results}>
        <LtText role="title" accessibilityRole="header" accessibilityLabel={COPY.ticketsTitle(spaced(dn))}>
          {COPY.ticketsTitle(dn)}
        </LtText>
        <PlaceControl book={book} number={dn} pos={cfg.pos} onPos={changePlace} style={styles.places} />

        <View style={styles.grid} accessibilityLabel={COPY.gridA11y(printOn.no)}>
          {/* Rows keyed by place, cards by number: a kept pick keeps its card (and its ticket) across rolls. */}
          {rows.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map(({ t, key, printIndex }) =>
                generating && t.fresh ? (
                  <GenTicketSkeleton key={key} ticketWidth={ticketWidth} />
                ) : (
                  <GenTicketCard
                    key={key}
                    book={book}
                    draw={printOn}
                    num={t.num}
                    pos={t.pos}
                    picked={picked.has(t.num) && pickable(t.num)}
                    off={isOff(t.num)}
                    held={heldOf(t.num)}
                    full={heldOf(t.num) >= most}
                    ticketWidth={ticketWidth}
                    printIndex={printIndex}
                    onToggle={toggle}
                  />
                ),
              )}
            </View>
          ))}
        </View>

        <GenerateButton busy={generating} onPress={again} style={styles.again} />
        <LtText role="caption" style={styles.keep}>
          {COPY.tapToPick}
        </LtText>
        <LtButton
          variant="ghost"
          size="sm"
          icon="copy"
          label={COPY.copyNumbers(np)}
          onPress={copyNumbers}
          disabled={generating}
          style={styles.copy}
        />
      </View>

      {draw ? (
        <ConfirmSheet
          visible={confirmOpen}
          onClose={onSheetClose}
          draw={draw}
          heldOf={heldOf}
          lines={lines}
          onQuantityChange={onSheetQuantity}
          onBought={onBought}
        />
      ) : null}
    </LotteryScreen>
  );
}

/**
 * The current draw on ONE line (canvas: `.lt-gline`): its sale pill, then
 * "Draw 24 · 31 Oct · 1,000 Ks a ticket". While it loads: "Loading the
 * draw…"; failed: the short error with Try again; no draw at all: one line
 * saying so. The page keeps working for picking and copying either way (the
 * buy bar only shows while the draw is open).
 */
function DrawLine({
  draw,
  status,
  loading,
  failed,
  onRetry,
}: {
  draw: DrawInfo | null;
  status: DrawStatus | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  if (!draw) {
    if (loading) {
      return (
        <LtText role="meta" color={LT.ink3} style={styles.drawLine} accessibilityLiveRegion="polite">
          {COPY.drawLoading}
        </LtText>
      );
    }
    if (failed) {
      return (
        <View style={styles.drawLine}>
          <LtText role="meta" color={LT.ink2} style={styles.drawText}>
            {COPY.drawErrorTitle}
          </LtText>
          <LtButton variant="ghost" size="sm" label={COPY.retry} onPress={onRetry} />
        </View>
      );
    }
    return (
      <LtText role="meta" color={LT.ink3} style={styles.drawLine}>
        {COPY.drawNone}
      </LtText>
    );
  }
  const date = `${dayOf(draw.dateIso)} ${monthShort(draw.dateIso)}`;
  return (
    <View style={styles.drawLine} accessible accessibilityLabel={COPY.drawLineA11y(status, draw.no, date, ks(draw.price))}>
      {status ? <StatusPill kind={status} /> : null}
      {/* Two lines at most: the Burmese line puts "per ticket" before the price, which must never be cut. */}
      <LtText role="meta" tabular numberOfLines={2} style={styles.drawText}>
        {COPY.drawLine(draw.no, date)}
        <LtText role="buttonSm" tabular>
          {ks(draw.price)}
        </LtText>
        {COPY.drawLinePrice}
      </LtText>
    </View>
  );
}

/** The quantities without these numbers (they start at 1 again if picked again). */
function forget(qtys: Readonly<Record<string, number>>, numbers: readonly string[]): Readonly<Record<string, number>> {
  if (!numbers.some((number) => number in qtys)) return qtys;
  const next = { ...qtys };
  for (const number of numbers) delete next[number];
  return next;
}

const styles = StyleSheet.create({
  /** No top padding (the dream band meets the bar), sections spaced one by one. */
  column: { paddingTop: 0, gap: 0 },
  /** While the dream loads, fails or is missing: the one state block at the top of the column. */
  state: { marginTop: 4 },
  drawLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, minHeight: 24 },
  drawText: { flex: 1, minWidth: 0 },
  results: { marginTop: 20 },
  places: { marginTop: 10 },
  grid: { gap: GEN_GRID_GAP, marginTop: 12 },
  row: { flexDirection: "row", gap: GEN_GRID_GAP },
  again: { marginTop: 16 },
  keep: { marginTop: 8, textAlign: "center" },
  copy: { alignSelf: "center", marginTop: 6 },
  /** Spare height falls below the footer, never above it (board `.lt-foot` margin-top 40). */
  footer: { marginTop: 40 },
});
