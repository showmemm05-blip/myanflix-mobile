import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ScrollViewInstance,
  type ViewInstance,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useReducedMotion } from "react-native-reanimated";
import { useWallet } from "@/hooks/useWallet";
import { LtButton } from "@/lottery/components/LtButton";
import { LtEmpty } from "@/lottery/components/LtEmpty";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtSheet } from "@/lottery/components/LtSheet";
import { LtText } from "@/lottery/components/LtText";
import { MonoMark, Segmented } from "@/lottery/components/Segmented";
import { LtHelp } from "@/lottery/components/Surfaces";
import { announce, useScreenReaderOn } from "@/lottery/components/confirm/a11y";
import { ConfirmRow } from "@/lottery/components/confirm/ConfirmRow";
import { UndoToast } from "@/lottery/components/confirm/UndoToast";
import {
  clampQty,
  maxFor,
  rowView,
  sayBack,
  sayRemoved,
  saySet,
  startRows,
  toLines,
  totalsOf,
  type ConfirmLine,
  type ConfirmRow as ConfirmRowState,
} from "@/lottery/components/confirm/confirmModel";
import { LT_COPY } from "@/lottery/copy";
import { purchaseItemOf } from "@/lottery/data/draws";
import { dateLong, dateShort, ks } from "@/lottery/data/format";
import type { DrawInfo, PurchaseItem } from "@/lottery/data/sample";
import { invalidateAfterPurchase, lotteryKeys } from "@/lottery/hooks/lotteryKeys";
import { buyRefusalOf, settlePurchase, useBuyTickets, type BuyRefusal } from "@/lottery/hooks/useBuyTickets";
import { useOpenWallet } from "@/lottery/navigation/useOpenWallet";
import { DRAW_COPY, speakNumbers } from "@/lottery/screens/draw/copy";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";
import { lotteryService } from "@/services/lottery.service";
import { ltSentence, ltStop } from "@/lottery/i18n";
import { uuidV4 } from "@/utils/uuid";

export type { ConfirmLine, DreamMark } from "@/lottery/components/confirm/confirmModel";

export interface ConfirmSheetProps {
  visible: boolean;
  /**
   * Closed without buying (X, scrim, drag, back key, Cancel, Choose numbers),
   * with the rows as they were left: Draw lets the removed numbers leave its
   * list (and a removed typed number leave the window); DreamTickets lets go
   * of the numbers that were removed.
   */
  onClose: (left: readonly ConfirmLine[]) => void;
  /** The draw being bought — the current draw (its number, date, price and per-number limit). */
  draw: DrawInfo;
  /** Tickets of a number this customer already holds for the draw (the page's availability answer; 0 while unknown). */
  heldOf: (number: string) => number;
  /**
   * One line per number, read when the sheet opens: Draw sends each number in
   * its list × its quantity (caption "list"), then the typed number Buy
   * included (caption "typed"); DreamTickets one line per picked number, with
   * the dream it came from (its digits are highlighted, the caption names it).
   */
  lines: readonly ConfirmLine[];
  /** A row's quantity changed (a step, a typed value, Undo, a limit the server enforced): Draw's list (or typed number) follows it. */
  onQuantityChange?: (number: string, quantity: number) => void;
  /** After the purchase went through: the purchase that stands (→ Printed, the toast counts its tickets). */
  onBought: (purchase: PurchaseItem) => void;
}

/** The undo toast stays 8 s (held while Undo has keyboard focus; 4 s more after it leaves). */
const UNDO_MS = 8000;
const UNDO_AFTER_BLUR_MS = 4000;
/** A typed quantity is read out once the typing stops, not on every key. */
const SAY_TYPED_MS = 700;
/** After Remove / Undo: focus moves first, the polite line follows it. */
const FOCUS_MS = 120;
const SAY_AFTER_FOCUS_MS = 450;
/** Bring a focused box above the keyboard once the sheet has risen. */
const SCROLL_MS = 320;

type Phase = "ready" | "processing" | "error";
type PayMethod = "kbz" | "wave";
/** "typed": a typed value's line (waits for the typing to stop); "say": the line after Remove / Undo (waits for focus). */
type TimerKey = "undo" | "say" | "typed" | "scroll";

interface Removed {
  row: ConfirmRowState;
  at: number;
  /** A new removal replays the toast's entrance. */
  id: number;
}

/**
 * What the sheet froze when it opened: the wallet and what is held (its own
 * purchase is the only thing that changes them). `balance` is null while the
 * wallet has not answered yet; it is filled in once, when it does.
 */
