import { useCallback, useMemo, useRef, type RefObject } from "react";
import type { FlatList } from "react-native";
import { useAnimatedRef, useReducedMotion, useSharedValue, type AnimatedRef, type SharedValue } from "react-native-reanimated";
import { theme } from "@/theme";

/**
 * One hub's scroll, shared by the pieces that care about it. The Media screen
 * owns one per hub (it needs them too) and hands each to its hub body:
 * - HubAllGrid attaches `listRef` to the hub's list, drives `scrollY` from
 *   it (useScrollOffset lives THERE, so nothing observes a list that is not
 *   mounted yet — the loading and error states have none) and records `allY`
 *   (where its "All …" section starts);
 * - HubHero pauses its story pager once `scrollY` has taken it off screen;
 * - the Media screen fades its bar's frosted glass in from `scrollY`, and a
 *   Books pick in its Categories pop-up asks Books for `requestScrollToAll()`;
 * - the hub calls `scrollToAll()` from a row's "See all".
 */
export interface HubScroll {
  listRef: AnimatedRef<FlatList>;
  scrollY: SharedValue<number>;
  /** Content offset of the "All …" section's heading — read here; HubAllGrid writes it through `setAllY`. */
  allY: RefObject<number>;
  /** HubAllGrid records where its "All …" section starts (and runs a waiting `requestScrollToAll`). */
  setAllY: (y: number) => void;
  /** Brings the "All …" heading up to just under the pinned Media chrome (a jump under reduce motion). */
  scrollToAll: () => void;
  /**
   * `scrollToAll()` now if the "All …" section has been laid out, otherwise as
   * soon as it is — for a hub that is only mounting (or still loading) when
   * it is asked.
   */
  requestScrollToAll: () => void;
}

/** A little air between the pinned chrome and the "All …" heading once it has been scrolled to. */
const ALL_CLEARANCE = theme.spacing.sm;

/**
 * @param pinnedHeight How much of the top of the list the Media bar and chip
 *   row cover — the heading has to land BELOW them, not under them.
 */
export function useHubScroll(pinnedHeight: number): HubScroll {
  const listRef = useAnimatedRef<FlatList>();
  const scrollY = useSharedValue(0);
  const allY = useRef(0);
  const measured = useRef(false);
  const pending = useRef(false);
  const reduceMotion = useReducedMotion();
  // Read at press time, so a re-measured chrome never rebuilds the callback.
  const pinned = useRef(pinnedHeight);
  pinned.current = pinnedHeight;

  const scrollToAll = useCallback(() => {
    listRef.current?.scrollToOffset({
      offset: Math.max(0, allY.current - pinned.current - ALL_CLEARANCE),
      animated: !reduceMotion,
    });
  }, [listRef, reduceMotion]);

  const setAllY = useCallback(
    (y: number) => {
      allY.current = y;
      measured.current = true;
      if (!pending.current) return;
      pending.current = false;
      // A frame later, once the list has taken the layout this measure belongs to.
      requestAnimationFrame(scrollToAll);
    },
    [scrollToAll],
  );

  const requestScrollToAll = useCallback(() => {
    if (measured.current) scrollToAll();
    else pending.current = true;
  }, [scrollToAll]);

  return useMemo(
    () => ({ listRef, scrollY, allY, setAllY, scrollToAll, requestScrollToAll }),
    [listRef, scrollY, setAllY, scrollToAll, requestScrollToAll],
  );
}
