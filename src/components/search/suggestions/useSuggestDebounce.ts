import { useEffect, useState } from "react";
import { SEARCH_MIN_LENGTH } from "@/hooks/useSearchTerm";

/**
 * The panel's own rhythm, and the ONLY thing on the search screen that follows
 * the typing at all: the grid below is frozen until the user commits, because
 * the owner asked for the titles already on screen to stay there while they
 * type. Eight text rows are cheap where thirty posters are not, so this is what
 * answers each keystroke. Short enough to feel live, long enough not to fire
 * mid-word.
 */
export const SUGGEST_DEBOUNCE_MS = 150;

/**
 * The panel's OWN debounced term — never the grid's settled one.
 *
 * Lives in a hook so all three kinds (movies, series, books) share one timing
 * rule rather than three copies that can drift apart. Each panel calls it with
 * the RAW field text and feeds the result to both its query and its rows, so
 * the footer can never name a term the rows above it have not answered yet.
 *
 * Deliberately NOT gated on the panel being open: a closed panel keeps
 * debouncing so that re-focusing the field shows rows for the text already in
 * it immediately, instead of costing another SUGGEST_DEBOUNCE_MS first.
 * Nothing leaves the device meanwhile — the query's own `enabled` is what puts
 * a request on the wire.
 */
export function useSuggestDebounce(term: string): string {
  const trimmed = term.trim();
  const longEnough = trimmed.length >= SEARCH_MIN_LENGTH;

  // Falling below the minimum resets during render rather than in an effect, so
  // no request can leave for a term the field no longer holds. Note that
  // keepPreviousData still keeps the last rows on screen while a longer term
  // debounces — this reset only stops the REQUEST, it never blanks the panel
  // mid-keystroke.
  const [debounced, setDebounced] = useState(longEnough ? trimmed : "");
  if (!longEnough && debounced !== "") setDebounced("");
  useEffect(() => {
    if (!longEnough || trimmed === debounced) return;
    // Trailing edge, cancelled by the cleanup on the next keystroke.
    const timer = setTimeout(() => setDebounced(trimmed), SUGGEST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, longEnough, debounced]);

  return debounced;
}