interface Snapshot {
  balance: number | null;
  heldOf: (number: string) => number;
}

const C = DRAW_COPY.confirm;

/**
 * CONFIRM YOUR TICKETS — v3 · COMPACT (owner, 16 Oct 2026: "it takes too much
 * space … so that user can see with quick glance"; Confirm.dc.html and the
 * sheet in Draw.dc.html). Opened by Draw (one row per number in "Your
 * numbers", "In your list", plus the typed number Buy included, "Typed, not
 * in your list"; each quantity IS the page's) and DreamTickets (one row per
 * picked number).
 *
 *  - Head, one line: "Confirm your tickets" · "Draw 24 · Sat 31 Oct" · ×.
 *  - One slim row per number (ConfirmRow): number + caption | − qty + (typing
 *    allowed) | row total | × Remove. Min 1, max = the draw's limit − what you
 *    hold. Remove takes the row out and shows "027514 removed · Undo" inside
 *    the sheet for 8 s. Every row removed: "No tickets selected" + "Choose
 *    numbers".
 *  - Summary: "3 numbers · 3 tickets" + the total; "Wallet … · After …", or
 *    "Short by …" with Deposit with KBZPay / WavePay (opens the MyanFlix
 *    wallet's deposit); "Each ticket gets its own ticket ID."
 *  - Footer: the reason line when blocked, ONE full-width "Confirm 3 tickets ·
 *    3,000 Ks", a quiet Cancel.
 *
 * Confirm sends POST /lottery/purchases (hooks/useBuyTickets) with one
 * idempotency key per opening, kept until the purchase succeeds: Try again
 * after a lost answer can never charge twice. States: ready · processing
 * (locked: no scrim, drag, X, back key, Cancel or edits; the board's "no
 * double tap") · insufficient (live: Confirm stays disabled until a quantity
 * is lowered) · error (the answer was lost: Try again) · refused (the server
 * said why — sales closed, a number off sale, a limit reached — and the sheet
 * applies it: rows removed or lowered, a plain line above the buttons). The
 * sheet freezes the wallet and what you hold when it opens, so nothing
 * flashes while it slides away.
 */
