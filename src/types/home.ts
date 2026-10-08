/**
 * GET /api/home/showcase — the Home showcase's editorial data (owner,
 * 2026-10-08: the admin "Home promos" page). Guest OK; a valid token only
 * lets BOOK links through. Every field mirrors the backend contract exactly
 * (backend/src/home): dates are ISO-8601 strings, absent values are null.
 */

export type HomePromoKind = "HERO" | "SPOTLIGHT" | "COMING_SOON";

/** What a promo's button does. */
export type HomePromoCtaTarget = "SUBSCRIBE" | "ADD_MONEY" | "MOVIE" | "SERIES" | "BOOK" | "URL" | "NONE";

/** The drawn scene behind a promo with no uploaded picture (components/home/PromoArt). */
export type HomePromoArtPreset = "PREMIUM" | "PAYMENT" | "GAMES" | "GENERIC";

export type ShowcaseTitleType = "MOVIE" | "SERIES" | "BOOK";

/** The minimal fields a card needs about a linked title. Never playback fields. */
export interface ShowcaseTitle {
  type: ShowcaseTitleType;
  id: string;
  title: string;
  /** Up to 300 characters, whitespace collapsed. */
  description: string;
  posterUrl: string | null;
  coverUrl: string | null;
  /** Movies only. */
  thumbnailUrl: string | null;
  genre: string | null;
  releaseYear: number | null;
  /** Movies only. */
  durationMinutes: number | null;
  /** 0–10; null for books. */
  rating: number | null;
  /** Null for books (books have no access model — free to read when signed in). */
  accessType: "FREE" | "SUBSCRIPTION" | null;
  /** Movies only. */
  ageRating: string | null;
  /** Books only. */
  author: string | null;
}

export interface ShowcasePromo {
  id: string;
  kind: HomePromoKind;
  titleEn: string;
  titleMm: string;
  kickerEn: string | null;
  kickerMm: string | null;
  bodyEn: string | null;
  bodyMm: string | null;
  ctaLabelEn: string | null;
  ctaLabelMm: string | null;
  ctaTarget: HomePromoCtaTarget;
  url: string | null;
  artPreset: HomePromoArtPreset;
  /** Our own upload, already rewritten for the address the request came in on. */
  imageUrl: string | null;
  /** Short free text ("Expected Nov 2026"). */
  dateText: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** The linked title, when the viewer can see it. */
  target: ShowcaseTitle | null;
}

export interface ShowcaseSpotlight {
  /** PROMO = the team picked it in the admin; NEWEST_MOVIE = nothing picked, the newest published movie. */
  source: "PROMO" | "NEWEST_MOVIE";
  promo: ShowcasePromo | null;
  title: ShowcaseTitle;
}

export interface HomeSettings {
  webUrl: string | null;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
  gamesTeaserEnabled: boolean;
  gamesTeaserDateText: string | null;
}

export interface HomeShowcase {
  /** Live HERO promos in their order; slides whose title the viewer cannot open are already left out. */
  hero: ShowcasePromo[];
  spotlight: ShowcaseSpotlight | null;
  comingSoon: ShowcasePromo[];
  settings: HomeSettings;
}
