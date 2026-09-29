import type { AgeRating } from "@/types/movie";

/**
 * Wire display values for the AgeRating enum — PG13 is spelled PG-13 on
 * screen. Lived in the old search filter sheet; the list card and the
 * player's details panel are what read it now, so it sits with the other
 * pure formatters. Consumers keep a `?? movie.ageRating` fallback so a code
 * this map does not know yet shows raw rather than as an empty cell.
 */
export const AGE_RATING_LABELS: Record<AgeRating, string> = {
  G: "G",
  PG: "PG",
  PG13: "PG-13",
  R: "R",
  NC17: "NC-17",
};
