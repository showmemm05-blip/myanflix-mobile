import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Keyboard, StyleSheet, View, type TextInputInstance, type ViewInstance } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useWallet } from "@/hooks/useWallet";
import { BuyBar } from "@/lottery/components/BuyBar";
import { ConfirmSheet, type ConfirmLine } from "@/lottery/components/ConfirmSheet";
import { DrawCard } from "@/lottery/components/DrawCard";
import { LotteryFooter } from "@/lottery/components/LotteryFooter";
import { LotteryScreen } from "@/lottery/components/LotteryScreen";
import { LtButton } from "@/lottery/components/LtButton";
import { useLtToast } from "@/lottery/components/LtToast";
import { focusEntry } from "@/lottery/components/numberEntry";
import { TicketInput } from "@/lottery/components/ticket/TicketInput";
import { LT_COPY } from "@/lottery/copy";
import { saleStatus } from "@/lottery/data/draws";
import { ks } from "@/lottery/data/format";
import type { PurchaseItem } from "@/lottery/data/sample";
import { useLotterySession } from "@/lottery/data/session";
import { useAvailability } from "@/lottery/hooks/useAvailability";
import { useCurrentDraw, useLotteryNow } from "@/lottery/hooks/useCurrentDraw";
import { useKeyboardShown } from "@/lottery/hooks/useKeyboardShown";
import type { LotteryDrawScreenProps } from "@/lottery/navigation/types";
import { DRAW_COPY } from "@/lottery/screens/draw/copy";
import { cleanNumber, drawView, LIST_MAX_NUMBERS, quickPick } from "@/lottery/screens/draw/drawState";
import { DrawCardSkeleton, DrawErrorBanner, NoDrawYet } from "@/lottery/screens/draw/DrawStates";
import { ListCard, ListUndoToast } from "@/lottery/screens/draw/ListCard";
import { takeNumberFocusRequest } from "@/lottery/screens/draw/numberFocus";
import { useNumberList } from "@/lottery/screens/draw/useNumberList";
import { DreamLoadingLine } from "@/lottery/screens/dreams/DreamStates";

/** Let the pop back from Printed (or the Confirm sheet's 200ms exit) settle before the keyboard comes up. */
const REFOCUS_DELAY_MS = 350;

/** The buy bar's caption may wrap to two lines ("3 numbers + 047319 typed · Draw 24" beside the wallet). */
const BAR_CAPTION_LINES = 2;

/** The Draw page checks the close time this often (the countdown it shows only needs the minute). */
const CLOCK_TICK_MS = 15_000;

/** No draw at all: nothing is on sale, nothing is held. */
const NO_DRAW_NUMBERS: readonly string[] = [];

/**
 * CURRENT DRAW (Draw.dc.html, type-on-the-ticket board of 22 Oct 2026) — the
 * Draw tab's root. Top to bottom:
 *
 *  1. The one draw card (DrawCard, the draw on sale from
 *     GET /lottery/draws/current) with the number part: "Your six-digit
 *     number", typed ON the Thai-style ticket (TicketInput: the draw's own
 *     print is live, its number slot is the one real input, and the ticket
 *     ID, barcode, code and QR print as ghosts under "Printed after
 *     purchase"), its help line (tap to type / N of 6 / checking / ready,
 *     what you already hold, already in your list, at the most / not on sale
 *     / a dropped letter — "held" and "not on sale" are the draw's answer for
 *     the number, POST …/availability), Quick pick and Clear, then the
 *     full-width "Add 047319 to your list" (indigo secondary; seal red stays
 *     on the buy bar). Add — or Return on the ticket — puts the number in
 *     "Your numbers" (1 ticket, or 1 more), empties the ticket and keeps it
 *     focused, so the keyboard stays up for the next.
 *  2. "Your numbers" (ListCard; it replaced "How many tickets"): the shared
 *     list (data/session.ts) — the Confirm sheet's own rows, Clear all, the
 *     total and the wallet line; × and Clear all give an 8 s Undo
 *     (ListUndoToast, under the top bar).
 *  3. The footer — then the floating buy bar above the dock. It buys the
 *     whole list plus a complete, buyable number still on the ticket that is
 *     not in the list (1 ticket, named: "3 numbers + 047319 typed · Draw 24"),
 *     so type → Buy still works with no extra tap. While typing, the dock
 *     steps aside and the bar drops into its place (useKeyboardShown); the
 *     number block (label, ticket, help line, tools, Add — `blockRef`, the
 *     shell's `keyboardBlock`) is scrolled whole above the bar when the
 *     ticket takes focus and when the number is complete, so the bar never
 *     covers "Add … to your list" (owner, 23 Oct 2026).
 *
 * Buy opens the Confirm sheet (v3 · compact): one row per list number ("In
 * your list"), then the typed number ("Typed, not in your list"). Each
 * quantity changed there IS the list's (or the typed number's, kept while
 * the window holds that number); rows removed there leave the list — and a
 * removed typed number leaves the window — when the sheet closes. A finished
 * purchase (POST /lottery/purchases, one wallet debit) empties the list and
 * the window, pushes Printed in this tab and toasts "6 tickets bought for
 * Draw 24.".
 *
 * The list starts empty and so does the ticket (owner, 2026-10-23: no number
 * filled in before the customer types one);
 * Home's "Buy this number" hands a number in through `route.params.number`,
 * which is read once and cleared. Not on sale (paused, closed, not yet
 * open): the card shows the reason and "See your tickets", with no number
 * part, Add, list or buy bar. While the draw loads the card is a
 * skeleton; if it fails, Try again; no draw at all: "No draw yet".
 */
