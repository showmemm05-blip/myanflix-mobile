import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/theme";

/** A money flow's body never stretches wider than this on a tablet. */
export const SHEET_BODY_MAX_WIDTH = 560;

/**
 * The wallet's one side margin: every row, label and button sits this far in
 * from the edge of its column. Rows own it as their own padding (not the
 * column's), so the hairlines between sections can still run edge to edge.
 */
export const ROW_INSET = theme.layout.screenPadding;

/**
 * Widths behind the two flow decisions below, measured in the app's bundled
 * Noto Sans Myanmar (it also draws the Latin text):
 *  - the longest step-2 submit label is the Burmese withdrawSubmit, ~180pt at
 *    the flow button's 16pt ExtraBold — budgeted at 188 so a rounding
 *    difference never forces it onto a second line; beside it sit a 52pt
 *    Back square and a 10pt gap, and the button spends 2 × 24pt padding;
 *  - the widest quick amount, "50,000", is ~47pt at the chip's 14pt
 *    ExtraBold — budgeted at 50; four chips share three 8pt gaps, and each
 *    spends 2 × 4pt padding (Marquee chips have no border).
 * The flows pad their content ROW_INSET each side.
 */
const SUBMIT_LABEL_BUDGET = 188;
const SUBMIT_ROW_CHROME = 52 + 10 + 2 * theme.spacing.lg;
const QUICK_AMOUNT_LABEL_BUDGET = 50;
const QUICK_AMOUNT_CHROME = 2 * 4;
/**
 * Rows keep the design's right-hand amount column down to this width. The
 * flat rows have no card inset to pay for: at 360pt the text column still
 * gets ~148pt beside a "+1,000,000 Ks" amount, so only narrower phones stack.
 */
const ROW_STACK_WIDTH = 360;

export interface WalletLayout {
  /** The OS text-size setting — skeletons that stand in for text scale with it. */
  fontScale: number;
  /** Small phones (< 380pt): a flow's last step stacks Submit over Back. */
  isCompact: boolean;
  /** Tablets (>= 768pt): History shows its filters inline instead of in a sheet. */
  isTablet: boolean;
  /** Large tablets / tablet landscape (>= 960pt): the wallet splits into two columns. */
  isTwoColumn: boolean;
  /**
   * Rows stack their parts vertically instead of side by side — below 360pt,
   * and at accessibility text sizes on any screen, where a right-hand amount
   * column would squeeze the title to one word. The withdraw account-type
   * tiles drop from two columns to one on the same rule.
   */
  stacked: boolean;
  /** The wallet column never grows past this, however wide the screen is. */
  contentMaxWidth: number;
  /** Hero balance size: Marquee's 56pt, a notch smaller in short landscape. */
  amountSize: number;
  /**
   * A money flow's last step puts Submit full width with Back under it,
   * instead of a Back square beside it — whenever the side-by-side row would
   * leave the submit label too little room for the current text size.
   */
  sheetActionsStacked: boolean;
  /** Quick-amount presets: four in one row while "50,000" fits, else a 2×2 grid. */
  quickAmountColumns: 2 | 4;
  /**
   * Horizontal margin of a column of at most `maxWidth`: it centres the
   * column on wide screens and clears the landscape safe area, and is 0 on a
   * portrait phone. Rows inside add ROW_INSET themselves, so the text edge
   * never comes closer than the gutter (16pt, 32pt on tablets).
   */
  columnMargin: (maxWidth: number) => number;
}

/**
 * The wallet family's layout authority — the pattern of hooks/useHomeLayout
 * (which is Home-only by its own contract), computed at render time from the
 * window, so rotation and split-screen need nothing extra.
 *
 * LAYOUT ONLY. This hook must never fetch, cache or derive data.
 */
export function useWalletLayout(): WalletLayout {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sideInset = Math.max(insets.left, insets.right);

  return useMemo(() => {
    const isCompact = width < 380;
    const isTablet = width >= 768;
    const isTwoColumn = width >= 960;
    const isLargeText = fontScale >= 1.3;
    const isShortLandscape = height < 500 && width > height;
    const gutter = (isTablet ? theme.spacing.xl : ROW_INSET) + sideInset;
    const stacked = width < ROW_STACK_WIDTH || isLargeText;
    const flowBody = Math.min(width - 2 * sideInset, SHEET_BODY_MAX_WIDTH) - 2 * ROW_INSET;
    const submitLabelRoom = flowBody - SUBMIT_ROW_CHROME;
    const quickAmountLabelRoom = (flowBody - 3 * theme.spacing.sm) / 4 - QUICK_AMOUNT_CHROME;

    return {
      fontScale,
      isCompact,
      isTablet,
      isTwoColumn,
      stacked,
      contentMaxWidth: isTwoColumn ? 1040 : 640,
      amountSize: isShortLandscape ? 40 : 56,
      sheetActionsStacked: isCompact || isLargeText || submitLabelRoom < SUBMIT_LABEL_BUDGET * fontScale,
      quickAmountColumns: quickAmountLabelRoom >= QUICK_AMOUNT_LABEL_BUDGET * fontScale ? 4 : 2,
      columnMargin: (maxWidth: number) => Math.max(gutter, (width - maxWidth) / 2) - ROW_INSET,
    };
  }, [width, height, fontScale, sideInset]);
}
