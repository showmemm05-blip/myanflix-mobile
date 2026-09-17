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

/** Rows visible before the list scrolls; the other three are a flick away. */
const MAX_VISIBLE_ROWS = 5;
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
/** Mirrors the web panel's `mt-2` — the panel hangs off the field, not on it. */
const ANCHOR_GAP = theme.spacing.sm;

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
  /** The search field's outer view — measured to find its bottom edge. */
  anchorRef: RefObject<View | null>;
  /** The screen's root view — the panel's own coordinate space. */
  containerRef: RefObject<View | null>;
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
 * The suggestion panel that hangs off the search field — the box, the motion
 * and every state, with the rows supplied by whichever kind is on screen.
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
  containerRef,
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
   * Where the field's bottom edge is — once in the screen root's coordinates
   * (the panel's own space) and once in the window's (to budget the height
   * against the keyboard). Re-measured when the keyboard or the window changes
   * and never while closed; the field itself does not move as the user types.
   */
  const [anchor, setAnchor] = useState<{ top: number; windowBottom: number } | null>(null);
  useEffect(() => {
    if (!mounted) return;
    const field = anchorRef.current;
    const root = containerRef.current;
    if (!field || !root) return;
    let cancelled = false;
    field.measureInWindow((_x, y, _width, height) => {
      root.measureInWindow((_rootX, rootY) => {
        if (cancelled) return;
        setAnchor({ top: y + height - rootY, windowBottom: y + height });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [mounted, anchorRef, containerRef, keyboardInset, windowHeight]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: -TRAVEL + progress.value * TRAVEL }],
  }));

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
   * What is left between the field and the keyboard. On a small phone with the
   * keyboard up this is two rows, not five — hence a computed cap rather than a
   * fixed height, and nothing at all rather than a sliver.
   */
  const available = anchor
    ? windowHeight - anchor.windowBottom - ANCHOR_GAP - keyboardInset - theme.spacing.md
    : 0;
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
          <View style={styles.state}>
            <ThemedText variant="caption" numberOfLines={2} style={styles.stateText}>
              {t.search.suggestError}
            </ThemedText>
            <Pressable onPress={() => refetch()} hitSlop={10} accessibilityRole="button">
              <ThemedText variant="caption" weight="semibold" color={theme.colors.primary}>
                {t.common.retry}
              </ThemedText>
            </Pressable>
          </View>
        ) : isPending ? (
          <SuggestionSkeletons count={skeletonCount} thumbWidth={thumbWidth} />
        ) : itemCount === 0 ? (
          <View style={styles.state}>
            <ThemedText variant="caption" numberOfLines={2} style={styles.stateText}>
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
              variant="caption"
              weight="semibold"
              color={theme.colors.primary}
              numberOfLines={1}
              style={styles.footerLabel}
            >
              {t.search.seeAllResults.replace("{term}", term)}
            </ThemedText>
            <Ionicons name="arrow-forward" size={16} color={theme.colors.primary} />
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
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
  panel: {
    position: "absolute",
    // The screen's own padding, so the panel is exactly as wide as the field.
    left: theme.layout.screenPadding,
    right: theme.layout.screenPadding,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.popover,
    ...theme.shadow.lg,
    // Paint order settles it on iOS; Android needs the elevation above the
    // cards below (MediaCard carries shadow.sm, elevation 3) and the zIndex to
    // stay in front of siblings that are laid out after it.
    zIndex: 20,
  },
  clip: { borderRadius: theme.radius.xl, overflow: "hidden", padding: PANEL_PADDING },
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
  /** A control, so it carries the full touch target — FOOTER_HEIGHT agrees. */
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: theme.layout.minTouch,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm + theme.spacing.xs,
  },
  footerLabel: { flex: 1 },
});
