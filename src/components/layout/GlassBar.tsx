import { useCallback, useEffect, useRef, useState, type Component, type ReactNode, type RefObject } from "react";
import { Platform, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useScrollOffset,
  useSharedValue,
  type AnimatedRef,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/theme";

/**
 * THE FROSTED TOP BAR — one recipe for every navbar (the owner, 2026-10-02:
 * "can you make glass effect for all navbar"; the approved reference is the
 * Media tab's root).
 *
 * The bar is fully TRANSPARENT at the top of the page. As the page scrolls,
 * a frosted glass fades in behind it — the page blurred (expo-blur, dark, up
 * to intensity 40) under a 40% tint of the ground — between GLASS_START and
 * GLASS_FULL points of scroll, and fades back out on the way up. Never a
 * solid bar: the owner does not want black bars. Scroll-linked, not timed, so
 * it simply follows the finger under reduce motion.
 *
 * How a screen uses it (read https://docs.expo.dev/versions/v57.0.0/sdk/blur-view/):
 *
 *   <View style={container}>
 *     <GlassTarget targetRef={glass.blurTarget}>   ← wraps the page body
 *       …the scrolling page…
 *     </GlassTarget>
 *     <GlassBarBackground scrollY={…} height={…} blurTarget={glass.blurTarget} />
 *     <AppTopBar transparent | <TopBar floating …> (zIndex 1, mounted last)
 *   </View>
 *
 * - Android blurs ONLY what sits inside a BlurTargetView, so the page body
 *   goes inside GlassTarget and the glass is rendered AFTER it, never inside
 *   it (a blur that sits in its own target would blur itself). On iOS the
 *   target is a plain View and the BlurView blurs whatever is under it.
 * - Keep GlassTarget mounted for the screen's whole life, wrapping whatever
 *   state the body is in (loading, error, list): expo-blur reads the target
 *   once, when the BlurView mounts, and never notices a re-mounted target.
 * - ONE GlassTarget per screen and one glass per bar. Never a blur inside a
 *   list row.
 * - Android 11 and older have no cheap blur ("dimezisBlurViewSdk31Plus"
 *   falls back there): they get the 40% tint alone, which still fades in.
 * - The BlurView itself only EXISTS past GLASS_START (see GlassBarBackground).
 *   At the top of a page there is no blur view at all, so nothing native can
 *   draw glass there — not even on a screen that has just opened.
 */

/**
 * Transparent until the page has scrolled this far (pt)… The owner
 * (2026-10-05): not as soon as the page moves — 150pt first.
 */
export const GLASS_START = 150;
/** …and full glass from here on (pt): a 100pt fade. */
export const GLASS_FULL = 250;
/** The blur strength at full glass (expo-blur's 0–100). */
export const GLASS_INTENSITY = 40;
/** A pushed screen's bar before it has been measured: 8pt + the 44pt control row under the inset. */
export const GLASS_BAR_ROW = theme.spacing.sm + theme.layout.minTouch;

/**
 * The blur's floor while it is mounted (expo-blur's 0–100; invisible at 0.5).
 *
 * expo-blur's Android view has one path with no zero guard: when the blur
 * target arrives — the BlurView's SECOND commit, after its componentDidMount
 * resolves the target — it builds a brand-new Dimezis blur, switched ON, at
 * whatever intensity it holds (ExpoBlurView.setBlurTargetId → configureBlurView;
 * only setBlurRadius ever switches it off for 0). At 0 that is a live blur of
 * radius 0 that draws the page snapshot plus Dimezis's 15% grain until the
 * intensity next CHANGES — most likely the "glass the moment Profile opens"
 * the owner saw (2026-10-05), when the BlurView was mounted at the top of
 * every page — and older Android throws on a 0 radius (the
 * "nativePtr is null" bug expo-blur's own setBlurRadius comment guards).
 * Never 0 while mounted, so that path always gets a real radius.
 */
const GLASS_MIN_INTENSITY = 0.5;
/**
 * Android only: the blur layer fades in over the first 20pt past GLASS_START
 * (and is at opacity 0 at or below it). Dimezis paints its 15% grain at full
 * strength as soon as the blur is on, whatever the radius; this lets it ease in
 * with the glass instead of popping on at 150pt, and hides the floor above
 * while the blur is still mounted below 150pt on the way back up (see
 * GLASS_BLUR_HOLD). iOS keeps opacity 1: a UIVisualEffectView under a parent
 * with alpha < 1 renders broken.
 */
const GLASS_BLUR_ENTRY = 20;
const FADE_BLUR_LAYER = Platform.OS === "android";
/**
 * Hysteresis (pt): the blur mounts past GLASS_START but stays mounted until
 * the page is back at or below GLASS_START − this, so jitter around 150pt
 * does not create and destroy the native blur over and over.
 */
const GLASS_BLUR_HOLD = 10;

/** Reanimated drives the blur's `intensity` (expo-blur supports animating it). */
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

interface GlassTargetProps {
  /** The ref GlassBarBackground blurs — from `useGlassBar()` / `useRef<View>(null)`. */
  targetRef: RefObject<View | null>;
  children?: ReactNode;
  /** Defaults to `flex: 1` one physical pixel down from the top — see `styles.body`. */
  style?: StyleProp<ViewStyle>;
}

/**
 * The page body the glass blurs (expo-blur's BlurTargetView). It fills the
 * screen and starts ONE PHYSICAL PIXEL below the top on purpose: the bar over
 * it carries zIndex 1, so Fabric mounts it last, and Android orders siblings
 * for TalkBack by position — top edge first, the taller view first on a tie.
 * A body starting at y=0 would be read before the bar; one pixel lower, the
 * bar (back, title, actions) is read first. The pixel sits under the status
 * bar, so it never shows. (Home, Wallet and the Media root did this first.)
 */
export function GlassTarget({ targetRef, children, style }: GlassTargetProps) {
  return (
    <BlurTargetView ref={targetRef} style={[styles.body, style]}>
      {children}
    </BlurTargetView>
  );
}

interface GlassBarBackgroundProps {
  /** The page's scroll offset (pt). Glass fades in from GLASS_START to GLASS_FULL. */
  scrollY: SharedValue<number>;
  /** How tall the bar is, safe-area inset included — the glass covers exactly that. */
  height: number;
  /** The GlassTarget's ref: what the glass blurs on Android. */
  blurTarget: RefObject<View | null>;
}

/**
 * The glass itself: the blur and the 40% tint, both pinned to the top of the
 * screen, as tall as the bar, and both at zero at the top of the page. Render
 * it AFTER the GlassTarget and BEFORE the bar. It never takes a touch and has
 * nothing to read aloud.
 *
 * The tint is always mounted (its opacity is 0 up to GLASS_START). The blur
 * is MOUNTED only once the page is past GLASS_START (and unmounted again at
 * GLASS_START − GLASS_BLUR_HOLD): a UI-thread reaction mirrors that into
 * React state, and near the top there is no BlurView at all — so whatever
 * expo-blur's native view does on creation, a page at its top (a screen that
 * has just opened, like Profile) cannot show glass.
 */
export function GlassBarBackground({ scrollY, height, blurTarget }: GlassBarBackgroundProps) {
  // Seeded from the page's current offset (a first-render read, which
  // Reanimated allows) so a screen that mounts already scrolled has its blur
  // on the first frame; the reaction keeps it in step from then on. It mounts
  // past GLASS_START but only unmounts at or below GLASS_START −
  // GLASS_BLUR_HOLD, so a finger resting or flinging around 150pt does not
  // build and tear down the native blur every frame. (In that 10pt band the
  // blur is invisible: layer opacity 0 on Android, the 0.5 floor on iOS.)
  const [blurMounted, setBlurMounted] = useState(() => scrollY.get() > GLASS_START);
  const blurOn = useSharedValue(blurMounted);
  useAnimatedReaction(
    () => scrollY.value,
    (y) => {
      const on = y > GLASS_START || (blurOn.value && y > GLASS_START - GLASS_BLUR_HOLD);
      if (on !== blurOn.value) {
        blurOn.value = on;
        runOnJS(setBlurMounted)(on);
      }
    },
    [scrollY],
  );
  const tintStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(scrollY.value, [GLASS_START, GLASS_FULL], [0, 1], Extrapolation.CLAMP),
    }),
    [scrollY],
  );

  return (
    <>
      {blurMounted ? <GlassBlur scrollY={scrollY} height={height} blurTarget={blurTarget} /> : null}
      <Animated.View pointerEvents="none" style={[styles.glass, styles.tint, { height }, tintStyle]} />
    </>
  );
}

