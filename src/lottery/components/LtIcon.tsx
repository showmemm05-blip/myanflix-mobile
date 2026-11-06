import { memo } from "react";
import Svg, { Path } from "react-native-svg";
import { LT } from "@/lottery/theme/tokens";

/**
 * The Lottery's line icons (spec §1.5, 24 grid, round caps and joins, stroke
 * 1.75) plus the few the boards add (copy, search, shuffle, tick, refresh,
 * chevrons). Each entry is [lines, dots]: the `h.01` dots are drawn in a
 * second path at stroke 2.5, as the spec says, so they read as dots rather
 * than specks. Sizes: 22 in the dock, 16 in buttons, 14 in pills.
 */
const ICONS = {
  home: ["M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z", ""],
  draw: ["M12 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M9 21h6 M12 18v3", "M9.5 9.5h.01 M14.5 11h.01 M11 14h.01"],
  results: ["M12 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M8.5 14 7 21l5-3 5 3-1.5-7", ""],
  tickets: [
    "M4 5h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6V6a1 1 0 0 1 1-1z M14 5v2 M14 11v2 M14 17v2",
    "",
  ],
  history: ["M3 12a9 9 0 1 0 3-6.7 M3 4v4h4 M12 7v5l3 2", ""],
  back: ["M15 18l-6-6 6-6", ""],
  next: ["M9 6l6 6-6 6", ""],
  down: ["M6 9l6 6 6-6", ""],
  close: ["M6 6l12 12 M18 6 6 18", ""],
  wallet: ["M3 7a2 2 0 0 1 2-2h13v4 M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z", "M16 14.5h.01"],
  dice: [
    "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
    "M8.5 8.5h.01 M15.5 8.5h.01 M12 12h.01 M8.5 15.5h.01 M15.5 15.5h.01",
  ],
  /** Quick pick's glyph (Draw, and Home's Random tile) is the dice. */
  shuffle: [
    "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
    "M8.5 8.5h.01 M15.5 8.5h.01 M12 12h.01 M8.5 15.5h.01 M15.5 15.5h.01",
  ],
  unlock: ["M7 11V8a5 5 0 0 1 9.6-2 M5 11h14v10H5z", ""],
  lock: ["M7 11V8a5 5 0 0 1 10 0v3 M5 11h14v10H5z", ""],
  pause: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M10 9v6 M14 9v6", ""],
  check: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 12.5l2.5 2.5L16 9.5", ""],
  /** A plain tick (no circle): the generator's picked mark. */
  tick: ["M5 12.5 9.5 17 19 7.5", ""],
  clock: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2", ""],
  notwon: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 12h8", ""],
  alert: ["M12 3 2 20h20z M12 10v4", "M12 17h.01"],
  info: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v5", "M12 8h.01"],
  printer: ["M6 9V3h12v6 M6 17H4V9h16v8h-2 M6 14h12v7H6z", ""],
  plus: ["M12 5v14 M5 12h14", ""],
  minus: ["M5 12h14", ""],
  upload: ["M12 16V4 M7 9l5-5 5 5 M4 20h16", ""],
  expand: ["M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5", ""],
  rotate: ["M4 12a8 8 0 0 1 14-5.3 M18 3v4h-4", ""],
  /** Generate again: both arcs. */
  refresh: ["M4 12a8 8 0 0 1 14-5.3 M18 3v4h-4 M20 12a8 8 0 0 1-14 5.3 M6 21v-4h4", ""],
  copy: [
    "M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
    "",
  ],
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4.2-4.2", ""],
  /** Confirm's row Remove: a smaller × than `close` (board `.lt-cl__rm`). */
  remove: ["M7 7l10 10 M17 7 7 17", ""],
  /** Confirm's undo toast ("027514 removed"). */
  trash: ["M4 7h16 M9 7V4.5h6V7 M6 7l1 12.2A2 2 0 0 0 9 21h6a2 2 0 0 0 2-1.8L18 7 M10 11v6 M14 11v6", ""],
  /** A pointing hand: "Tap your ticket to type your number" (Draw's empty help line). */
  tap: [
    "M9 11V5a2 2 0 0 1 4 0v6 M13 10a2 2 0 0 1 4 0v1 M17 11a2 2 0 0 1 4 0v3a7 7 0 0 1-7 7h-1.5a6 6 0 0 1-4.7-2.3L5 15.2a1.9 1.9 0 0 1 2.8-2.5L9 14",
    "",
  ],
  /** A film strip with a play mark: "Back to MyanFlix" (the Leave sheet). */
  film: [
    "M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M7 4v16 M17 4v16 M3 9h4 M3 15h4 M17 9h4 M17 15h4 M10.5 9.5v5l4-2.5z",
    "",
  ],
  /* Prize claims (PrizeClaim board, 24 Oct 2026). */
  /** A paper plane: "Request payment". */
  send: ["M21 3 10 14 M21 3l-7 18-4-7-7-4z", ""],
  /** A circled ×: the Rejected chip (the board's `ICON.cross`). */
  crossCircle: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9 9l6 6 M15 9l-6 6", ""],
  /** A speech bubble: "Contact support". */
  chat: ["M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z", ""],
  /** A right arrow between the three steps "You request → Admin confirms → Paid into your wallet". */
  arrow: ["M5 12h14 M13 6l6 6-6 6", ""],
} as const;

export type LtIconName = keyof typeof ICONS;

export interface LtIconProps {
  name: LtIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Decorative: every icon sits beside a word, so it is hidden from screen readers. */
export const LtIcon = memo(function LtIcon({ name, size = 24, color = LT.ink, strokeWidth = 1.75 }: LtIconProps) {
  const [lines, dots] = ICONS[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Path d={lines} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {dots ? <Path d={dots} stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </Svg>
  );
});
