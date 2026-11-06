import type { TextStyle } from "react-native";
import { LT } from "@/lottery/theme/tokens";
import type { LtFace } from "@/lottery/theme/fonts";

/**
 * The Lottery's type roles (lt-base section 3 / spec §1.3), phone sizes. This
 * is the only place a Lottery text size is defined; `LtText` renders every
 * role from here. Literata roles always draw lining + tabular figures (every
 * six-digit number, money total and the countdown is set in them).
 *
 * Letter spacing is in points: the CSS `em` values times the size
 * (kicker .08em × 12 = 0.96, display −.01em × 34 = −0.34).
 */
export type LtTypeRole =
  | "micro"
  | "microB"
  | "caption"
  | "kicker"
  | "meta"
  | "metaB"
  | "body"
  | "bodyB"
  | "button"
  | "buttonSm"
  | "title"
  | "h"
  | "display"
  | "displayL"
  | "num"
  | "digit"
  | "mono";

export interface LtTypeSpec {
  face: LtFace;
  fontSize: number;
  lineHeight: number;
  /** Points. Burmese runs always draw 0. */
  letterSpacing: number;
  /** Latin only — Burmese is never upper-cased (it has no case; the transform would only cost the run its tracking rules). */
  uppercase?: boolean;
  /** Literata roles: lining + tabular figures always on. */
  lining?: boolean;
  /** Default ink. */
  color: string;
}

export const LT_TYPE: Record<LtTypeRole, LtTypeSpec> = {
  micro: { face: "franklin600", fontSize: 12, lineHeight: 16, letterSpacing: 0, color: LT.ink },
  /** Pills, the Sample tag, the date stamp's month: Franklin 700 12/16. */
  microB: { face: "franklin700", fontSize: 12, lineHeight: 16, letterSpacing: 0, color: LT.ink },
  /** Help lines, footer lines, row sub-lines: Franklin 400 12/16. */
  caption: { face: "franklin400", fontSize: 12, lineHeight: 16, letterSpacing: 0, color: LT.ink3 },
  kicker: { face: "franklin600", fontSize: 12, lineHeight: 16, letterSpacing: 0.96, uppercase: true, color: LT.ink3 },
  meta: { face: "franklin400", fontSize: 14, lineHeight: 20, letterSpacing: 0, color: LT.ink },
  metaB: { face: "franklin600", fontSize: 14, lineHeight: 20, letterSpacing: 0, color: LT.ink },
  body: { face: "franklin400", fontSize: 16, lineHeight: 24, letterSpacing: 0, color: LT.ink },
  /** The total's term, a menu name: Franklin 600 16/24. */
  bodyB: { face: "franklin600", fontSize: 16, lineHeight: 24, letterSpacing: 0, color: LT.ink },
  button: { face: "franklin700", fontSize: 16, lineHeight: 20, letterSpacing: 0, color: LT.ink },
  buttonSm: { face: "franklin700", fontSize: 14, lineHeight: 20, letterSpacing: 0, color: LT.ink },
  title: { face: "literata600", fontSize: 20, lineHeight: 26, letterSpacing: 0, lining: true, color: LT.ink },
  h: { face: "literata700", fontSize: 26, lineHeight: 32, letterSpacing: 0, lining: true, color: LT.ink },
  display: { face: "literata700", fontSize: 34, lineHeight: 40, letterSpacing: -0.34, lining: true, color: LT.ink },
  displayL: { face: "literata700", fontSize: 44, lineHeight: 48, letterSpacing: -0.44, lining: true, color: LT.ink },
  /** A six-digit number in running text: Literata 600, +.06em (recomputed from the size a caller sets). */
  num: { face: "literata600", fontSize: 20, lineHeight: 26, letterSpacing: 1.2, lining: true, color: LT.ink },
  /** One digit in the number window. */
  digit: { face: "literata700", fontSize: 32, lineHeight: 38, letterSpacing: 0, lining: true, color: LT.ink },
  /**
   * A number as the ticket prints it, in running UI: Courier Prime 700 19/22
   * (Confirm's rows). Monospaced, so every digit is the same width (.6em) and
   * a dream's digits can sit in one even chip.
   */
  mono: { face: "courier700", fontSize: 19, lineHeight: 22, letterSpacing: 0, color: LT.ink },
};

/** Courier Prime's advance: every glyph is .6em wide (1ch at the role's size). */
export const MONO_ADVANCE = 0.6;

/** The `num` role's tracking as a share of its size (.06em). */
export const NUM_TRACKING = 0.06;

/**
 * Extra line height for a Burmese run, per role (lt-base: micro/kicker 20,
 * meta 24, body 28, title 30 — i.e. +4, the same rule ThemedText follows).
 */
export const MYANMAR_LINE_BONUS = 4;

/** Myanmar script (ThemedText's own test, kept identical so both sides agree on what counts as Burmese). */
export const MYANMAR_SCRIPT = /[က-႟ꩠ-ꩿ]/;

/** Lining + tabular figures: Literata's default, and Franklin's `tabular` prop. */
export const LINING_TABULAR: TextStyle["fontVariant"] = ["lining-nums", "tabular-nums"];
export const TABULAR: TextStyle["fontVariant"] = ["tabular-nums"];
