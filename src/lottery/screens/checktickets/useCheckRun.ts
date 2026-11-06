import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { PRIZE_GROUP_COUNT } from "@/lottery/data/prizes";
import { announce, CK_TIME, ckTick } from "@/lottery/screens/checktickets/checkKit";
import { CHECK_COPY } from "@/lottery/screens/checktickets/copy";

const C = CHECK_COPY;

/** The three steps of a number being checked: nine groups · "Almost there…" · the panel turning away. */
export type ScanPhase = "scan" | "almost" | "flip";
/** What one card's result panel shows. */
export type RowPhase = "idle" | "queued" | ScanPhase | "done";

/** One card = one number (a pile is checked as one). */
export interface CheckEntry {
  key: string;
  number: string;
  won: boolean;
  /** What the screen reader hears when the result shows: "0 5 8 3 1 4: won 1st prize, 60,000,000 Ks." */
  live: string;
}

export interface RunState {
  /** The card being checked (it stays set through the pause after its result). */
  cur: string | null;
  phase: ScanPhase | null;
  /** The prize group being checked, 0–8. */
  step: number;
  done: Readonly<Record<string, boolean>>;
  /**
   * Revealed by the animated check (not by Skip or reduced motion): plays the flip, pop, marks, count-up and
   * confetti. Skip / reduced motion / leaving the page clear it, so nothing keeps moving after them.
   */
  fresh: Readonly<Record<string, boolean>>;
  /** Cards still to check in this run, in order ("Waiting its turn…"). */
  queue: readonly string[];
  /** A "Check all" run is going (the big button is busy). */
  all: boolean;
  /** The summary appeared at the end of an animated run: its total counts up. */
  sumFresh: boolean;
}

type Action =
  | { type: "start"; key: string; queue: readonly string[]; all: boolean; reset: boolean }
  | { type: "step"; step: number }
  | { type: "phase"; phase: ScanPhase }
  | { type: "reveal"; key: string }
  | { type: "gap" }
  | { type: "end"; summary: boolean }
  | { type: "instant"; keys: readonly string[] };

const INITIAL: RunState = {
  cur: null,
  phase: null,
  step: 0,
  done: {},
  fresh: {},
  queue: [],
  all: false,
  sumFresh: false,
};

function reducer(s: RunState, a: Action): RunState {
  switch (a.type) {
    case "start":
      return {
        ...s,
        cur: a.key,
        phase: "scan",
        step: 0,
        queue: a.queue,
        all: a.all,
        sumFresh: false,
        done: a.reset ? {} : s.done,
        fresh: a.reset ? {} : s.fresh,
      };
    case "step":
      return { ...s, step: a.step };
    case "phase":
      return { ...s, phase: a.phase, step: PRIZE_GROUP_COUNT - 1 };
    case "reveal":
      return { ...s, phase: null, done: { ...s.done, [a.key]: true }, fresh: { ...s.fresh, [a.key]: true } };
    // The 0.4 s between two numbers: the next one keeps "Waiting its turn…" (it is still first in the queue).
    case "gap":
      return { ...s, cur: null, phase: null };
    case "end":
      return { ...s, cur: null, phase: null, queue: [], all: false, sumFresh: a.summary };
    // Skip, reduced motion or leaving the page: every result at once. `fresh` is cleared too (the board's
    // skip sets anim / cu / fx to {}), so a reveal still in flight settles at once: the count-up jumps to
    // its total, the confetti goes, the Won pill and the gold marks stand still.
    case "instant": {
      const done = { ...s.done };
      for (const k of a.keys) done[k] = true;
      return { ...s, cur: null, phase: null, step: 0, queue: [], all: false, done, fresh: {}, sumFresh: false };
    }
  }
}

/** Where the screen reader should go next: a card's result panel, or the summary. */
export interface FocusRequest {
  target: { kind: "panel"; key: string } | { kind: "sum" };
  /** Bumps on every request, so asking for the same place twice still moves focus. */
  n: number;
}

export interface CheckRun {
  state: RunState;
  phaseOf: (key: string) => RowPhase;
  /** Something is being checked (or a Check all run is between numbers): every Check is disabled. */
  running: boolean;
  allDone: boolean;
  /** The summary shows once every card is checked and nothing is mid-reveal. */
  sumShow: boolean;
  /** Tickets not checked yet ("Check the other tickets (N)"). */
  ticketsLeft: number;
  focus: FocusRequest | null;
  checkAll: () => void;
  checkOne: (key: string) => void;
  skip: () => void;
  again: () => void;
  /** Leaving the page mid-check: the cards of this run show their results at once, silently (no ticks off-screen). */
  settle: () => void;
}

/**
 * THE REVEAL'S CLOCK (CheckTickets.dc.html script, step for step). One number
 * at a time, about 4–5 s: the nine prize groups in 3 s, "Almost there…" for
 * 0.5 s, the panel turns away and comes back with the result; Check all runs
 * the cards one after another, 0.4 s apart, then the summary. Skip shows every
 * result at once. `instant` (reduced motion) = every result at once, nothing
 * moves, nothing vibrates.
 *
 * Every pending step is one timer in a list, so Skip, Watch again or leaving
 * the screen clears them all; nothing runs after unmount.
 */
