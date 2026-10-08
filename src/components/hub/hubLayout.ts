import { createContext, useContext } from "react";
import { useWindowDimensions } from "react-native";

/**
 * Shared geometry of the three hubs (Movies / Series / Books —
 * docs/mobile-media-page-2026-10-02/design), which ARE the Media tab's root:
 * each is the body of one chip, running full-bleed from the top of the screen
 * under the Media bar and its chip row, which are laid over the hero.
 * LAYOUT ONLY: nothing here may fetch, cache or derive data.
 */

/** Which hub a body is — the Media chip it belongs to. */
export type HubKind = "movies" | "series" | "books";

/**
 * The hero's two looks:
 * - "poster" (Movies, Series) — the title's art full-bleed, copy left-aligned;
 * - "cover" (Books) — the 5:7 cover standing centred over a blurred backdrop
 *   drawn from that same cover, copy centred.
 */
export type HubHeroVariant = "poster" | "cover";

/** Air between the bottom of the pinned Media bar + chip row and the hero's copy (or the book cover). */
export const HUB_TOP_GAP = 16;

/** The boards' vertical rhythm between sections under the hero. */
export const HUB_SECTION_GAP = 34;

/**
 * How tall the Media tab's pinned chrome is — the safe-area inset, the "Media"
 * bar and the chip row — measured by the Media screen and handed to every hub
 * body under it. The hubs scroll UNDER that chrome, so whatever they draw at
 * the top (the hero's copy, a loading block, an error, the pull-to-refresh
 * indicator, a "scroll to All …") has to keep clear of it. 0 outside the
 * Media screen.
 */
export const HubChromeContext = createContext(0);

export function useHubChromeHeight(): number {
  return useContext(HubChromeContext);
}

/**
 * The hero's MINIMUM height on this phone. It starts at the very top of the
 * screen (the Media bar and chips are laid over it), so it is the boards'
 * full-bleed 640 (poster) / 740 (cover) on a 390pt phone — the board's
 * proportion of the width, capped at a share of the window so the first row
 * still peeks above the dock. It is a minimum — at a large text size the copy
 * grows the hero instead of climbing under the chip row.
 */
export function useHubHeroMinHeight(variant: HubHeroVariant): number {
  const { width, height } = useWindowDimensions();
  if (variant === "cover") return Math.round(Math.max(560, Math.min(width * 1.9, height * 0.84)));
  return Math.round(Math.max(480, Math.min(width * 1.64, height * 0.78)));
}

/**
 * Myanmar script must never be letter-spaced or squeezed into a Latin line
 * box (ThemedText's own rule). The hub sets its own display sizes, so it has
 * to apply the same test to the text it is about to draw.
 */
const MYANMAR_SCRIPT = /[က-႟ꩠ-ꩿ]/;

export function hasMyanmar(text: string | null | undefined): boolean {
  return !!text && MYANMAR_SCRIPT.test(text);
}

/** Joins the defined, non-empty meta parts with " · ". */
export function joinMeta(parts: ReadonlyArray<string | number | null | undefined>): string {
  return parts.filter((part) => part !== null && part !== undefined && `${part}`.length > 0).join(" · ");
}
