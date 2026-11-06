import { Easing } from "react-native-reanimated";

/**
 * IVORY PRESS — the Lottery's own palette (lt-base.css v4, section 1, translated
 * 1:1; LOTTERY-APP-SPEC.md §1.1 carries the WCAG contrast of every pair).
 *
 * The Lottery is a separate white app inside the dark MyanFlix app (owner,
 * 2026-10-14). Nothing under src/lottery reads `theme.colors`: a dark Marquee
 * token leaking in is exactly the bug the website spec warns about (§1.7), so
 * the only thing taken from the app theme is `theme.font` for Burmese runs.
 *
 * Roles, in one line each: paper is the ground; ink (one ink, three strengths)
 * is all text; SEAL red is the one main action and the current dock tab;
 * INDIGO is selection, focus and links; GOLD is winning only; every status is
 * icon + word, never colour alone.
 */
export const LT = {
  /* paper and surfaces */
  paper: "#FFFDF8",
  white: "#FFFFFF",
  cream: "#F7F1E3",
  /** v3: the number window's paper. */
  cream1: "#FBF7EC",
  cream2: "#EFE6D0",
  mist: "#F2F1EE",
  line: "#E5DDCB",
  lineStrong: "#C9BEA4",
  /** Input and tile borders (3.35:1 on paper — the non-text 3:1 bar). */
  field: "#958A73",
  /** A sheet's grabber. */
  grab: "#D8CFBB",
  /** A disabled primary button's fill. */
  disabled: "#E9E3D6",

  /* the one ink */
  ink: "#1F1B16",
  ink2: "#57503F",
  ink3: "#6E6656",

  /* printing inks */
  seal: "#A3271F",
  sealHover: "#8A1F19",
  sealPress: "#74190F",
  sealTint: "#FBEDEA",
  indigo: "#283C70",
  indigoTint: "#ECEFF8",
  indigoPress: "#DCE2F1",

  /* gold leaf: winning only */
  gold: "#D8B04A",
  goldEdge: "#B8892B",
  goldLine: "#E2C77A",
  goldTint: "#FBF3DC",
  goldText: "#7A5A10",
  /** A Won row or win line while pressed. */
  goldPress: "#F8EDCB",
  /** The halo round a won card and the Check my tickets summary: gold at 28%. */
  goldHalo: "rgba(216,176,74,0.28)",
  /** The highlighter over a ticket's matching digits (Check my tickets): gold at 30%. */
  goldMark: "rgba(216,176,74,0.30)",

  /* status */
  ok: "#1B6E43",
  okTint: "#E7F3EB",
  okLine: "#BFDDC9",
  warn: "#8A5300",
  warnTint: "#FDF1DA",
  warnLine: "#EED39E",
  err: "#B0261C",
  errTint: "#FCEBE8",
  errLine: "#F1C4BE",
  /** Toast icon inks on the ink-filled toast. */
  toastOk: "#8FD9AE",
  toastWarn: "#F2C66D",

  selection: "#D5DCEE",
  /** A segmented option's pressed fill on the mist track. */
  whiteVeil: "rgba(255,255,255,0.6)",
  /** A text button pressed on the ink toast (Confirm's Undo): paper at 12%. */
  paperVeil: "rgba(255,253,248,0.12)",
  scrim: "rgba(31,27,22,0.42)",
  scrimLight: "rgba(31,27,22,0.12)",
  /** The dock's warm-white glass, laid over a light blur. */
  glass: "rgba(255,253,248,0.88)",
  /** The soft light that sweeps across a card while it is checked: clear → light → clear, over the paper. */
  sweepClear: "rgba(255,252,240,0)",
  sweepLight: "rgba(255,250,232,0.78)",
  /** The Thai ticket's paper, under the frame while it loads. */
  ticketPaper: "#FFFEFA",
  ticketInk: "#18181C",
  /** Typing on the ticket (Draw): the ring round the number slot, and the dash in a cell with no digit — indigo-grey. */
  slotLine: "#AEB6CE",
  slotDash: "#9AA3C0",
  /** The paper under the number slot while it has focus: half white — and its rest, the same white at 0, so the ease never greys. */
  slotLift: "rgba(255,255,255,0.5)",
  slotClear: "rgba(255,255,255,0)",
  /** The ghost QR's own box before buying: white at 70%. */
  ghostPaper: "rgba(255,255,255,0.7)",
} as const;

/**
 * The Thai ticket's printing inks (art/thai/template-thai.json). They are the
 * printed artwork's own colours: the orange ticket ID is 2.6:1 on the paper,
 * which is why every caption prints the ID again as text and the ticket's
 * accessible label reads it out.
 */
export const TICKET_INK = {
  number: "#18181C",
  pink: "#CF2A5E",
  blue: "#2766C2",
  red: "#E0241D",
  orange: "#F0841C",
  stamp: "#2C2836",
  bars: "#111114",
  /** The QR stand-in's own white box. */
  qrPaper: "#FFFFFF",
} as const;

