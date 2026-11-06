import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Keyboard, type ViewInstance } from "react-native";
import { useLtToast } from "@/lottery/components/LtToast";
import { announce, useScreenReaderOn } from "@/lottery/components/confirm/a11y";
import { clampQty, maxFor } from "@/lottery/components/confirm/confirmModel";
import { ks } from "@/lottery/data/format";
import { useLotterySession, type ListRow } from "@/lottery/data/session";
import { useRecentBuys } from "@/lottery/hooks/useBuyTickets";
import { DRAW_COPY } from "@/lottery/screens/draw/copy";
import { ltSentence } from "@/lottery/i18n";
import { listLine, withAdded, withQty, withRestored } from "@/lottery/screens/draw/drawState";

const L = DRAW_COPY.list;
const A = DRAW_COPY.add;
const R = DRAW_COPY.confirm.row;

/** The page's undo toast stays 8 s (held while Undo has keyboard focus; 4 s more after it leaves), like the sheet's. */
const UNDO_MS = 8000;
const UNDO_AFTER_BLUR_MS = 4000;
/** A typed quantity is read out once the typing stops, not on every key. */
const SAY_TYPED_MS = 700;
/** After Remove / Clear all / Undo: focus moves to the heading first, the polite line follows it. */
const FOCUS_MS = 120;
const SAY_AFTER_FOCUS_MS = 450;
/** How long a just-added row stays marked (ConfirmRow fades it in 1.4 s, or holds it 1.6 s with reduced motion). */
const FLASH_MS = 1600;

type TimerKey = "undo" | "say" | "typed" | "flash";

/** What Remove / Clear all took, and where: Undo puts it back in place with the quantities. */
export interface ListUndo {
  rows: ListRow[];
  at: number;
  /** Clear all ("3 numbers cleared") rather than one ×. */
  all: boolean;
  /** A new removal replays the toast's entrance. */
  id: number;
}

/** The row Add just touched (ConfirmRow's `flashKey`). */
export interface ListFlash {
  number: string;
  key: number;
}

/** The "Your numbers" card's row and head actions (stable, so typing in the window never redraws the list). */
export interface ListActions {
  onLess: (number: string) => void;
  onMore: (number: string) => void;
  onType: (number: string, text: string) => void;
  onFocus: (number: string) => void;
  onBlur: (number: string) => void;
  onRemove: (number: string) => void;
  onClearAll: () => void;
}

/** The list as it is NOW (handlers read this, not a render's copy: a blur can land just after a Remove). */
function live(): ListRow[] {
  return useLotterySession.getState().drawList;
}

/**
 * DRAW'S "YOUR NUMBERS" (multi-number Draw board, 19 Oct 2026): the shared
 * list (data/session.ts) and everything the page does to it.
 *
 *  - Add: 1 ticket (or 1 more), never above the draw's limit less what you
 *    hold; the row is marked for a moment and a toast says "047319 added ·
 *    4 numbers".
 *  - Each row: the Confirm sheet's own − qty + rules (1 to the most; at a
 *    limit the step says why; an empty box blocks Buy and is filled with 1
 *    when you leave it, or when the keyboard goes away without leaving it).
 *  - × Remove and Clear all: an undo toast for 8 s (no time-out with a
 *    screen reader on, like the sheet's); Undo puts the rows back in place.
 *    Focus goes to the "Your numbers" heading, never to a box.
 *
 * Every change is read out once, politely (the board's aria-live line).
 * The list is the page's own until Confirm buys it; nothing here calls the API.
 */