export function LotteryDrawScreen({ navigation, route }: LotteryDrawScreenProps<"LotteryDraw">) {
  const current = useCurrentDraw();
  const draw = current.data?.info ?? null;
  const nowMs = useLotteryNow(CLOCK_TICK_MS);
  const status = draw ? saleStatus(draw, nowMs) : null;
  const open = status === "open";
  const drawNo = draw?.no ?? 0;
  const price = draw?.price ?? 0;
  const most = draw?.maxPerNumber ?? 1;
  const wallet = useWallet();
  const balance = wallet.data?.balance ?? null;

  // Empty, unless a number was handed in (Home's "Buy this number", a dream pick).
  const [digits, setDigits] = useState<string>(() => {
    const handed = route.params?.number;
    return handed === undefined ? "" : cleanNumber(handed);
  });
  const [dropped, setDropped] = useState(false);
  /** The typed number's tickets when Buy includes it: 1, unless Confirm changed it (back to 1 with every window change). */
  const [typedQty, setTypedQty] = useState(1);
  /**
   * Add or a purchase just emptied the window: its "No digits yet." stays quiet
   * (the toast already said what happened, and a second polite line would cut
   * it off on iOS). Any next change to the window speaks again.
   */
  const [quietEmpty, setQuietEmpty] = useState(false);
  const [popKey, setPopKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // What Confirm opens with (the sheet keeps its own rows from there, and reports
  // each quantity back through onQuantityChange).
  const [confirmLines, setConfirmLines] = useState<readonly ConfirmLine[]>(NO_LINES);
  const inputRef = useRef<TextInputInstance>(null);
  const buyRef = useRef<ViewInstance>(null);
  /** The number block the keyboard lift keeps whole above the buy bar. */
  const blockRef = useRef<ViewInstance>(null);
  const refocusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (refocusTimer.current) clearTimeout(refocusTimer.current);
    },
    [],
  );

  const keyboardUp = useKeyboardShown();
  const toast = useLtToast();

  // The list is read before the availability ask, so its numbers are always in the asked set.
  const listRows = useLotterySession((s) => s.drawList);
  const asked = useMemo(() => {
    if (!open) return NO_DRAW_NUMBERS;
    const numbers = listRows.map((row) => row.number);
    // A full list is not asked about a new number: it could not be added, and the ask takes at most LIST_MAX_NUMBERS.
    if (digits.length === 6 && (numbers.length < LIST_MAX_NUMBERS || numbers.includes(digits))) numbers.push(digits);
    return numbers;
  }, [open, listRows, digits]);
  const availability = useAvailability(open ? drawNo : null, asked);
  const availabilityOf = availability.of;
  // Stable while the draw's answer does not change, so the memo'd list card does not redraw while you type.
  const heldOf = useCallback((number: string) => availabilityOf(number)?.held ?? 0, [availabilityOf]);
  const list = useNumberList({ price, most, heldOf });
  const { add: addToList, syncQty, removeMany, clear: clearList, dropUndo } = list;

  const view = drawView({
    drawNo,
    digits,
    dropped,
    availabilityOf,
    list: list.rows,
    typedQty,
    price,
    most,
    balance,
  });

  /** Every change to the window goes through here: a new number in it starts again at 1 ticket. */
  const setWindow = useCallback((next: string, wasDropped = false) => {
    setDigits(next);
    setDropped(wasDropped);
    setTypedQty(1);
    setQuietEmpty(false);
  }, []);

  // Home's "Buy this number": take the number once, then clear the param so a later visit starts from the form as left.
  const prefill = route.params?.number;
  useEffect(() => {
    if (prefill === undefined) return;
    setWindow(cleanNumber(prefill));
    navigation.setParams({ number: undefined });
  }, [prefill, navigation, setWindow]);

  // Printed's "Buy another number": back here with the number window focused, as on the board.
  useFocusEffect(
    useCallback(() => {
      if (!takeNumberFocusRequest()) return;
      const timer = setTimeout(() => focusEntry(inputRef.current), REFOCUS_DELAY_MS);
      return () => clearTimeout(timer);
    }, []),
  );

  const refocusSoon = () => {
    if (refocusTimer.current) clearTimeout(refocusTimer.current);
    refocusTimer.current = setTimeout(() => {
      refocusTimer.current = null;
      focusEntry(inputRef.current);
    }, REFOCUS_DELAY_MS);
  };

  /** A screen reader goes to Buy (the board's focus after Confirm closes with rows left). The keyboard stays down. */
  const focusBuySoon = () => {
    if (refocusTimer.current) clearTimeout(refocusTimer.current);
    refocusTimer.current = setTimeout(() => {
      refocusTimer.current = null;
      AccessibilityInfo.isScreenReaderEnabled().then((on) => {
        if (on && buyRef.current) AccessibilityInfo.sendAccessibilityEvent(buyRef.current, "focus");
      });
    }, REFOCUS_DELAY_MS);
  };

  const onNumber = useCallback(
    (next: string, info: { dropped: boolean }) => setWindow(next, info.dropped),
    [setWindow],
  );

  const onQuickPick = () => {
    // Never a number already in your list (the draw says whether it is on sale once it is in the window).
    const rows = list.rows;
    setWindow(quickPick((number) => rows.some((row) => row.number === number)));
    // All six land at once: pop them in a row, as the board does.
    setPopKey((k) => k + 1);
  };

  // Home's Random tile: one Quick pick on arrival, then the param is cleared so a later visit starts from the form as left.
  const wantsQuickPick = route.params?.quickPick;
  useEffect(() => {
    if (!wantsQuickPick) return;
    navigation.setParams({ quickPick: undefined });
    onQuickPick();
    // Once per request; the pick reads the list as it stands at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsQuickPick]);

  const onClear = () => {
    setWindow("");
    focusEntry(inputRef.current);
  };

  // ---------- Add to list ----------
  const onAdd = () => {
    if (!view.canAdd) return;
    addToList(digits);
    setWindow("");
    setQuietEmpty(true);
    // The window keeps (or takes) the focus, so the keyboard stays up for the next number.
    focusEntry(inputRef.current);
  };

  // ---------- Buy → Confirm ----------
  const openConfirm = () => {
    if (!view.buy.ready) return;
    Keyboard.dismiss();
    // Confirm has its own Remove + Undo: the page's undo window ends here.
    dropUndo();
    const lines: ConfirmLine[] = list.rows.map((row) => ({
      number: row.number,
      quantity: row.qty ?? row.last,
      caption: "list",
    }));
    if (view.typedIn) lines.push({ number: digits, quantity: typedQty, caption: "typed" });
    setConfirmLines(lines);
    setConfirmOpen(true);
  };

  // Return / Enter in the window: add the number; with an empty window and something to buy, open Confirm.
  const onSubmit = () => {
    if (view.canAdd) return onAdd();
    if (!digits.length && view.buy.ready) return openConfirm();
    // Nothing for Return to do (part of a number, off sale, at the most): the keyboard goes away.
    Keyboard.dismiss();
  };

  // A row's quantity changed in the sheet: the list follows it, or — the typed row — the typed number's tickets.
  const onSheetQuantity = useCallback(
    (number: string, next: number) => {
      const line = confirmLines.find((l) => l.number === number);
      if (line?.caption === "typed") setTypedQty(next);
      else syncQty(number, next);
    },
    [confirmLines, syncQty],
  );

  const onSheetClose = (left: readonly ConfirmLine[]) => {
    setConfirmOpen(false);
    const kept = new Set(left.map((line) => line.number));
    const gone = confirmLines.filter((line) => !kept.has(line.number));
    // Rows removed in the sheet leave the list now (the sheet had its own Undo).
    removeMany(gone.filter((line) => line.caption === "list").map((line) => line.number));
    // A removed typed number leaves the window too.
    if (gone.some((line) => line.caption === "typed")) setWindow("");
    // Nothing left to buy: the window takes focus for a new number. Rows left: a screen reader goes to Buy.
    if (!left.length) refocusSoon();
    else focusBuySoon();
  };

  const onBought = (purchase: PurchaseItem) => {
    // Counted from the purchase that stands, not from the rows at the last tap: a lost answer settled by its ref
    // may have been for an earlier basket.
    const count = purchase.ticketIds.length;
    setConfirmOpen(false);
    // The bought numbers are gone from the list; a row removed in the sheet goes too: the list starts again.
    clearList();
    setWindow("");
    // The emptied window stays quiet, so its "No digits yet." cannot cut off the purchase toast.
    setQuietEmpty(true);
    toast.show(DRAW_COPY.bought(count, purchase.drawNo));
    navigation.navigate("LotteryPrinted", { purchaseId: purchase.ref });
  };

  const seeTickets = () => navigation.navigate("LotteryTicketsTab", { screen: "LotteryTickets", pop: true });
  const footer = <LotteryFooter />;

  // ---------- the draw itself: loading, failed, or none yet ----------
  if (!draw || !status) {
    let state;
    if (current.isPending) {
      state = (
        <>
          <DreamLoadingLine text={LT_COPY.draw.loading} />
          <DrawCardSkeleton style={styles.skeleton} />
        </>
      );
    } else if (current.isError) {
      state = <DrawErrorBanner onRetry={() => current.refetch()} />;
    } else {
      state = <NoDrawYet action={{ label: DRAW_COPY.seeTickets, onPress: seeTickets }} />;
    }
    return (
      <LotteryScreen topBar={{ variant: "root" }} footer={footer}>
        <View>{state}</View>
      </LotteryScreen>
    );
  }

  return (
    <>
      <LotteryScreen
        topBar={{ variant: "root" }}
        withBuyBar={open}
        // The bar's caption can take two lines: 16 more clear above it (the board's rule).
        contentStyle={open ? styles.barCaptionClear : undefined}
        keyboardBlock={blockRef}
        footer={footer}
        overlay={
          open ? (
            <>
              <BuyBar
                caption={view.barCaption.text}
                captionA11y={view.barCaption.spoken}
                captionLines={BAR_CAPTION_LINES}
                walletText={balance === null ? undefined : DRAW_COPY.bar.wallet(ks(balance))}
                label={view.barLabel}
                onPress={openConfirm}
                disabled={!view.buy.ready}
                keyboardUp={keyboardUp}
                buyRef={buyRef}
              />
              <ListUndoToast
                undo={list.undo}
                onUndo={list.onUndo}
                onFocus={list.holdUndo}
                onBlur={list.letUndo}
              />
            </>
          ) : undefined
        }
      >
        <DrawCard
          draw={draw}
          status={status}
          nowMs={nowMs}
          action={
            open ? undefined : (
              <LtButton
                variant="secondary"
                size="block"
                label={DRAW_COPY.seeTickets}
                iconRight="next"
                onPress={seeTickets}
              />
            )
          }
        >
          {/* One measured block: the lift lands its bottom (the Add row) just above the buy bar. */}
          <View ref={blockRef}>
            <TicketInput
              draw={draw}
              label={DRAW_COPY.numberLabel}
              value={digits}
              onChange={onNumber}
              state={view.windowState}
              help={view.numberHelp}
              popKey={popKey}
              inputRef={inputRef}
              onSubmitEditing={onSubmit}
              emptySpoken={quietEmpty ? "" : undefined}
            />
            <View style={styles.tools}>
              <LtButton variant="secondary" size="sm" icon="dice" label={DRAW_COPY.quickPick} onPress={onQuickPick} />
              <LtButton
                variant="ghost"
                size="sm"
                label={DRAW_COPY.clear}
                accessibilityLabel={DRAW_COPY.clearA11y}
                onPress={onClear}
                disabled={!digits.length}
              />
            </View>
            {/* Add to list: indigo secondary, 48 tall, full width; it names the number it adds. */}
            <LtButton
              variant="secondary"
              tone="indigo"
              size="md"
              icon="plus"
              iconSize={18}
              label={view.add.label}
              accessibilityLabel={view.add.spoken}
              accessibilityHint={view.numberHelp.spoken}
              onPress={onAdd}
              disabled={!view.canAdd}
              style={styles.add}
            />
          </View>
        </DrawCard>

        {open ? (
          <ListCard
            rows={list.rows}
            price={price}
            most={most}
            balance={balance}
            heldOf={heldOf}
            focusedRow={list.focusedRow}
            flash={list.flash}
            headRef={list.headRef}
            actions={list.actions}
            undo={list.undo}
            onUndo={list.onUndo}
          />
        ) : null}
      </LotteryScreen>

      <ConfirmSheet
        visible={confirmOpen}
        onClose={onSheetClose}
        draw={draw}
        heldOf={heldOf}
        lines={confirmLines}
        onQuantityChange={onSheetQuantity}
        onBought={onBought}
      />
    </>
  );
}

/** Before the first Buy: nothing to confirm (the sheet is not mounted until it opens). */
const NO_LINES: readonly ConfirmLine[] = [];

const styles = StyleSheet.create({
  tools: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  /** `.lt-add`: the card's full width, 48 tall, 12 under the tools. */
  add: { alignSelf: "stretch", marginTop: 12 },
  barCaptionClear: { paddingBottom: 16 },
  skeleton: { marginTop: 12 },
});