/**
 * The blur half of the glass, mounted by GlassBarBackground only past
 * GLASS_START. It is its own component so its hooks start WITH it: Reanimated
 * computes `useAnimatedProps`' initial value once, when the hook first runs,
 * and hands it to the view as an ordinary prop on every render — so the
 * native blur is created at the intensity for the current offset (a hair
 * above 0 just past 150pt), never at a value left from an earlier mount, and
 * never without one (expo-blur's own default is 50, a full blur).
 */
function GlassBlur({ scrollY, height, blurTarget }: GlassBarBackgroundProps) {
  const blurProps = useAnimatedProps(
    () => ({
      intensity: Math.max(
        GLASS_MIN_INTENSITY,
        interpolate(scrollY.value, [GLASS_START, GLASS_FULL], [0, GLASS_INTENSITY], Extrapolation.CLAMP),
      ),
    }),
    [scrollY],
  );
  const layerStyle = useAnimatedStyle(
    () => ({
      opacity: FADE_BLUR_LAYER
        ? interpolate(scrollY.value, [GLASS_START, GLASS_START + GLASS_BLUR_ENTRY], [0, 1], Extrapolation.CLAMP)
        : 1,
    }),
    [scrollY],
  );

  return (
    <Animated.View pointerEvents="none" style={[styles.glass, { height }, layerStyle]}>
      <AnimatedBlurView
        blurTarget={blurTarget}
        blurMethod="dimezisBlurViewSdk31Plus"
        tint="dark"
        animatedProps={blurProps}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

interface GlassScrollFeedProps<T extends Component> {
  /** An animated ref (`useAnimatedRef`) on the scroll view or list the bar sits over. */
  scrollRef: AnimatedRef<T>;
  /** The glass's scroll value — `useGlassBar().scrollY`. */
  scrollY: SharedValue<number>;
}

/**
 * Feeds a glass bar's `scrollY` from a scroll view, on the UI thread. For a
 * screen whose list only exists in some states (the loaded one): render this
 * right AFTER that list, in the same branch, so it only ever watches a list
 * that is mounted — useScrollOffset warns about an empty ref. When the list
 * goes away the glass goes back to the top-of-page state with it. A screen
 * whose scroll view is always mounted can call useScrollOffset itself.
 */
export function GlassScrollFeed<T extends Component>({ scrollRef, scrollY }: GlassScrollFeedProps<T>) {
  useScrollOffset(scrollRef, scrollY);
  useEffect(
    () => () => {
      scrollY.value = 0;
    },
    [scrollY],
  );
  return null;
}

/**
 * A bar's measured height (its `onLayout`), starting from an estimate so the
 * first frame is already close. A floating bar is absolutely positioned, so
 * this is the only way a screen learns how much of the page it covers.
 */
export function useMeasuredHeight(estimate: number): [number, (event: LayoutChangeEvent) => void] {
  const [height, setHeight] = useState(estimate);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const measured = Math.round(event.nativeEvent.layout.height);
    if (measured > 0) setHeight((current) => (current === measured ? current : measured));
  }, []);
  return [height, onLayout];
}