export function ConfirmSheet({ visible, onClose, draw, heldOf, lines, onQuantityChange, onBought }: ConfirmSheetProps) {
  const wallet = useWallet();
  const liveBalance = wallet.data?.balance ?? null;
  const buy = useBuyTickets();
  const queryClient = useQueryClient();
  const openWallet = useOpenWallet();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const narrow = width < 360;

  const price = draw.price;
  const most = draw.maxPerNumber;
  const drawNo = draw.no;

  // The sheet's world is the moment it opened: the wallet and what you hold. Only this sheet's own purchase
  // can change them, and it must not flash "Short by" or "That's the most" on its way out.
  const [snap, setSnap] = useState<Snapshot>(() => ({ balance: liveBalance, heldOf }));
  /** What the server said is held, when it refused a quantity: it wins over the snapshot for that number. */
  const [heldFix, setHeldFix] = useState<Readonly<Record<string, number>>>({});
  const [rows, setRows] = useState<ConfirmRowState[]>(() =>
    visible ? startRows(lines, (n) => maxFor(heldOf(n), most)) : [],
  );
  /** How many rows it opened with: one (Draw) speaks of "your number", several of "every number". */
  const [openedWith, setOpenedWith] = useState(rows.length);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const [lastRemoved, setLastRemoved] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  /** The server's reason, when it refused (the plain line above the buttons). */
  const [refusal, setRefusal] = useState<string | null>(null);
  /** Sales closed under the sheet: nothing more can be bought here. */
  const [closedBy, setClosedBy] = useState(false);
  const [method, setMethod] = useState<PayMethod>("kbz");
  const [focusedRow, setFocusedRow] = useState<string | null>(null);
  const [focusWant, setFocusWant] = useState<{ target: "head" | "empty"; id: number } | null>(null);

  const timers = useRef<Partial<Record<TimerKey, ReturnType<typeof setTimeout>>>>({});
  // With a screen reader on, the undo toast does not time out (finding Undo takes longer than 8 s by swipe).
  const readerOn = useScreenReaderOn();
  /** Set by close(): the keyboard's blur that follows must not refill an empty box (or move the page). */
  const closing = useRef(false);
  const nextId = useRef(1);
  const headRef = useRef<ViewInstance>(null);
  const emptyRef = useRef<ViewInstance>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const listY = useRef(0);
  const rowY = useRef<Record<string, number>>({});
  /**
   * One purchase per opening: the same key on every Try again, so a lost answer never charges twice. The key is
   * also kept across a close while the last answer was lost (the server may have committed it): the next Confirm
   * with the same basket replays that purchase, and a changed basket gets "already bought", settled by its ref.
   */
  const keyRef = useRef(uuidV4());
  /** The last attempt ended without an answer (phase "error"): its key must not be replaced. */
  const lost = useRef(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  /**
   * The rows as they are NOW. Handlers read this, not the render's `rows`: a blur or a keyboard event can land
   * after a Remove / step in the same moment, and a stale copy would put a removed row back.
   */
  const rowsRef = useRef(rows);
  useLayoutEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  const focusedRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    focusedRef.current = focusedRow;
  }, [focusedRow]);
  const commitRows = (next: ConfirmRowState[]) => {
    rowsRef.current = next;
    setRows(next);
  };

  const stop = useCallback((key: TimerKey) => {
    const t = timers.current[key];
    if (t) clearTimeout(t);
    timers.current[key] = undefined;
  }, []);
  const later = useCallback(
    (key: TimerKey, ms: number, run: () => void) => {
      stop(key);
      timers.current[key] = setTimeout(() => {
        timers.current[key] = undefined;
        run();
      }, ms);
    },
    [stop],
  );

  // Every opening starts fresh. Adjusted during render (React's pattern for state that follows a prop), so
  // the old rows or "Processing…" never show for a frame.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      const fresh: Snapshot = { balance: liveBalance, heldOf };
      const start = startRows(lines, (n) => maxFor(fresh.heldOf(n), most));
      setSnap(fresh);
      setHeldFix({});
      setRows(start);
      setOpenedWith(start.length);
      setRemoved(null);
      setLastRemoved(null);
      setPhase("ready");
      setRefusal(null);
      setClosedBy(false);
      setFocusedRow(null);
      setFocusWant(null);
      closing.current = false;
      if (!lost.current) keyRef.current = uuidV4();
    }
  }

  // The wallet answered after the sheet opened: the snapshot takes it once (nothing was frozen yet).
  useEffect(() => {
    if (visible && snap.balance === null && wallet.data) {
      const balance = wallet.data.balance;
      setSnap((prev) => (prev.balance === null ? { ...prev, balance } : prev));
    }
  }, [visible, snap.balance, wallet.data]);

  // Closing: the undo window and any pending line go with it (a purchase in progress keeps running).
  useEffect(() => {
    if (visible) return;
    stop("undo");
    stop("say");
    stop("typed");
    stop("scroll");
  }, [visible, stop]);

  // Unmount: every timer.
  useEffect(() => {
    const all = timers.current;
    return () => {
      for (const key of Object.keys(all) as TimerKey[]) {
        const t = all[key];
        if (t) clearTimeout(t);
      }
    };
  }, []);

  // After Remove / Undo the reader moves to the list heading (or "No tickets selected") — never to a box,
  // so no keyboard pops up.
  useEffect(() => {
    if (!focusWant) return;
    const timer = setTimeout(() => {
      const node = focusWant.target === "head" ? headRef.current : emptyRef.current;
      if (node) AccessibilityInfo.sendAccessibilityEvent(node, "focus");
    }, FOCUS_MS);
    return () => clearTimeout(timer);
  }, [focusWant]);

  const busy = phase === "processing";
  const failed = phase === "error";
  const has = rows.length > 0;
  // An unknown wallet never blocks Confirm: the server's own "not enough" refusal lands in the "short" branch
  // below with the real balance.
  const balance = snap.balance ?? Number.POSITIVE_INFINITY;
  const t = totalsOf(rows, price, balance);
  const heldNow = (number: string) => heldFix[number] ?? snap.heldOf(number);
  const maxOf = (number: string) => maxFor(heldNow(number), most);

  // A step or a fill replaces a typed line still waiting; the Remove / Undo line (timer "say") is kept.
  const say = (text: string) => {
    stop("typed");
    announce(text);
  };

  // ---------- one row's quantity ----------
  const setQty = (number: string, qty: number | null, how: "now" | "typed") => {
    if (busy) return;
    const now = rowsRef.current;
    const i = now.findIndex((row) => row.number === number);
    if (i < 0) return;
    const wasShort = totalsOf(now, price, balance).short > 0;
    const next = now.slice();
    next[i] = { ...now[i], qty, last: qty ?? now[i].last };
    commitRows(next);
    if (qty !== null) onQuantityChange?.(number, qty);
    const line = saySet({ rows: next, number, qty, max: maxOf(number), price, balance, wasShort });
    if (how === "typed") later("typed", SAY_TYPED_MS, () => announce(line));
    else say(line);
  };

  const onLess = (number: string) => {
    const row = rowsRef.current.find((r) => r.number === number);
    if (!row || busy) return;
    // The step looks and reads disabled at the limit; a tap says why instead of doing nothing silently.
    if (row.qty === null) return say(C.say.empty(number, maxOf(number)));
    if (row.qty <= 1) return say(C.row.least);
    setQty(number, row.qty - 1, "now");
  };
  const onMore = (number: string) => {
    const row = rowsRef.current.find((r) => r.number === number);
    if (!row || busy) return;
    const max = maxOf(number);
    if (row.qty !== null && row.qty >= max) return say(ltSentence(C.row.most));
    setQty(number, row.qty === null ? 1 : Math.min(max, row.qty + 1), "now");
  };
  const onType = (number: string, text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 2);
    setQty(number, digits ? clampQty(parseInt(digits, 10), maxOf(number)) : null, "typed");
  };
  const onFocusRow = (number: string) => {
    setFocusedRow(number);
    // Once the sheet has risen onto the keyboard, bring this row into the part of the body still in view.
    later("scroll", SCROLL_MS, () => {
      const y = listY.current + (rowY.current[number] ?? 0) - 8;
      scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: !reduceMotion });
    });
  };
  const onBlurRow = (number: string) => {
    setFocusedRow((current) => (current === number ? null : current));
    if (closing.current) return;
    // An empty box is filled with 1 when you leave it (the least you can buy).
    const row = rowsRef.current.find((r) => r.number === number);
    if (row && row.qty === null) setQty(number, 1, "now");
  };
  // Android's back key (or the keyboard's own hide key) puts the keyboard away WITHOUT leaving the box: the board's
  // "leaving fills 1" would never run and Confirm would stay blocked, so a hidden keyboard counts as leaving.
  const fillOnHide = useRef(() => {});
  useLayoutEffect(() => {
    fillOnHide.current = () => {
      const number = focusedRef.current;
      if (closing.current || busy || number === null) return;
      const row = rowsRef.current.find((r) => r.number === number);
      if (row && row.qty === null) setQty(number, 1, "now");
    };
  });
  useEffect(() => {
    if (!visible) return;
    const sub = Keyboard.addListener("keyboardDidHide", () => fillOnHide.current());
    return () => sub.remove();
  }, [visible]);
  const onPlaced = useCallback((number: string, y: number) => {
    rowY.current[number] = y;
  }, []);

  // ---------- Remove + Undo ----------
  const armUndo = (ms: number) => {
    stop("undo");
    if (readerOn.current) return;
    later("undo", ms, () => setRemoved(null));
  };
  const onRemove = (number: string) => {
    if (busy) return;
    const now = rowsRef.current;
    const at = now.findIndex((row) => row.number === number);
    if (at < 0) return;
    const left = now.filter((_, k) => k !== at);
    commitRows(left);
    // Its box may have had the keyboard; focus goes to the heading next, never to another box.
    if (focusedRow !== null) Keyboard.dismiss();
    setRemoved({ row: now[at], at, id: nextId.current++ });
    setLastRemoved(number);
    if (focusedRow === number) setFocusedRow(null);
    armUndo(UNDO_MS);
    setFocusWant({ target: left.length ? "head" : "empty", id: nextId.current++ });
    later("say", SAY_AFTER_FOCUS_MS, () => announce(sayRemoved(number, left, price, balance)));
  };
  const onUndo = () => {
    if (!removed || busy) return;
    const qty = removed.row.qty ?? 1;
    const back: ConfirmRowState = { ...removed.row, qty, last: qty };
    const next = rowsRef.current.slice();
    next.splice(Math.min(removed.at, next.length), 0, back);
    stop("undo");
    commitRows(next);
    setRemoved(null);
    if (removed.row.qty === null) onQuantityChange?.(back.number, qty);
    setFocusWant({ target: "head", id: nextId.current++ });
    later("say", SAY_AFTER_FOCUS_MS, () => announce(sayBack(back.number, qty, next, price, balance)));
  };
  // Held while Undo has keyboard focus (a hardware keyboard / switch access); 4 s more once it leaves.
  const holdUndo = () => stop("undo");
  const letUndo = () => {
    if (removed) armUndo(UNDO_AFTER_BLUR_MS);
  };

  // ---------- closing and buying ----------
  const close = () => {
    if (busy) return;
    closing.current = true;
    Keyboard.dismiss();
    // Closed on a lost answer: the purchase may have gone through, so the page re-reads the wallet, what is
    // held and the tickets rather than keeping a balance and a list the server no longer agrees with.
    if (failed) {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      invalidateAfterPurchase(queryClient);
    }
    onClose(toLines(rowsRef.current));
  };

  /** The server's refusal, applied to the rows: what it says is held or off sale is now the sheet's truth. */
  const applyRefusal = async (why: BuyRefusal) => {
    switch (why.kind) {
      case "closed":
      case "notFound": {
        setClosedBy(true);
        const status = why.kind === "closed" ? why.status : null;
        setRefusal(
          status === "paused"
            ? C.refused.paused(drawNo)
            : status === "scheduled"
              ? C.refused.notYet(drawNo)
              : C.refused.closed(drawNo),
        );
        // The Draw page under the sheet shows the closed card once it knows.
        queryClient.invalidateQueries({ queryKey: lotteryKeys.currentDraw });
        return;
      }
      case "alreadyBought": {
        // An earlier try went through but its answer was lost, and the rows changed since: that purchase is the one
        // that stands. Fetched by its ref and settled like any other; the rows are not charged again.
        if (why.ref) {
          try {
            const purchase = await lotteryService.getPurchase(why.ref);
            if (!mounted.current) return;
            settlePurchase(queryClient, purchase);
            setRefusal(null);
            onBought(purchaseItemOf(purchase));
            return;
          } catch {
            if (!mounted.current) return;
          }
        }
        setClosedBy(true);
        setRefusal(C.refused.alreadyBoughtLost);
        queryClient.invalidateQueries({ queryKey: ["wallet"] });
        queryClient.invalidateQueries({ queryKey: lotteryKeys.tickets });
        queryClient.invalidateQueries({ queryKey: lotteryKeys.purchases });
        return;
      }
      case "offSale": {
        const gone = new Set(why.numbers);
        const left = rowsRef.current.filter((row) => !gone.has(row.number));
        if (left.length !== rowsRef.current.length) {
          commitRows(left);
          setRemoved(null);
          setLastRemoved(why.numbers[why.numbers.length - 1] ?? null);
        }
        setRefusal(why.numbers.length ? C.refused.offSale(why.numbers) : C.refused.other(""));
        // The page's rows read the same answer: without this, a number pulled from sale could be added again.
        queryClient.invalidateQueries({ queryKey: lotteryKeys.availabilityAll });
        return;
      }
      case "limit": {
        const fix: Record<string, number> = {};
        const lowered: typeof why.items = [];
        const dropped: string[] = [];
        let next = rowsRef.current.slice();
        for (const item of why.items) {
          fix[item.number] = item.held;
          const i = next.findIndex((row) => row.number === item.number);
          if (i < 0) continue;
          if (item.left <= 0) {
            next = next.filter((row) => row.number !== item.number);
            dropped.push(item.number);
            continue;
          }
          const qty = Math.min(next[i].qty ?? next[i].last, item.left);
          if (qty !== next[i].qty) {
            next[i] = { ...next[i], qty, last: qty };
            onQuantityChange?.(item.number, qty);
          }
          lowered.push(item);
        }
        setHeldFix((prev) => ({ ...prev, ...fix }));
        commitRows(next);
        setRemoved(null);
        const parts = [
          lowered.length ? C.refused.limit(lowered) : "",
          dropped.length ? C.refused.limitNone(dropped) : "",
        ].filter(Boolean);
        setRefusal(parts.length ? parts.join(" ") : C.refused.other(""));
        // The page's rows and help line follow the server's held counts too, not the answer from before.
        queryClient.invalidateQueries({ queryKey: lotteryKeys.availabilityAll });
        return;
      }
      case "short": {
        // The sheet's own "Short by" line takes over; the wallet is re-read so the number is the server's.
        if (why.balance !== null) {
          const balance = why.balance;
          setSnap((prev) => ({ ...prev, balance }));
        }
        queryClient.invalidateQueries({ queryKey: ["wallet"] });
        setRefusal(null);
        return;
      }
      case "badNumber":
        setRefusal(C.refused.badNumber);
        return;
      default:
        setRefusal(C.refused.other(why.message));
    }
  };

  const blocked = has && !busy && (t.short > 0 || t.gaps > 0 || closedBy);
  const confirm = async () => {
    // One purchase per tap: refused while processing, when short, with an empty box, or with nothing to buy.
    if (busy || !has || t.short > 0 || t.gaps > 0 || closedBy) return;
    Keyboard.dismiss();
    stop("undo");
    setRemoved(null);
    setFocusedRow(null);
    setRefusal(null);
    setPhase("processing");
    say(C.busy(t.tickets));
    const bought = toLines(rowsRef.current);
    try {
      const purchase = await buy.mutateAsync({
        drawNo,
        idempotencyKey: keyRef.current,
        lines: bought.map((line) => ({ number: line.number, quantity: line.quantity })),
      });
      if (!mounted.current) return;
      lost.current = false;
      setPhase("ready");
      onBought(purchaseItemOf(purchase));
    } catch (err) {
      if (!mounted.current) return;
      const why = buyRefusalOf(err);
      if (!why) {
        // The answer was lost or the server failed: the rows stay as they were, with Try again (same key).
        lost.current = true;
        setPhase("error");
        return;
      }
      lost.current = false;
      setPhase("ready");
      await applyRefusal(why);
    }
  };

  const methodName = method === "kbz" ? LT_COPY.pay.kbz : LT_COPY.pay.wave;
  const deposit = () => {
    // The wallet's deposit sheet is on the MyanFlix wallet page: the rows are kept for when you come back.
    close();
    openWallet({ openDeposit: true });
  };

  // ---------- what the footer says ----------
  const several = rows.length > 1;
  const go = C.go(t.tickets, ks(t.total));
  let why: { kind: "warn" | "err"; text: string; spoken: string } | null = null;
  if (blocked && t.gaps > 0 && t.firstGap)
    why = { kind: "err", text: C.whyGap(t.firstGap), spoken: C.whyGapSpoken(t.firstGap) };
  else if (blocked && t.short > 0)
    why = { kind: "warn", text: C.whyShort(ks(t.short)), spoken: C.whyShortSpoken(ks(t.short), several) };

  const canUndo = !!removed;
  const emptyText =
    openedWith === 1 && lastRemoved ? C.emptyOne(lastRemoved, canUndo) : C.emptyAll(canUndo, drawNo);
  const head = rows.length === 1 ? C.yourNumber : C.yourNumbers;
  const shortDate = dateShort(draw.dateIso).replace(/ \d{4}$/, "");

  const header = (
    <View style={styles.head}>
      <LtText
        role="title"
        accessibilityRole="header"
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
        style={[styles.title, narrow && styles.titleNarrow]}
      >
        {C.title}
      </LtText>
      <LtText
        role="caption"
        color={LT.ink3}
        tabular
        numberOfLines={2}
        maxFontSizeMultiplier={1.3}
        style={styles.when}
        accessibilityLabel={C.whenSpoken(drawNo, dateLong(draw.dateIso))}
      >
        {C.when(drawNo, shortDate)}
      </LtText>
      <Pressable
        onPress={close}
        disabled={busy}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={C.close}
        accessibilityState={{ disabled: busy }}
        style={({ pressed }) => [styles.x, pressed && !busy && styles.xPressed]}
      >
        <LtIcon name="close" size={18} color={busy ? LT.lineStrong : LT.ink2} />
      </Pressable>
    </View>
  );

  const footer = (
    <>
      {refusal ? (
        <LtHelp kind="err" text={refusal} spoken={speakNumbers(refusal)} live style={styles.refusal} />
      ) : null}
      {why ? (
        <View style={styles.why}>
          <View style={styles.whyText} accessible accessibilityLabel={why.spoken}>
            <View style={styles.whyIcon}>
              <LtIcon name="alert" size={16} color={why.kind === "err" ? LT.err : LT.warn} />
            </View>
            <LtText role="metaB" tabular color={why.kind === "err" ? LT.err : LT.warn} style={styles.whyLabel}>
              {why.text}
            </LtText>
          </View>
          {t.short > 0 ? (
            <LtButton variant="secondary" size="sm" label={C.deposit(methodName)} onPress={deposit} />
          ) : null}
        </View>
      ) : null}
      {!has ? (
        <LtButton variant="primary" size="block" label={C.chooseNumbers} onPress={close} />
      ) : busy ? (
        <LtButton variant="primary" size="block" label={go} onPress={confirm} busy />
      ) : failed && !blocked ? (
        <LtButton variant="primary" size="block" icon="rotate" label={C.retry(t.tickets, ks(t.total))} onPress={confirm} />
      ) : (
        <LtButton
          variant="primary"
          size="block"
          label={go}
          onPress={confirm}
          disabled={blocked}
          accessibilityHint={why?.spoken ?? (closedBy && refusal ? refusal : undefined)}
        />
      )}
      {has ? <QuietButton label={C.cancel} onPress={close} disabled={busy} /> : null}
    </>
  );

  // Not live: the polite line already said "… removed. Undo is just above the buttons."
  const undoToast =
    visible && removed && !busy ? (
      <UndoToast
        key={removed.id}
        text={C.removed(removed.row.number)}
        spoken={speakNumbers(C.removed(removed.row.number))}
        undoLabel={C.undoSpoken(removed.row.number)}
        onUndo={onUndo}
        onFocus={holdUndo}
        onBlur={letUndo}
      />
    ) : null;

  return (
    <LtSheet
      visible={visible}
      onClose={close}
      title={C.title}
      closeLabel={C.closeA11y}
      dismissible={!busy}
      header={header}
      bodyStyle={styles.body}
      footer={footer}
      footerLayout="stack"
      footerOverlay={undoToast}
      keyboardAware
      scrollRef={scrollRef}
    >
      {failed && has ? <ErrorBanner /> : null}

      {has ? (
        <>
          <View ref={headRef} style={styles.numLabel} accessible accessibilityRole="header" accessibilityLabel={head}>
            <LtText role="kicker">{head}</LtText>
          </View>

          <View
            style={styles.list}
            onLayout={(event) => {
              listY.current = event.nativeEvent.layout.y;
            }}
          >
            {rows.map((row, i) => (
              <ConfirmRow
                key={row.number}
                number={row.number}
                view={rowView(row, heldNow(row.number), maxOf(row.number), price, busy)}
                busy={busy}
                focused={focusedRow === row.number}
                narrow={narrow}
                divided={i > 0}
                onLess={onLess}
                onMore={onMore}
                onType={onType}
                onFocus={onFocusRow}
                onBlur={onBlurRow}
                onRemove={onRemove}
                onPlaced={onPlaced}
              />
            ))}
          </View>

          <Summary
            numbers={t.numbers}
            tickets={t.tickets}
            total={t.total}
            balance={snap.balance}
            short={t.short}
            method={method}
            onMethod={setMethod}
          />
        </>
      ) : (
        // Every row removed: one stop that reads the title and the reason; "Choose numbers" is in the footer.
        <View
          ref={emptyRef}
          accessible
          accessibilityLabel={`${C.emptyTitle}${ltStop()} ${speakNumbers(emptyText)}`}
          style={styles.emptyWrap}
        >
          <LtEmpty title={C.emptyTitle} text={emptyText} style={styles.empty} />
        </View>
      )}

      {busy ? <LtHelp kind="info" text={C.busy(t.tickets)} style={styles.busy} /> : null}
    </LtSheet>
  );
}

