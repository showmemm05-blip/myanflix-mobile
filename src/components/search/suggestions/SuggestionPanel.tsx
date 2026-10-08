import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import { ROW_HEIGHT, THUMB_HEIGHT, styles as rowStyles } from "@/components/search/suggestions/SuggestionRow";

/** Rows visible before the list scrolls (the board's ~259pt); the rest are a flick away. */
const MAX_VISIBLE_ROWS = 4;
/** Under two rows there is nothing worth floating — the grid below has it all. */
const MIN_PANEL_HEIGHT = 2 * ROW_HEIGHT;
/** Padding inside the panel's clipped box. */
const PANEL_PADDING = theme.spacing.xs + 2;
/**
 * The footer is a TAPPABLE ROW now, not a caption, so it is budgeted at the
 * full 44pt touch target plus the 1pt hairline above it. Undersize this and the
 * panel overruns the keyboard on a small phone by exactly the difference.
 */
const FOOTER_HEIGHT = theme.layout.minTouch + 1;
/**
 * What an anchor must leave free to be worth keeping: two whole rows plus the
 * "See all" footer. The tab strip (the board's anchor) sits ~80-90pt lower
 * than the field, so on a short phone with the keyboard up it can leave a
 * sliver, or nothing — the panel then hangs from a higher fallback instead.
 */
const COMFORT_HEIGHT = 2 * ROW_HEIGHT + PANEL_PADDING * 2 + FOOTER_HEIGHT;
/** The panel hangs 8pt below its anchor (the tab strip), not on it. */
const ANCHOR_GAP = theme.spacing.sm;
/** The Marquee board's dim over the content behind an open panel. */
const SCRIM_COLOR = "rgba(8,8,11,0.6)";

/**
 * The same decelerating curve the bottom sheet enters on, for the same reason:
 * it arrives once and stops. A spring would bounce a list of eight rows under
 * a field the user is still typing into.
 */
const ENTER_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const ENTER_DURATION_MS = 200;
/** Plainer and quicker — nobody studies a panel on its way out. */
const EXIT_EASING = Easing.in(Easing.quad);
const EXIT_DURATION_MS = 140;
/** How far it drops into place, and lifts back out. */
const TRAVEL = 6;

/** An anchor's bottom edge: in the screen root's coordinates, and in the window's. */
interface AnchorBox {
  top: number;
  windowBottom: number;
}

/** The slice of a React Query result the panel actually renders states from. */
export interface SuggestionQueryState {
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
}

interface Props {
  /** Focused, long enough, and on the tab this kind belongs to. */
  visible: boolean;
  /**
   * The view the panel hangs under — measured to find its bottom edge. The
   * Search screen passes its TAB STRIP (the Marquee board), so the tabs stay
   * tappable and the hint line under the field stays visible while typing.
   */
  anchorRef: RefObject<View | null>;
  /**
   * Higher views to hang under instead, in order of preference (the screen
   * passes the hint line, then the field). Used only when `anchorRef` leaves
   * less than two rows and the footer above the keyboard — short phones, big
   * text — so the suggestions never vanish where the old field-anchored panel
   * still fitted. Must be a stable array: it is an effect dependency.
   */
  fallbackAnchorRefs?: ReadonlyArray<RefObject<View | null>>;
  /**
   * Changes whenever the anchor may have moved (the screen bumps it from the
   * anchor's onLayout), so the panel re-measures instead of hanging at a
   * stale position when the hint line under the field appears or goes.
   */
  anchorKey?: number;
  /** The screen's root view — the panel's own coordinate space. */
  containerRef: RefObject<View | null>;
  /**
   * A tap on the dimmed content behind the panel. The screen closes the panel
   * and puts the keyboard away; omitted, the dim simply lets taps through.
   */
  onDismiss?: () => void;
  /**
   * The DEBOUNCED term the rows answer — never the raw keystroke, which could
   * label the footer with a term the list has not caught up to yet.
   */
  term: string;
  /** Names the list for a screen reader: movies, series or books. */
  accessibilityLabel: string;
  /** "No <kind> match «term»", already interpolated by the caller. */
  emptyLabel: string;
  /**
   * The footer row. The grid below does NOT follow the typing, so this is one
   * of only three ways a typed term ever reaches it (the others being the
   * keyboard's search key and a recent-search chip). The screen commits the
   * term, closes the panel and dismisses the keyboard.
   */
  onSeeAll: () => void;
  state: SuggestionQueryState;
  /** How many rows `children` holds — drives the empty and footer states. */
  itemCount: number;
  /** The kind's artwork width, so the skeletons match the real rows. */
  thumbWidth: number;
  /** The rows themselves, built by the per-kind wrapper. */
  children: ReactNode;
}