export interface GlassBar {
  /** Hand to GlassTarget (`targetRef`) and GlassBarBackground (`blurTarget`). */
  blurTarget: RefObject<View | null>;
  /** Feed it from the page's scroll — e.g. `useScrollOffset(listRef, glass.scrollY)`. */
  scrollY: SharedValue<number>;
  /** The bar's height, safe-area inset included: the glass's height and the page's top padding. */
  barHeight: number;
  /** The bar's `onLayout`. */
  onBarLayout: (event: LayoutChangeEvent) => void;
}

/**
 * Everything one screen needs for its glass bar: the blur target, a scroll
 * value to drive it, and the bar's measured height.
 *
 * @param rowsEstimate The bar's height BELOW the safe-area inset before it has
 *   been measured (default: a pushed screen's 8 + 44pt control row).
 */
export function useGlassBar(rowsEstimate: number = GLASS_BAR_ROW): GlassBar {
  const insets = useSafeAreaInsets();
  const blurTarget = useRef<View>(null);
  const scrollY = useSharedValue(0);
  const [barHeight, onBarLayout] = useMeasuredHeight(insets.top + rowsEstimate);
  return { blurTarget, scrollY, barHeight, onBarLayout };
}

const styles = StyleSheet.create({
  body: { flex: 1, marginTop: StyleSheet.hairlineWidth },
  /** The glass's frame: pinned to the top, full width; the height is the bar's. */
  glass: { position: "absolute", top: 0, left: 0, right: 0 },
  /** The owner's "a little dark" (2026-10-02): the ground at 40% over the blur — never solid. */
  tint: { backgroundColor: theme.colors.glassTint },
});