/**
 * The summary (`.lt-cs__sum`): "3 numbers · 3 tickets" + Total in Literata 22,
 * then "Wallet … / After …" — or "Short by …" in warn with "Deposit with"
 * KBZPay | WavePay — then the ticket-ID caption.
 */
function Summary({
  numbers,
  tickets,
  total,
  balance,
  short,
  method,
  onMethod,
}: {
  numbers: number;
  tickets: number;
  total: number;
  /** null while the wallet has not answered: the lines show "—" and nothing is called short. */
  balance: number | null;
  short: number;
  method: PayMethod;
  onMethod: (method: PayMethod) => void;
}) {
  const walletText = balance === null ? C.walletUnknown : ks(balance);
  const afterText = balance === null ? C.walletUnknown : ks(balance - total);
  const walletSpoken =
    balance === null
      ? C.walletUnknownSpoken
      : short
        ? `${C.wallet} ${ks(balance)}${ltStop()} ${C.shortBy} ${ks(short)}${ltStop()}`
        : `${C.wallet} ${ks(balance)}${ltStop()} ${C.afterSpoken} ${ks(balance - total)}${ltStop()}`;
  return (
    <View style={styles.sum}>
      <View style={styles.sumRow} accessible accessibilityLabel={C.countSpoken(numbers, tickets, ks(total))}>
        <LtText role="micro" color={LT.ink2} tabular>
          {C.count(numbers, tickets)}
        </LtText>
        <View style={styles.totalBox}>
          <LtText role="micro" color={LT.ink3}>
            {C.total}
          </LtText>
          <LtText role="h" maxFontSizeMultiplier={1.3} style={styles.totalValue}>
            {ks(total)}
          </LtText>
        </View>
      </View>

      <View style={styles.walRow} accessible accessibilityLabel={walletSpoken}>
        <LtText role="caption" color={LT.ink3} tabular>
          {`${C.wallet} `}
          <LtText role="micro" color={LT.ink2} tabular>
            {walletText}
          </LtText>
        </LtText>
        {short ? (
          <LtText role="microB" color={LT.warn} tabular>
            {`${C.shortBy} ${ks(short)}`}
          </LtText>
        ) : (
          <LtText role="caption" color={LT.ink3} tabular>
            {`${C.after} `}
            <LtText role="micro" color={LT.ink2} tabular>
              {afterText}
            </LtText>
          </LtText>
        )}
      </View>

      {short ? (
        <View style={styles.dep}>
          <LtText role="micro" color={LT.ink2} style={styles.depLabel}>
            {C.depositWith}
          </LtText>
          <Segmented<PayMethod>
            accessibilityLabel={C.depositWith}
            value={method}
            onChange={onMethod}
            options={[
              { key: "kbz", label: LT_COPY.pay.kbz, lead: <MonoMark letter="K" /> },
              { key: "wave", label: LT_COPY.pay.wave, lead: <MonoMark letter="W" /> },
            ]}
            style={styles.segmented}
          />
        </View>
      ) : null}

      <View style={styles.idNote}>
        <LtIcon name="tickets" size={12} strokeWidth={2} color={LT.ink3} />
        <LtText role="caption" color={LT.ink3} style={styles.idText}>
          {C.idNote}
        </LtText>
      </View>
    </View>
  );
}