/** Radii: ticket 2 · number window 3 · tag 4 · input 6 · button 8 · card 10 · promo 12 · buy bar 16 · dock 32. */
export const LT_RADIUS = {
  ticket: 2,
  window: 3,
  tag: 4,
  input: 6,
  button: 8,
  card: 10,
  promo: 12,
  buybar: 16,
  dock: 32,
  round: 999,
} as const;

/** 4-based spacing; gutter 16, section gap 32, card padding 16, content column max 560. */
export const LT_SPACE = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
  s10: 40,
  s12: 48,
  s16: 64,
  gutter: 16,
  section: 32,
  cardPad: 16,
  contentMax: 560,
} as const;

const SHADOW_FLOAT = "0 1px 2px rgba(60,45,20,0.06), 0 10px 28px rgba(60,45,20,0.12)";
const SHADOW_S2 = "0 1px 2px rgba(60,45,20,0.05), 0 4px 12px rgba(60,45,20,0.07), 0 16px 32px -8px rgba(60,45,20,0.08)";
const SHADOW_TICKET = "0 1px 1px rgba(60,45,20,0.10), 0 3px 8px rgba(60,45,20,0.08), 0 14px 28px -10px rgba(60,45,20,0.18)";
/** A paper in a pile casting UP onto the one behind it (Tickets cascade). */
const SHADOW_PILE_EDGE = "0 -1px 0 rgba(60,45,20,0.08), 0 -3px 6px -2px rgba(60,45,20,0.20)";

/**
 * Warm, layered paper shadows — RN `boxShadow` strings copied from lt-base
 * (RN 0.86 draws them on both platforms; AnimatedSplash uses boxShadow too).
 * Put one on the view that OWNS the background, as TabBar does with its
 * elevation: a shadow under a transparent view has nothing to cast from.
 */
export const LT_SHADOW = {
  /** Rows, chips, the balance chip. */
  s1: "0 1px 2px rgba(60,45,20,0.06), 0 1px 1px rgba(60,45,20,0.04)",
  /** Cards and the toast. */
  s2: SHADOW_S2,
  /** Sheets (cast upwards). */
  s3: "0 -1px 2px rgba(60,45,20,0.05), 0 -12px 40px rgba(60,45,20,0.14)",
  /** Paper on a table: every ticket at full size. */
  ticket: SHADOW_TICKET,
  /** A 120pt list thumbnail. */
  thumb: "0 1px 2px rgba(60,45,20,0.18)",
  /** The buy bar. */
  float: SHADOW_FLOAT,
  /** The dock: a top highlight inside the capsule + the float shadow. */
  dock: `inset 0 1px 0 rgba(255,255,255,0.9), ${SHADOW_FLOAT}`,
  /** Printed's slot the tickets come out of. */
  slot: "inset 0 1px 2px rgba(60,45,20,0.28)",
  /** Every paper in a pile after the first: casts up onto the one behind, so each strip reads as its own ticket. */
  pileUp: `${SHADOW_PILE_EDGE}, ${SHADOW_TICKET}`,
  /** The slim "+N more" / "Show fewer" strip of a folded pile. */
  pileMore: `inset 0 0 0 1px ${LT.line}, ${SHADOW_PILE_EDGE}`,
  /** The pile's "×N" seal: a white ring round it, then a soft drop. */
  pileSeal: `0 0 0 2px ${LT.white}, 0 2px 6px rgba(60,45,20,0.28)`,
  /** A won card and the Check my tickets summary: gold edge, a soft gold ring, the card shadow. */
  wonRing: `0 0 0 1px ${LT.goldEdge}, 0 0 0 4px ${LT.goldHalo}, ${SHADOW_S2}`,
  /** The gold mark over matching digits: a white hairline round it and a warm drop. */
  goldMark: "0 0 0 1px rgba(255,255,255,0.75), 0 2px 8px rgba(122,90,16,0.25)",
} as const;

/**
 * Dock and buy-bar geometry (lt-base 5b/5c): the dock is 64 tall, 16 in from
 * each side and 20 above the safe-area bottom; the buy bar floats 12 above it.
 * `useLtClearance()` turns these into a scroll view's bottom padding.
 */
export const LT_LAYOUT = {
  dockH: 64,
  dockSide: 16,
  dockLift: 20,
  dockMax: 528,
  barH: 100,
  /** The buy bar's gap above the dock. */
  barGap: 12,
  /** Air between the last content and the dock (or the buy bar). */
  contentAir: 16,
  /** The top bar's row under the status bar inset. */
  topBarH: 56,
  minTouch: 44,
} as const;

/** The one curve (lt-base `--lt-ease: cubic-bezier(.2,.8,.2,1)`): feedback only. Pair it with `useReducedMotion()`. */
export const LT_EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