export function useNumberList({
  price,
  most,
  heldOf,
}: {
  price: number;
  /** The draw's per-number limit. */
  most: number;
  /** Tickets of a number already held for the draw (the availability answer; 0 while unknown). */
  heldOf: (number: string) => number;
}) {
  const rows = useLotterySession((s) => s.drawList);
  const setRows = useLotterySession((s) => s.setDrawList);
  const toast = useLtToast();
  const readerOn = useScreenReaderOn();
  const [undo, setUndoState] = useState<ListUndo | null>(null);
  const [flash, setFlash] = useState<ListFlash | null>(null);
  const [focusedRow, setFocusedRow] = useState<string | null>(null);
  const [focusWant, setFocusWant] = useState(0);
  const headRef = useRef<ViewInstance>(null);
  const nextId = useRef(1);
  const timers = useRef<Partial<Record<TimerKey, ReturnType<typeof setTimeout>>>>({});

  // Live copies for the handlers, which are made once.
  const undoRef = useRef<ListUndo | null>(null);
  const focusedRef = useRef<string | null>(null);
  const heldRef = useRef(heldOf);
  const mostRef = useRef(most);
  useLayoutEffect(() => {
    heldRef.current = heldOf;
    mostRef.current = most;
  }, [heldOf, most]);
  const setUndo = useCallback((next: ListUndo | null) => {
    undoRef.current = next;
    setUndoState(next);
  }, []);
  const setFocused = useCallback((number: string | null) => {
    focusedRef.current = number;
    setFocusedRow(number);
  }, []);
  const maxOf = useCallback((number: string) => maxFor(heldRef.current(number), mostRef.current), []);

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
  useEffect(() => {
    const all = timers.current;
    return () => {
      for (const key of Object.keys(all) as TimerKey[]) {
        const t = all[key];
        if (t) clearTimeout(t);
      }
    };
  }, []);

  // After Remove / Clear all / Undo the reader moves to the heading (Undo is the next stop) — never to a box,
  // so no keyboard pops up.
  useEffect(() => {
    if (!focusWant) return;
    const timer = setTimeout(() => {
      if (headRef.current) AccessibilityInfo.sendAccessibilityEvent(headRef.current, "focus");
    }, FOCUS_MS);
    return () => clearTimeout(timer);
  }, [focusWant]);

  // A step or a fill replaces a typed line still waiting; the Remove / Undo line (timer "say") is kept.
  const say = useCallback(
    (text: string) => {
      stop("typed");
      announce(text);
    },
    [stop],
  );

  // ---------- one row's quantity ----------
  const setQty = useCallback(
    (number: string, qty: number | null, how: "now" | "typed") => {
      const now = live();
      if (!now.some((r) => r.number === number)) return;
      const next = withQty(now, number, qty);
      setRows(next);
      const max = maxOf(number);
      const line =
        qty === null
          ? `${DRAW_COPY.confirm.say.empty(number, max)} ${listLine(next, price)}`
          : L.say.set(number, qty, ks(qty * price), qty >= max, listLine(next, price));
      if (how === "typed") later("typed", SAY_TYPED_MS, () => announce(line));
      else say(line);
    },
    [setRows, maxOf, price, later, say],
  );

  const onLess = useCallback(
    (number: string) => {
      const row = live().find((r) => r.number === number);
      if (!row) return;
      // The step looks and reads disabled at the limit; a tap says why instead of doing nothing silently.
      if (row.qty === null) return say(DRAW_COPY.confirm.say.empty(number, maxOf(number)));
      if (row.qty <= 1) return say(R.least);
      setQty(number, row.qty - 1, "now");
    },
    [say, maxOf, setQty],
  );
  const onMore = useCallback(
    (number: string) => {
      const row = live().find((r) => r.number === number);
      if (!row) return;
      const max = maxOf(number);
      if (row.qty !== null && row.qty >= max) return say(ltSentence(R.most));
      setQty(number, row.qty === null ? 1 : Math.min(max, row.qty + 1), "now");
    },
    [say, maxOf, setQty],
  );
  const onType = useCallback(
    (number: string, text: string) => {
      const digits = text.replace(/\D/g, "").slice(0, 2);
      setQty(number, digits ? clampQty(parseInt(digits, 10), maxOf(number)) : null, "typed");
    },
    [setQty, maxOf],
  );
  const onFocus = useCallback((number: string) => setFocused(number), [setFocused]);
  const onBlur = useCallback(
    (number: string) => {
      if (focusedRef.current === number) setFocused(null);
      // An empty box is filled with 1 when you leave it (the least you can buy).
      const row = live().find((r) => r.number === number);
      if (row && row.qty === null) setQty(number, 1, "now");
    },
    [setFocused, setQty],
  );
  // Android's back key (or the keyboard's own hide key) puts the keyboard away WITHOUT leaving the box: a
  // hidden keyboard counts as leaving, so Buy never stays blocked on a box you can no longer see is empty.
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      const number = focusedRef.current;
      if (number === null) return;
      const row = live().find((r) => r.number === number);
      if (row && row.qty === null) setQty(number, 1, "now");
    });
    return () => sub.remove();
  }, [setQty]);

  // ---------- Add ----------
  /** Add 1 ticket of `number` (or 1 more). The screen checks it can be added and empties the window. */
  const add = useCallback(
    (number: string) => {
      const now = live();
      const had = now.some((r) => r.number === number);
      const next = withAdded(now, number, maxOf(number));
      setRows(next);
      const inList = next.find((r) => r.number === number)?.qty ?? 1;
      const tail = listLine(next, price);
      const spoken = had ? A.sayMore(number, inList, tail) : A.sayNew(number, tail);
      setFlash({ number, key: nextId.current++ });
      later("flash", FLASH_MS, () => setFlash(null));
      // The page's undo toast goes first (one toast at a time): then the add is only read out.
      if (undoRef.current) announce(spoken);
      else toast.show(had ? A.toastMore(number, inList) : A.toastNew(number, next.length), { spoken });
    },
    [maxOf, setRows, price, later, toast],
  );

  // ---------- Remove, Clear all, Undo ----------
  const armUndo = useCallback(
    (next: ListUndo, line: string) => {
      setUndo(next);
      toast.hide();
      setFocusWant(next.id);
      stop("undo");
      if (!readerOn.current) later("undo", UNDO_MS, () => setUndo(null));
      later("say", SAY_AFTER_FOCUS_MS, () => announce(line));
    },
    [setUndo, toast, stop, readerOn, later],
  );
  /** A removed row's box may have had the keyboard: focus goes to the heading next, never to another box. */
  const leaveBox = useCallback(
    (removed: string | null) => {
      if (focusedRef.current === null) return;
      Keyboard.dismiss();
      if (removed === null || focusedRef.current === removed) setFocused(null);
    },
    [setFocused],
  );
  const onRemove = useCallback(
    (number: string) => {
      const now = live();
      const at = now.findIndex((r) => r.number === number);
      if (at < 0) return;
      const left = now.filter((_, k) => k !== at);
      setRows(left);
      leaveBox(number);
      armUndo({ rows: [now[at]], at, all: false, id: nextId.current++ }, L.say.removed(number, listLine(left, price)));
    },
    [setRows, leaveBox, armUndo, price],
  );
  const onClearAll = useCallback(() => {
    const now = live();
    if (!now.length) return;
    setRows([]);
    leaveBox(null);
    armUndo({ rows: now, at: 0, all: true, id: nextId.current++ }, L.say.cleared(now.length));
  }, [setRows, leaveBox, armUndo]);
  const onUndo = useCallback(() => {
    const u = undoRef.current;
    if (!u) return;
    const next = withRestored(live(), u.rows, u.at);
    stop("undo");
    setUndo(null);
    setRows(next);
    setFocusWant(nextId.current++);
    const tail = listLine(next, price);
    const line = u.all ? L.say.backAll(u.rows.length, tail) : L.say.backOne(u.rows[0].number, tail);
    later("say", SAY_AFTER_FOCUS_MS, () => announce(line));
  }, [stop, setUndo, setRows, price, later]);
  // Held while Undo has keyboard focus (a hardware keyboard / switch access); 4 s more once it leaves.
  const holdUndo = useCallback(() => stop("undo"), [stop]);
  const letUndo = useCallback(() => {
    if (undoRef.current && !readerOn.current) later("undo", UNDO_AFTER_BLUR_MS, () => setUndo(null));
  }, [readerOn, later, setUndo]);
  /** Confirm opened, or a purchase went through: the page's undo window ends. */
  const dropUndo = useCallback(() => {
    stop("undo");
    setUndo(null);
  }, [stop, setUndo]);
  // A purchase ANYWHERE (also the dream generator's) changes what you hold, so a removed row's saved quantity may
  // be over its limit now: the undo window ends. Keyed to the purchases made, not to the availability answer,
  // which changes on every Remove (the asked set shrinks) and would end the window as soon as it opened.
  const buys = useRecentBuys((s) => s.purchases.length);
  useEffect(() => {
    dropUndo();
  }, [buys, dropUndo]);

  // ---------- the Confirm sheet's side ----------
  /** A quantity changed in the sheet: the page row follows, silently (the sheet read it out). */
  const syncQty = useCallback(
    (number: string, qty: number) => {
      const now = live();
      if (now.some((r) => r.number === number)) setRows(withQty(now, number, qty));
    },
    [setRows],
  );
  /** Rows removed in the sheet leave the list when it closes (the sheet had its own Undo). */
  const removeMany = useCallback(
    (numbers: readonly string[]) => {
      if (!numbers.length) return;
      const gone = new Set(numbers);
      setRows(live().filter((r) => !gone.has(r.number)));
    },
    [setRows],
  );
  /** After a purchase: the list is empty for the next one. */
  const clear = useCallback(() => {
    setRows([]);
    dropUndo();
    stop("flash");
    setFlash(null);
  }, [setRows, dropUndo, stop]);

  const actions = useMemo<ListActions>(
    () => ({ onLess, onMore, onType, onFocus, onBlur, onRemove, onClearAll }),
    [onLess, onMore, onType, onFocus, onBlur, onRemove, onClearAll],
  );

  return {
    rows,
    undo,
    flash,
    focusedRow,
    headRef,
    actions,
    add,
    onUndo,
    holdUndo,
    letUndo,
    dropUndo,
    syncQty,
    removeMany,
    clear,
  };
}