/** The quiet Cancel under Confirm (`.lt-cs__cancel`): no fill, ink-2 bold 14, 44 tall. */
function QuietButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.quiet, pressed && !disabled && styles.quietPressed]}
    >
      <LtText role="buttonSm" color={disabled ? LT.ink3 : LT.ink2}>
        {label}
      </LtText>
    </Pressable>
  );
}

/** The error banner (lt-base 6.13 `lt-banner`): err tint, alert icon, a bold title and one line. */
function ErrorBanner() {
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <LtIcon name="alert" size={20} color={LT.err} />
      <View style={styles.bannerBody}>
        <LtText role="buttonSm" color={LT.err}>
          {C.errorTitle}
        </LtText>
        <LtText role="meta" color={LT.ink2}>
          {C.errorBody}
        </LtText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** One line: title · draw · × (`.lt-cs__head`: min 48, padding 2 6 2 16). */
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    paddingVertical: 2,
    paddingLeft: 16,
    paddingRight: 6,
  },
  /** Literata 600 19/24 (17/22 under 360). */
  title: { flexShrink: 1, fontSize: 19, lineHeight: 24 },
  titleNarrow: { fontSize: 17, lineHeight: 22 },
  when: { flex: 1, minWidth: 0, textAlign: "right" },
  /** A 36 round ×, 44 to the finger. */
  x: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  xPressed: { backgroundColor: LT.cream2 },
  /** `.lt-cs .lt-sheet__body`: 0 16 12. */
  body: { paddingTop: 0, paddingBottom: 12 },
  numLabel: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 24 },
  list: { marginTop: 4, borderTopWidth: 1, borderBottomWidth: 1, borderColor: LT.line },
  sum: { marginTop: 10 },
  sumRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  totalBox: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  /** Literata 700 22/28. */
  totalValue: { fontSize: 22, lineHeight: 28 },
  walRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 2 },
  dep: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  depLabel: { flexShrink: 0 },
  segmented: { flex: 1, minWidth: 0, gap: 3, padding: 3 },
  idNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  /** 11/14. */
  idText: { flexShrink: 1, fontSize: 11, lineHeight: 14 },
  emptyWrap: { marginTop: 8 },
  /** `.lt-cs .lt-empty`: 20 16, no shadow. */
  empty: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 16, boxShadow: [] },
  busy: { marginTop: 8 },
  /** The server's reason, above the blocked line and the buttons. */
  refusal: { marginBottom: 8 },
  /** The reason line when blocked: 44 tall, the Deposit button beside it. */
  why: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 44,
    marginBottom: 4,
  },
  whyText: { flexDirection: "row", alignItems: "flex-start", gap: 6, flexShrink: 1, minWidth: 0 },
  /** The icon sits on the 20pt line's middle (board svg margin-top 2). */
  whyIcon: { marginTop: 2 },
  whyLabel: { flexShrink: 1 },
  quiet: {
    height: 44,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: LT_RADIUS.button,
  },
  quietPressed: { backgroundColor: LT.cream2 },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 4,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: LT.errTint,
    borderWidth: 1,
    borderColor: LT.errLine,
    borderRadius: LT_RADIUS.button,
  },
  bannerBody: { flex: 1, minWidth: 0 },
});
