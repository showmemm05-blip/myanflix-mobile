import { theme } from "@/theme";

/**
 * The ad inventory routing table.
 *
 * The four campaigns are the four entries of `t.home.announcements.items`, and
 * these indices join THREE arrays that all live in different files:
 *
 *   index → t.home.announcements.items[i]        (en.ts / mm.ts — the copy)
 *   index → HOME_CONTENT.announcementIcons[i]    (content.ts — the drawn mark)
 *   index → CAMPAIGN_SLOTS[i]                    (here — where it renders)
 *
 * Reordering any one of them silently mismatches copy, icon and destination, so
 * all three carry the same warning.
 *
 * !! NEVER BRANCH ON `item.badge` !!
 * Badge strings are localized ("Offer" is "ပရိုမိုးရှင်း" in Burmese), so a
 * `badge === "Offer"` test passes in English and silently fails in Myanmar.
 * Slot, tone and footer are decided HERE, by index, in every language.
 */

/** Where a campaign is rendered — the offer gets its own signature object. */
export type CampaignSlot = "deck" | "ticket";

/** What a campaign's footer rail is allowed to be. */
export type CampaignFooterKind =
  /** Navigates somewhere real. Label must name that destination honestly. */
  | "browseMovies"
  | "browseSeries"
  | "wallet"
  /** No honest destination exists — the card ends in a status line, not a button. */
  | "comingSoon";

export interface CampaignSlotConfig {
  index: number;
  slot: CampaignSlot;
  /** Role colour for the card's rule, canvas wash, icon tile and pill. */
  tone: string;
  footer: CampaignFooterKind;
}

/**
 * Gold-scarcity rule: `premium` appears only on the two tickets, the hero's
 * bottom wash and the Subscribe buttons — so the offer's tone is the only gold
 * entry here, and it is the one that renders inside a TicketCard anyway. Deck
 * cards are violet or neutral. No `info` sky, no fourth hue.
 */
export const CAMPAIGN_SLOTS: readonly CampaignSlotConfig[] = [
  // 0 — "Update" / 4K HDR streaming.
  { index: 0, slot: "deck", tone: theme.colors.primary, footer: "browseMovies" },
  // 1 — "New" / Myanmar Originals. The copy says Originals "start rolling out
  // this quarter", so the label stays the generic Browse Series. Labelling it
  // "Watch Originals" would promise a catalogue that may not be there yet.
  { index: 1, slot: "deck", tone: theme.colors.primary, footer: "browseSeries" },
  // 2 — "Offer" / Refer a friend. Promoted out of the deck into OfferTicket.
  { index: 2, slot: "ticket", tone: theme.colors.premium, footer: "wallet" },
  // 3 — "Product" / Smart-TV app. Nothing in this app opens a TV app, so this
  // card gets no CTA at all and is not pressable anywhere.
  { index: 3, slot: "deck", tone: theme.colors.textFaint, footer: "comingSoon" },
] as const;

/** The campaigns that render as cards in the vertical deck, in page order. */
export const DECK_SLOTS = CAMPAIGN_SLOTS.filter((slot) => slot.slot === "deck");

/** The single campaign promoted into the gold OfferTicket. */
export const OFFER_SLOT_INDEX = 2;
