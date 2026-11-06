import { AccessibilityInfo, Platform, Vibration, type ViewInstance } from "react-native";

/**
 * Check my tickets' own small kit: the reveal's timing, the spoken
 * announcements and the vibration ticks. Its board colours (gold halo, gold
 * mark, the light sweep, the won ring) live in theme/tokens.ts.
 */

/**
 * The board's clock for ONE number, about 4–5 s (CheckTickets `_sched` /
 * `_reveal` / `_next`): nine prize groups in 3 s (333 each) · "Almost there…"
 * 0.5 s · the panel turns away (250) · it turns back with the result (300) ·
 * Won: "You won" counts up in 18 steps of 50 and the next number waits
 * 1.3 s; Not won waits 0.5 s · Check all leaves 0.4 s between numbers.
 */
export const CK_TIME = {
  step: 333,
  scan: 3000,
  almost: 500,
  flipOut: 250,
  flipIn: 300,
  wonPause: 1300,
  lostPause: 500,
  gap: 400,
  /** "You won" count-up: starts once the panel has turned back. */
  countDelay: 300,
  countSteps: 18,
  /** The summary's total. */
  sumSteps: 24,
  countStep: 50,
  /** The Won pill pops in while the panel turns back. */
  popDelay: 160,
  pop: 340,
  /** Gold marks over the digits. */
  markDelay: 120,
  mark: 420,
  sweep: 1500,
  /** The card's fill and edge fade to their new colour (`.ck-row` transition: indigo while checked, gold / grey after). */
  tint: 300,
  confetti: 1500,
  /** Confetti is taken away after this (the row) or 2 s (the summary). */
  confettiLife: 1900,
  sumConfettiLife: 2000,
  rise: 360,
} as const;

/**
 * One polite announcement (the board's aria-live line). iOS queues it behind
 * whatever VoiceOver is saying, so "Checking …" never cuts off the button's
 * own label; Android's TalkBack queues by itself.
 */
export function announce(text: string): void {
  if (!text) return;
  if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true });
  else AccessibilityInfo.announceForAccessibility(text);
}

/** Moves the screen reader to `node` (no effect when none is running). */
export function focusNode(node: ViewInstance | null | undefined): void {
  if (node) AccessibilityInfo.sendAccessibilityEvent(node, "focus");
}

const ANDROID = Platform.OS === "android";

function vibrate(pattern?: number | number[]): void {
  try {
    if (pattern === undefined) Vibration.vibrate();
    else Vibration.vibrate(pattern);
  } catch {
    // No vibrator, or vibration switched off by the OS: the reveal works the same without it.
  }
}

/**
 * Small vibration ticks (react-native Vibration, no new package). Android
 * takes a length, so each prize group is a tiny 8 ms tick and a win is a
 * short double tap. iOS ignores lengths (every call is the same ~0.4 s buzz),
 * so there only a WIN buzzes, once — a tick per group would be a drone.
 * Never called under reduced motion (results appear at once, quietly).
 * The VIBRATE permission is in Expo's default Android manifest.
 */
export const ckTick = {
  step(): void {
    if (ANDROID) vibrate(8);
  },
  won(): void {
    vibrate(ANDROID ? [0, 14, 70, 24] : undefined);
  },
  lost(): void {
    if (ANDROID) vibrate(10);
  },
  total(): void {
    if (ANDROID) vibrate([0, 10, 60, 10]);
  },
  cancel(): void {
    try {
      Vibration.cancel();
    } catch {
      // Nothing was vibrating.
    }
  },
};
