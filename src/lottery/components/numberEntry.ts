import { useEffect, useLayoutEffect, useRef } from "react";
import { AccessibilityInfo, Keyboard, type TextInputInstance } from "react-native";
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { LT_EASE } from "@/lottery/theme/tokens";

/**
 * What every six-digit entry shares — the ticket number window
 * (NumberWindow: Check my tickets, Home's gold window) and the ticket you type
 * on (ticket/TicketInput: Draw). Each draws its own cells; a digit landing,
 * the caret blinking and the spoken line are the same, so they live here once.
 */

/** The six cells, in order. */
export const DIGIT_CELLS = [0, 1, 2, 3, 4, 5] as const;

/** Digits only, the first six kept, leading zeros kept (a string, never a number). */
export function cleanDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}

/**
 * Focus the entry so the keyboard comes up. RN's `focus()` is a no-op on the
 * field that already has focus, and Android keeps the focus when the back key
 * or a drag hides the keyboard (iOS blurs the field then): blur first in that
 * case, so the keyboard comes back on a tap, Clear, Add or a refocus.
 */
export function focusEntry(input: TextInputInstance | null): void {
  if (!input) return;
  if (input.isFocused() && !Keyboard.isVisible()) input.blur();
  input.focus();
}

/** The pop: .86 → 1.04 (60%) → 1 over 180ms; digits 45ms apart when several land at once. */
const POP_UP_MS = 108;
const POP_SETTLE_MS = 72;
const POP_STAGGER_MS = 45;

/**
 * The digits as last committed. During this render `before` still holds the
 * value BEFORE the change, which tells each cell whether its digit just
 * landed; `landedFrom` is the first cell the change touched (where a pasted
 * run's 45ms stagger starts).
 */
export function useLandedDigits(digits: string): { before: string; landedFrom: number } {
  const previous = useRef(digits);
  const before = previous.current;
  let landedFrom = 0;
  while (landedFrom < 6 && before.charAt(landedFrom) === digits.charAt(landedFrom)) landedFrom++;
  useLayoutEffect(() => {
    previous.current = digits;
  }, [digits]);
  return { before, landedFrom };
}

export interface DigitPopInput {
  index: number;
  /** This cell's digit ("" when empty). */
  char: string;
  /** From useLandedDigits. */
  before: string;
  landedFrom: number;
  /** Change it to pop all six digits, 45ms apart (Quick pick). */
  popKey?: number;
  reduceMotion: boolean;
  /** False for a display-only window: its digits never pop. */
  enabled: boolean;
}

/**
 * One cell's pop, as a transform style for its digit: it pops when it lands
 * (a typed or pasted digit), and every digit pops when `popKey` changes —
 * never on mount, never under reduced motion. Only the digit moves.
 */
export function useDigitPop({ index, char, before, landedFrom, popKey, reduceMotion, enabled }: DigitPopInput) {
  const scale = useSharedValue(1);
  const pop = (delay: number) => {
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(0.86, { duration: 0 }),
        withTiming(1.04, { duration: POP_UP_MS, easing: LT_EASE }),
        withTiming(1, { duration: POP_SETTLE_MS, easing: LT_EASE }),
      ),
    );
  };

  // A digit landing in this cell. Layout effect: the pop starts before the
  // frame that first shows the digit is painted.
  useLayoutEffect(() => {
    if (!enabled || reduceMotion || !char || before.charAt(index) === char) return;
    pop(Math.max(0, index - landedFrom) * POP_STAGGER_MS);
    // Only a new digit pops; `pop` touches nothing but the shared value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char]);

  // `popKey` changed: every digit pops, 45ms apart (never on mount).
  const firstPopKey = useRef(popKey);
  useLayoutEffect(() => {
    if (popKey === firstPopKey.current) return;
    firstPopKey.current = popKey;
    if (reduceMotion || !char) return;
    pop(index * POP_STAGGER_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popKey]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

/** The caret's blink, as an opacity style: once a second (CSS `steps(1)`), steady under reduced motion. */
export function useCaretBlink(reduceMotion: boolean) {
  const on = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      on.value = 1;
      return;
    }
    on.value = withRepeat(
      withSequence(withDelay(500, withTiming(0, { duration: 0 })), withDelay(500, withTiming(1, { duration: 0 }))),
      -1,
      false,
    );
    return () => cancelAnimation(on);
  }, [reduceMotion, on]);
  return useAnimatedStyle(() => ({ opacity: on.value }));
}

export interface AnnounceDigitsInput {
  digits: string;
  /** False for a display-only window: nothing is read out. */
  enabled: boolean;
  /** The caller's help line for this same value; it is the tail of what is read. */
  help?: { text: string; spoken?: string };
  /** What is read when the entry empties, instead of "No digits yet." — "" reads nothing. */
  emptySpoken?: string;
}

/** Each change is read out digit by digit — "Your number: 3 7 2. 3 of 6 digits" — never on mount. */
export function useAnnounceDigits({ digits, enabled, help, emptySpoken }: AnnounceDigitsInput): void {
  const helpRef = useRef(help);
  const emptyRef = useRef(emptySpoken);
  useLayoutEffect(() => {
    helpRef.current = help;
    emptyRef.current = emptySpoken;
  });
  const spokenOnce = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    if (!spokenOnce.current) {
      spokenOnce.current = true;
      return;
    }
    const line = helpRef.current;
    const tail = line ? (line.spoken ?? line.text) : COMPONENT_COPY.entry.progress(digits.length);
    const empty = emptyRef.current ?? COMPONENT_COPY.entry.emptySpoken;
    const text = digits ? COMPONENT_COPY.entry.typed(digits, tail) : empty;
    if (text) AccessibilityInfo.announceForAccessibility(text);
  }, [digits, enabled]);
}
