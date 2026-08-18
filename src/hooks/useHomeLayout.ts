import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/theme";

export interface HomeLayout {
  width: number;
  height: number;
  /**
   * The OS text-size setting. Any section that RESERVES height for text — a
   * fixed-ratio tile, a measured hero — must multiply its line heights by this,
   * or the reservation is only correct at 1× and clips at the accessibility
   * sizes. Sections whose height comes from their children can ignore it.
   */
  fontScale: number;
  /** Small phones (~360pt): action rows stack, stubs go vertical. */
  isCompact: boolean;
  /** Large phone / small tablet: two campaign columns start to pay off. */
  isWide: boolean;
  isTablet: boolean;
  /**
   * Horizontal page inset every home section must use. Already includes the
   * device's horizontal safe-area inset, so a full-bleed element that negates
   * it (`marginHorizontal: -gutter`) still starts its CONTENT clear of a
   * landscape notch or a curved display edge.
   */
  gutter: number;
  /** Clamped measure of the readable column — content is centred inside it. */
  contentWidth: number;
  /** How many columns a wrapping grid should use at this width. */
  columns: number;
}

/** The readable column never grows past this, however wide the screen is. */
const MAX_CONTENT = 760;

/**
 * The single layout authority for the Home advertisement page. Every section
 * consumes this instead of measuring on its own, so one breakpoint decision is
 * made once per render and the whole page moves together. Derived from
 * `useWindowDimensions()` at render time, so rotation is free — there are no
 * `Dimensions.get()` snapshots to go stale.
 *
 * LAYOUT ONLY. This hook must never fetch, cache or derive data.
 */
export function useHomeLayout(): HomeLayout {
  const { width, height, fontScale } = useWindowDimensions();
  // Home has no SafeAreaView of its own (the app bar takes only the top edge),
  // so in landscape on a notched phone the LEFT inset used to eat the film rail
  // and the leading edge of the hero's full-bleed band. The page is safe-area
  // aware here, once, rather than in every section.
  const insets = useSafeAreaInsets();
  const sideInset = Math.max(insets.left, insets.right);

  return useMemo(() => {
    const isCompact = width < 380;
    const isWide = width >= 600;
    const isTablet = width >= 768;
    const gutter = (isTablet ? theme.spacing.xl : theme.layout.screenPadding) + sideInset;
    const contentWidth = Math.min(width - gutter * 2, MAX_CONTENT);
    const columns = isTablet ? 4 : isWide ? 3 : 2;

    return { width, height, fontScale, isCompact, isWide, isTablet, gutter, contentWidth, columns };
  }, [width, height, fontScale, sideInset]);
}
