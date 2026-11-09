/**
 * The credit TMDB's API terms ask of every app that uses their data (owner,
 * 2026-11-06: movie and series details can come from TMDB): their logo, less
 * prominent than the app's own mark, and this sentence, in an About or
 * Credits place. docs/movie-details-tmdb-2026-11-06/TMDB-API-NOTES.md,
 * "Terms that matter".
 */

/**
 * TMDB's sentence, word for word ("This [application] uses…"; the website
 * says "This website uses…"). It is NOT in the dictionaries on purpose: the
 * terms fix the wording, so it stays in English in the Burmese app too
 * (About.dc.html).
 */
export const TMDB_CREDIT =
  "This app uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.";

/**
 * TMDB's own logo as a bundled picture — or null, which is today's value: the
 * file is not in the project, because nothing is fetched from the internet
 * without the owner's OK and the logo must be TMDB's own file (their "Logos &
 * Attribution" page), never a redrawn one. Until it is here the credit is the
 * sentence alone, under its heading.
 *
 * It cannot be looked for at run time: Metro resolves a `require()` when the
 * bundle is made, so the file has to exist before this line may name it. With
 * the file saved as assets/brand/tmdb-logo.svg (assets/brand/README.md), this
 * becomes `require("../../../assets/brand/tmdb-logo.svg") as number` — the
 * number Metro gives a bundled picture — and the About sheet draws it through
 * expo-image, which reads SVG and PNG alike. A JavaScript reload, no native
 * build.
 */
export const TMDB_LOGO: number | null = null;