export function useCheckRun(
  entries: readonly CheckEntry[],
  counts: Readonly<Record<string, number>>,
  { instant, summaryLive }: { instant: boolean; summaryLive: string },
): CheckRun {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [focus, setFocus] = useState<FocusRequest | null>(null);

  // Timers and taps read the newest state and props through refs (a timer set 4 s ago must not see a stale list).
  // `send` runs the same pure reducer on the ref at once, so a second tap in the same frame already sees the run
  // started and is ignored (no double run before React renders).
  const stateRef = useRef(state);
  const send = useCallback((action: Action) => {
    stateRef.current = reducer(stateRef.current, action);
    dispatch(action);
  }, []);
  const entriesRef = useRef(entries);
  const summaryRef = useRef(summaryLive);
  useEffect(() => {
    entriesRef.current = entries;
    summaryRef.current = summaryLive;
  });

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((ms: number, fn: () => void) => {
    const id = setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id);
      fn();
    }, ms);
    timers.current.push(id);
  }, []);
  const stopTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(
    () => () => {
      stopTimers();
      ckTick.cancel();
    },
    [stopTimers],
  );

  const requestFocus = useCallback((target: FocusRequest["target"]) => {
    setFocus((f) => ({ target, n: (f?.n ?? 0) + 1 }));
  }, []);

  const entryOf = useCallback((key: string) => entriesRef.current.find((e) => e.key === key), []);

  /** Checks list[i], then (Check all) the rest of the list. */
  const play = useCallback(
    (list: readonly string[], i: number, all: boolean, reset: boolean, lead: string) => {
      const key = list[i];
      const entry = entryOf(key);
      if (!entry) return;
      send({ type: "start", key, queue: list.slice(i + 1), all, reset });
      announce(`${lead}${C.live.checking(entry.number)}`);

      for (let s = 1; s < PRIZE_GROUP_COUNT; s++) {
        later(s * CK_TIME.step, () => {
          send({ type: "step", step: s });
          ckTick.step();
        });
      }
      later(CK_TIME.scan, () => send({ type: "phase", phase: "almost" }));
      later(CK_TIME.scan + CK_TIME.almost, () => send({ type: "phase", phase: "flip" }));
      later(CK_TIME.scan + CK_TIME.almost + CK_TIME.flipOut, () => {
        send({ type: "reveal", key });
        announce(entry.live);
        if (entry.won) ckTick.won();
        else ckTick.lost();
        later(entry.won ? CK_TIME.wonPause : CK_TIME.lostPause, () => {
          if (i + 1 < list.length) {
            send({ type: "gap" });
            later(CK_TIME.gap, () => play(list, i + 1, all, false, ""));
            return;
          }
          const done = stateRef.current.done;
          const every = entriesRef.current.every((e) => done[e.key]);
          send({ type: "end", summary: every });
          if (every) {
            announce(summaryRef.current);
            ckTick.total();
            if (all) requestFocus({ kind: "sum" });
          }
        });
      });
    },
    [entryOf, later, requestFocus, send],
  );

  const running = !!state.cur || state.all;

  const checkAll = useCallback(() => {
    const s = stateRef.current;
    if (s.cur || s.all) return;
    const todo = entriesRef.current.filter((e) => !s.done[e.key]);
    if (!todo.length) return;
    stopTimers();
    if (instant) {
      send({ type: "instant", keys: todo.map((e) => e.key) });
      announce(`${todo.map((e) => e.live).join(" ")} ${summaryRef.current}`);
      requestFocus({ kind: "sum" });
      return;
    }
    play(
      todo.map((e) => e.key),
      0,
      true,
      false,
      "",
    );
  }, [instant, play, requestFocus, send, stopTimers]);

  const checkOne = useCallback(
    (key: string) => {
      const s = stateRef.current;
      const entry = entryOf(key);
      if (!entry || s.cur || s.all || s.done[key]) return;
      stopTimers();
      requestFocus({ kind: "panel", key });
      if (instant) {
        send({ type: "instant", keys: [key] });
        const every = entriesRef.current.every((e) => e.key === key || s.done[e.key]);
        announce(every ? `${entry.live} ${summaryRef.current}` : entry.live);
        return;
      }
      play([key], 0, false, false, "");
    },
    [entryOf, instant, play, requestFocus, send, stopTimers],
  );

  const skip = useCallback(() => {
    stopTimers();
    ckTick.cancel();
    const all = entriesRef.current;
    send({ type: "instant", keys: all.map((e) => e.key) });
    announce(`${all.map((e) => e.live).join(" ")} ${summaryRef.current}`);
    requestFocus({ kind: "sum" });
  }, [requestFocus, send, stopTimers]);

  const again = useCallback(() => {
    const keys = entriesRef.current.map((e) => e.key);
    if (!keys.length) return;
    stopTimers();
    requestFocus({ kind: "panel", key: keys[0] });
    play(keys, 0, true, true, C.live.again);
  }, [play, requestFocus, stopTimers]);

  const settle = useCallback(() => {
    const s = stateRef.current;
    if (!s.cur && !s.all) return;
    stopTimers();
    ckTick.cancel();
    send({ type: "instant", keys: [...(s.cur ? [s.cur] : []), ...s.queue] });
  }, [send, stopTimers]);

  const phaseOf = useCallback(
    (key: string): RowPhase => {
      if (state.done[key]) return "done";
      if (state.cur === key) return state.phase ?? "scan";
      if (state.queue.includes(key)) return "queued";
      return "idle";
    },
    [state],
  );

  const allDone = entries.length > 0 && entries.every((e) => state.done[e.key]);
  const ticketsLeft = useMemo(
    () => entries.reduce((sum, e) => sum + (state.done[e.key] ? 0 : (counts[e.key] ?? 1)), 0),
    [entries, counts, state.done],
  );

  return {
    state,
    phaseOf,
    running,
    allDone,
    sumShow: allDone && !state.cur,
    ticketsLeft,
    focus,
    checkAll,
    checkOne,
    skip,
    again,
    settle,
  };
}
