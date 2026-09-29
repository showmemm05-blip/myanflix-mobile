import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * How long the field must sit still before a search request is allowed out.
 *
 * The knob for every surface that still debounces — today the books catalogue,
 * the actors list (ActorsList) and the web client, which share this value so
 * they feel identical.
 *
 * The main search screen deliberately does NOT use this hook any more: its grid
 * re-queries only on a committed term, because the owner asked for the movies
 * already on screen to stay there while they type, and a debounce still swaps
 * them out — just 400ms later. Do not wire this back into that screen.
 */
export const SEARCH_DEBOUNCE_MS = 400;

/**
 * Shortest term worth a round trip. One character matches most of the
 * catalogue, so it costs a request and tells the user nothing. Below this the
 * `search` param is simply omitted — the unfiltered view stays on screen and a
 * hint asks for another character.
 */
export const SEARCH_MIN_LENGTH = 2;

/**
 * How long a movies result stays fresh in the React Query cache. Retyping a
 * term searched inside this window is served from cache instead of hitting
 * /movies again; together with React Query's in-flight dedupe of identical
 * keys, that is what keeps duplicate requests for the same term off the wire.
 */
export const SEARCH_STALE_TIME_MS = 30_000;

/**
 * How many rows a suggestion panel asks for. Eight is a list you can read at a
 * glance, not a second results grid — the grid below already holds the rest.
 *
 * It lives here, with the other search knobs, because all three panels (movies,
 * series, books) have to ask for the SAME number: a books panel showing six
 * rows where the movies panel shows eight would read as a bug in the books
 * search rather than as a shorter catalogue.
 */
export const SUGGEST_LIMIT = 8;

export interface SearchTerm {
  /** Raw field value, updated on every keystroke so the input never lags. */
  term: string;
  /** Stable identity — safe to hand straight to `TextInput.onChangeText`. */
  setTerm: (next: string) => void;
  /**
   * The debounced, trimmed term — but only once it is at least
   * SEARCH_MIN_LENGTH characters long, otherwise `""`. This is the only value
   * that should ever reach a query key or a client-side filter.
   */
  effectiveTerm: string;
  /** The field holds something the debounce has not handed over yet. */
  isDebouncing: boolean;
  /** Typed, but still shorter than SEARCH_MIN_LENGTH — drives a hint, not an error. */
  isTooShort: boolean;
  /** Empty the field and reset the results in the same render. */
  clear: () => void;
}

/**
 * Debounced search input state, shared by every search surface.
 *
 * Two values, deliberately: `term` is what the user sees and changes on every
 * keystroke, `effectiveTerm` is what the app is allowed to search for. Nothing
 * downstream should read `term` — memoising a filtered list on it recomputes
 * SEARCH_DEBOUNCE_MS early, for a term that may never be searched at all.
 *
 * Clearing is *not* debounced: emptying the field settles to `""` in the same
 * tick and cancels the pending timer, so the unfiltered view comes back the
 * moment the user hits the clear button. Going from one term to another stays
 * debounced as normal.
 */
export function useSearchTerm(initial = ""): SearchTerm {
  const [term, setTermState] = useState(initial);
  const [settled, setSettled] = useState(() => initial.trim());

  const trimmed = term.trim();

  useEffect(() => {
    // Nothing below SEARCH_MIN_LENGTH is ever searched, so there is nothing to
    // wait for: `setTerm` has already settled those in the same tick, and
    // arming a timer here would leave `isDebouncing` true — a spinner spinning
    // for a request that can never fire — for the whole debounce window.
    if (trimmed === settled || trimmed.length < SEARCH_MIN_LENGTH) return;
    // Trailing edge: fire once the typing stops. The cleanup cancels the
    // pending timer on the next keystroke and on unmount.
    const timer = setTimeout(() => setSettled(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, settled]);

  const setTerm = useCallback((next: string) => {
    setTermState(next);
    // Emptying the field — or backspacing it below SEARCH_MIN_LENGTH — can
    // never produce a request, so neither is debounced. Batched with the line
    // above, so the results drop back to the unfiltered view in one render
    // instead of staying filtered by a term the field no longer contains.
    const trimmedNext = next.trim();
    if (trimmedNext.length < SEARCH_MIN_LENGTH) setSettled(trimmedNext);
  }, []);

  const clear = useCallback(() => {
    setTermState("");
    setSettled("");
  }, []);

  return useMemo(
    () => ({
      term,
      setTerm,
      effectiveTerm: settled.length >= SEARCH_MIN_LENGTH ? settled : "",
      isDebouncing: trimmed !== settled,
      isTooShort: trimmed.length > 0 && trimmed.length < SEARCH_MIN_LENGTH,
      clear,
    }),
    [term, trimmed, settled, setTerm, clear],
  );
}