/**
 * The suggestion panel that hangs under the search screen's tab strip (the
 * Marquee board: the tabs stay tappable while typing) over a dim of the
 * content behind it — the box, the motion and every state, with the rows
 * supplied by whichever kind is on screen. When the tabs sit too low to leave
 * room above the keyboard, it hangs from a higher fallback (the hint line,
 * then the field) instead of disappearing.
 *
 * It answers a narrower question than the grid beneath it: "which of these is
 * the one I mean?" So each kind fetches its own small page on a short debounce.
 * The grid does not move while it does — it re-queries only on a committed
 * term — which makes this panel the live half of the screen and the footer row
 * the bridge between the two.
 *
 * It mounts as an absolutely positioned LAST child of the search screen's root
 * view, never inside the app bar: on Android a touch that lands outside an
 * ancestor's bounds is not delivered at all, so a panel parented to the header
 * would render below the bar and refuse every tap.
 */
export function SuggestionPanel({
  visible,
  anchorRef,
  fallbackAnchorRefs,
  anchorKey,
  containerRef,
  onDismiss,
  term,
  accessibilityLabel,
  emptyLabel,
  onSeeAll,
  state,
  itemCount,
  thumbWidth,
  children,
}: Props) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();

  // Mounted covers the EXIT too: the panel has to outlive `visible` long enough
  // to animate away, and must not unmount under a press that is still resolving.
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Reduced motion still gets the state change, it just arrives instantly —
      // proving the animation was never scheduled.
      progress.value = reduceMotion
        ? 1
        : withTiming(1, { duration: ENTER_DURATION_MS, easing: ENTER_EASING });
      return;
    }
    if (reduceMotion) {
      progress.value = 0;
      setMounted(false);
      return;
    }
    progress.value = withTiming(0, { duration: EXIT_DURATION_MS, easing: EXIT_EASING }, (finished) => {
      // An unfinished exit means `visible` went true again mid-flight (the user
      // tapped straight back into the field) — leave it mounted.
      if (finished) runOnJS(setMounted)(false);
    });
  }, [visible, reduceMotion, progress]);

  const keyboardInset = useKeyboardInset(mounted);

  /**
   * Where each candidate anchor's bottom edge is — the preferred one first,
   * then the fallbacks — once in the screen root's coordinates (the panel's
   * own space) and once in the window's (to budget the height against the
   * keyboard). Re-measured when the keyboard, the window or the anchors'
   * layout changes, and never while closed. A fallback that is not on screen
   * (the hint line comes and goes) is skipped, keeping the order.
   */
  const [anchors, setAnchors] = useState<AnchorBox[] | null>(null);
  useEffect(() => {
    if (!mounted) return;
    const root = containerRef.current;
    const primary = anchorRef.current;
    if (!primary || !root) return;
    const views = [primary, ...(fallbackAnchorRefs ?? []).map((ref) => ref.current)].filter(
      (view): view is View => view != null,
    );
    let cancelled = false;
    root.measureInWindow((_rootX, rootY) => {
      const boxes: (AnchorBox | null)[] = views.map(() => null);
      let remaining = views.length;
      views.forEach((view, index) => {
        view.measureInWindow((_x, y, _width, height) => {
          // A zero box is a view not laid out yet — never something to hang from.
          boxes[index] = height > 0 ? { top: y + height - rootY, windowBottom: y + height } : null;
          remaining -= 1;
          if (remaining === 0 && !cancelled) {
            setAnchors(boxes.filter((box): box is AnchorBox => box != null));
          }
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [mounted, anchorRef, fallbackAnchorRefs, anchorKey, containerRef, keyboardInset, windowHeight]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: -TRAVEL + progress.value * TRAVEL }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const { isError, isPending, isFetching, refetch } = state;
  /**
   * Shown whenever there is something to commit TO. It used to be gated on
   * `total > items.length` and on the grid being unfiltered, because it was a
   * count and a second count contradicting the results band reads as a bug. It
   * carries no number now — its job is committing, not reporting — so both
   * gates are gone. It still stays out of the pending, error and zero-row
   * states: committing from "no movies match" only walks the user into an
   * empty grid.
   */
  const footerVisible = !isPending && !isError && itemCount > 0;

  /**
   * What is left between an anchor and the keyboard. On a small phone with the
   * keyboard up this is two rows, not four — hence a computed cap rather than a
   * fixed height, and nothing at all rather than a sliver.
   *
   * WHICH anchor: the first (tab strip, then hint line, then field) that
   * leaves two whole rows and the footer. When none does, the highest one —
   * the field, which always leaves the most — so the panel shows wherever the
   * old field-anchored panel did, covering the tabs rather than vanishing.
   */
  const spaceUnder = (box: AnchorBox) =>
    windowHeight - box.windowBottom - ANCHOR_GAP - keyboardInset - theme.spacing.md;
  const anchor = anchors
    ? (anchors.find((box) => spaceUnder(box) >= COMFORT_HEIGHT) ??
      anchors.reduce<AnchorBox | null>(
        (best, box) => (best == null || spaceUnder(box) > spaceUnder(best) ? box : best),
        null,
      ))
    : null;
  const available = anchor ? spaceUnder(anchor) : 0;
  const listMaxHeight = Math.min(
    MAX_VISIBLE_ROWS * ROW_HEIGHT,
    available - PANEL_PADDING * 2 - (footerVisible ? FOOTER_HEIGHT : 0),
  );

  /**
   * The placeholder rows obey the same cap as the real ones. A fixed three
   * would stand 204pt tall in a space that can be as little as 136pt — the
   * loading state would run behind the keyboard for the length of the request
   * and then snap back once the rows arrived.
   */
  const skeletonCount = Math.max(1, Math.min(3, Math.floor(listMaxHeight / ROW_HEIGHT)));

  // Every hook above runs unconditionally; only the output is gated.
  if (!mounted || !anchor || available < MIN_PANEL_HEIGHT) return null;

  return (
    <>
      {/* The dim behind the panel (the board's 60% wash), from the anchor's
          bottom edge down. A tap on it closes the panel — the dim says the
          content behind is not what is being answered right now. Not a
          screen-reader stop: the keyboard's own dismiss is that path. */}
      <Animated.View
        pointerEvents={visible && onDismiss ? "auto" : "none"}
        style={[styles.scrim, { top: anchor.top }, scrimStyle]}
      >
        <Pressable
          onPress={onDismiss}
          accessible={false}
          importantForAccessibility="no"
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        // A fading-out panel must not eat a tap meant for the grid underneath.
        pointerEvents={visible ? "auto" : "none"}
        accessibilityLabel={accessibilityLabel}
        style={[styles.panel, { top: anchor.top + ANCHOR_GAP }, panelStyle]}
      >
        {/* Two views, not one: the outer carries the opaque fill and the shadow
            (Android's elevation needs a fill to cast anything), the inner carries
            `overflow: hidden` — on iOS that flag clips a layer's own shadow away,
            so the two can never share a view. */}
        <View style={styles.clip}>
          {isError ? (
            <View style={[styles.state, styles.errorState]} accessibilityRole="alert">
              <ThemedText variant="muted" color={theme.colors.textMuted} numberOfLines={3} style={styles.stateText}>
                {t.search.suggestError}
              </ThemedText>
              <Pressable
                onPress={() => refetch()}
                accessibilityRole="button"
                style={({ pressed }) => [styles.retry, pressed && rowStyles.rowPressed]}
              >
                <ThemedText variant="muted" weight="extrabold" color={theme.colors.link}>
                  {t.common.retry}
                </ThemedText>
              </Pressable>
            </View>
          ) : isPending ? (
            <SuggestionSkeletons count={skeletonCount} thumbWidth={thumbWidth} />
          ) : itemCount === 0 ? (
            <View style={[styles.state, styles.emptyState]}>
              <Ionicons name="search" size={20} color={theme.colors.textFaint} />
              <ThemedText variant="muted" color={theme.colors.textMuted} numberOfLines={3} style={styles.stateText}>
                {emptyLabel}
              </ThemedText>
            </View>
          ) : (
            <ScrollView
              style={[{ maxHeight: listMaxHeight }, isFetching && styles.refetching]}
              // A row press must land on the FIRST touch with the keyboard up.
              // The prop only applies to the scroll ancestors of the tapped view,
              // so the grid's own copy does nothing for these rows.
              keyboardShouldPersistTaps="handled"
              // Flicking through the suggestions is reading, not dismissing —
              // taking the keyboard away here would close the panel mid-scroll.
              keyboardDismissMode="none"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          )}

          {footerVisible ? (
            /* It names the DEBOUNCED term, the one the rows above it actually
               answer — never the raw keystroke, which could label the row with a
               term the list has not caught up to yet. The wording is shared by
               all three kinds because it says "results", not "movies". */
            <Pressable
              onPress={onSeeAll}
              accessibilityRole="button"
              accessibilityLabel={t.search.seeAllResults.replace("{term}", term)}
              // Same tint as a suggestion row, for the same reason: a 44pt row
              // that scales reads as the panel wobbling.
              style={({ pressed }) => [styles.footer, pressed && rowStyles.rowPressed]}
            >
              <ThemedText
                variant="muted"
                weight="bold"
                color={theme.colors.link}
                numberOfLines={1}
                style={styles.footerLabel}
              >
                {t.search.seeAllResults.replace("{term}", term)}
              </ThemedText>
              <Ionicons name="arrow-forward" size={16} color={theme.colors.link} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </>
  );
}

/** Rows in the real row's shape, so nothing jumps when the data lands. */
function SuggestionSkeletons({ count, thumbWidth }: { count: number; thumbWidth: number }) {
  return (
    <View accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, index) => index).map((index) => (
        <View key={index} style={rowStyles.row}>
          <Skeleton width={thumbWidth} height={THUMB_HEIGHT} radius="sm" />
          <View style={rowStyles.rowText}>
            <Skeleton width="60%" height={13} radius="xs" />
            <Skeleton width="35%" height={11} radius="xs" />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: SCRIM_COLOR,
    zIndex: 19,
  },
  panel: {
    position: "absolute",
    // The screen's own padding, so the panel is exactly as wide as the field.
    left: theme.layout.screenPadding,
    right: theme.layout.screenPadding,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow.lg,
    // Paint order settles it on iOS; Android needs the elevation above the
    // cards below (MediaCard carries shadow.sm, elevation 3) and the zIndex to
    // stay in front of siblings that are laid out after it.
    zIndex: 20,
  },
  clip: { borderRadius: 16, overflow: "hidden", padding: PANEL_PADDING },
  /** A refetch dims the held-over rows instead of replacing them. */
  refetching: { opacity: 0.7 },
  state: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  stateText: { flexShrink: 1 },
  emptyState: { justifyContent: "flex-start", gap: 12, paddingHorizontal: 10, paddingVertical: 14 },
  errorState: { paddingVertical: theme.spacing.xs, paddingRight: 0, paddingLeft: 10 },
  retry: {
    minHeight: theme.layout.minTouch,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
  },
  /** A control, so it carries the full touch target — FOOTER_HEIGHT agrees. */
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: theme.layout.minTouch,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
  },
  footerLabel: { flex: 1 },
});
