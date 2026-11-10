import { useCallback, useEffect, useRef, useState, type Component, type ReactNode, type RefObject } from "react";
import {
  Platform,
  StyleSheet,
  type LayoutChangeEvent,
  type ScrollViewInstance,
  type StyleProp,
  type ViewInstance,
  type ViewStyle,
} from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
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
import { useReduceTransparency } from "@/hooks/useReduceTransparency";
import { theme, withAlpha } from "@/theme";

/**
 * THE TOP BAR'S SCROLL-EDGE FADE — one recipe for every navbar (the owner,
 * 2026-10-02: "can you make glass effect for all navbar"; since 2026-11-10
 * the Liquid Glass top of the canvas page "Top bar": "every page build it i
 * like it").
 *
 * The bar itself is clear: its controls are their own glass buttons
 * (components/layout/GlassFace) and its headings plain text. There is NO
 * full-width frosted block behind it any more. The page is untouched at the
 * top; as it scrolls, a soft SCROLL-EDGE FADE comes in behind the bar between
 * GLASS_START and GLASS_FULL points of scroll, and goes back out on the way
 * up. The fade is the ground colour at 80% along the top edge, 50% a little
 * past half way and gone at its bottom edge, FADE_TAIL points below the bar's
 * last row, with a light blur behind the bar's rows. Never a solid bar: the
 * owner does not want black bars. Scroll-linked on the UI thread, not timed,
 * so it simply follows the finger under reduce motion.
 *
 * THE BLUR IS KEPT TO THE BAR'S OWN ROWS. The board blurs the whole fade and
 * lets the blur thin out with it (a masked, "progressive" blur). Nothing
 * installed can draw that: expo-blur 58 has no mask or variable blur, React
 * Native 0.88 has no backdrop-filter or mask-image (its `filter: blur()`
 * blurs a view's OWN content, not what is behind it), react-native-svg
 * cannot mask a native blur view, and there is no Skia or MaskedView in the
 * app. Stacked bands of weaker blur would fake it, but on Android every band
 * is another full-page blur pass. So the blur is drawn UNDER the gradient and
 * stops at the gradient's 50% stop (FADE_STOPS[1] of the fade's height), not
 * at the bar's bottom: expo-blur's "dark" tint darkens as well as softens, so
 * where the gradient is already thin (about 25% on a one-row bar, down to
 * about 11% on the tallest) the blur's straight lower edge showed as a line
 * across the page (review A1, 2026-11-10). At the 50% stop the gradient hides
 * it, and the blur is kept light (FADE_BLUR_INTENSITY) so the step is small.
 * The rows below the cut lose nothing: their controls are glass buttons that
 * carry their own blur (iOS), or solid pills.
 *
 * How a screen uses it (read https://docs.expo.dev/versions/v58.0.0/sdk/blur-view/):
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
 *   goes inside GlassTarget and the fade is rendered AFTER it, never inside
 *   it (a blur that sits in its own target would blur itself). On iOS the
 *   target is a plain View and the BlurView blurs whatever is under it.
 * - Keep GlassTarget mounted for the screen's whole life, wrapping whatever
 *   state the body is in (loading, error, list): expo-blur reads the target
 *   once, when the BlurView mounts, and never notices a re-mounted target.
 * - ONE GlassTarget per screen and one fade per bar. Never a blur inside a
 *   list row.
 * - ANDROID: the fade's blur is the ONLY Android blur at the top of a page
 *   (ANDROID_TOP_BLUR below); the glass buttons never blur there
 *   (GlassFace). Android 11 and older, and the switch off, get the gradient
 *   alone, which still fades in.
 * - iOS with Reduce Transparency: the gradient alone, no blur.
 * - The BlurView itself only EXISTS past GLASS_START (see GlassBarBackground).
 *   At the top of a page there is no blur view at all, so nothing native can
 *   draw glass there — not even on a screen that has just opened.
 */

/**
 * Nothing behind the bar until the page has scrolled this far (pt)… The
 * owner approved 24pt on the "Top bar" board (2026-11-10). It replaces the
 * 2026-10-05 rule "not as soon as the page moves — 150pt first" (with full
 * glass at 250pt), which belonged to the old full-width frosted block.
 */
export const GLASS_START = 24;
/** …and the full fade from here on (pt): a 60pt ramp (the same board). */
export const GLASS_FULL = 84;
/** How far the fade reaches below the bar's last row (pt) — the board's 32. */
export const FADE_TAIL = 32;
/** The board's fade: the ground at 80% at the top, 50% at 55% of the way down, gone at the bottom. */
const FADE_COLORS = [
  withAlpha(theme.colors.background, 0.8),
  withAlpha(theme.colors.background, 0.5),
  withAlpha(theme.colors.background, 0),
] as const;
const FADE_STOPS = [0, 0.55, 1] as const;
/**
 * The light blur behind the top of the fade at the full fade (expo-blur's
 * 1–100). Well under the glass buttons' 50 (the board's 10px against 20px),
 * and lowered from 25 to 15 in review (A1): expo-blur's dark tint grows with
 * it, and that tint is what made the blur's lower edge show.
 */
const FADE_BLUR_INTENSITY = 15;
/** A pushed screen's bar before it has been measured: 8pt + the 44pt control row under the inset. */
export const GLASS_BAR_ROW = theme.spacing.sm + theme.layout.minTouch;

/**
 * THE ANDROID TOP BLUR SWITCH — the one Android blur at the top of a page
 * (the bottom bar has its own, ANDROID_BAR_BLUR in TabBar.tsx). On Android 12
 * and newer the fade blurs the page through the screen's GlassTarget. That is
 * costly: Dimezis re-renders the whole GlassTarget page into a bitmap on every
 * frame for each BlurView, and since the fade starts at 24pt the blur is on
 * almost the whole time a page is scrolled. It is also why the glass buttons
 * never blur on Android (each would be another full-page render per frame).
 * Set this to `false` if a phone stutters while scrolling under the top bar
 * or draws the fade wrong: Android then draws the fade's gradient alone. iOS
 * is not affected either way.
 */
const ANDROID_TOP_BLUR = true;

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
 * with the fade instead of popping on at 24pt, and hides the floor above
 * while the blur is still mounted below 24pt on the way back up (see
 * GLASS_BLUR_HOLD). iOS keeps opacity 1: a UIVisualEffectView under a parent
 * with alpha < 1 renders broken.
 */
const GLASS_BLUR_ENTRY = 20;
const FADE_BLUR_LAYER = Platform.OS === "android";
/**
 * Hysteresis (pt): the blur mounts past GLASS_START but stays mounted until
 * the page is back at or below GLASS_START − this (14pt), so jitter around
 * 24pt does not create and destroy the native blur over and over.
 */
const GLASS_BLUR_HOLD = 10;

/** Reanimated drives the blur's `intensity` (expo-blur supports animating it). */
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

interface GlassTargetProps {
  /** The ref GlassBarBackground blurs — from `useGlassBar()` / `useRef<ViewInstance>(null)`. */
  targetRef: RefObject<ViewInstance | null>;
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
  /** The page's scroll offset (pt). The fade comes in from GLASS_START to GLASS_FULL. */
  scrollY: SharedValue<number>;
  /**
   * How tall the bar is, safe-area inset included: the fade's gradient
   * covers that plus FADE_TAIL, and its blur the top FADE_STOPS[1] of it.
   */
  height: number;
  /** The GlassTarget's ref: what the fade's blur blurs on Android. */
  blurTarget: RefObject<ViewInstance | null>;
}

/**
 * The scroll-edge fade itself: a light blur down to the gradient's 50% stop,
 * under a gradient that reaches FADE_TAIL below the bar, both pinned to the top of the
 * screen and both at zero at the top of the page. Render it AFTER the
 * GlassTarget and BEFORE the bar. It never takes a touch and has nothing to
 * read aloud.
 *
 * The gradient is always mounted (its opacity is 0 up to GLASS_START). The
 * blur is drawn only where it can be (iOS without Reduce Transparency;
 * Android 12+ with ANDROID_TOP_BLUR on), and MOUNTED only once the page is
 * past GLASS_START (and unmounted again at GLASS_START − GLASS_BLUR_HOLD): a
 * UI-thread reaction mirrors that into React state, and near the top there is
 * no BlurView at all — so whatever expo-blur's native view does on creation,
 * a page at its top (a screen that has just opened, like Profile) cannot show
 * glass. Android 11 and older never mount it: expo-blur would draw its flat
 * "none" tint there, a hard-edged rectangle under the gradient.
 */
export function GlassBarBackground({ scrollY, height, blurTarget }: GlassBarBackgroundProps) {
  const reduceTransparency = useReduceTransparency();
  const drawBlur =
    Platform.OS === "ios" ? !reduceTransparency : ANDROID_TOP_BLUR && Platform.OS === "android" && Platform.Version >= 31;
  // Seeded from the page's current offset (a first-render read, which
  // Reanimated allows) so a screen that mounts already scrolled has its blur
  // on the first frame; the reaction keeps it in step from then on. It mounts
  // past GLASS_START but only unmounts at or below GLASS_START −
  // GLASS_BLUR_HOLD, so a finger resting or flinging around 24pt does not
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
  const fadeStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(scrollY.value, [GLASS_START, GLASS_FULL], [0, 1], Extrapolation.CLAMP),
    }),
    [scrollY],
  );

  return (
    <>
      {/* The blur first, so the gradient lies over it; it ends at the gradient's 50% stop, where the gradient hides its lower edge. */}
      {drawBlur && blurMounted ? <GlassBlur scrollY={scrollY} height={height} blurTarget={blurTarget} /> : null}
      <Animated.View pointerEvents="none" style={[styles.glass, { height: height + FADE_TAIL }, fadeStyle]}>
        <LinearGradient colors={FADE_COLORS} locations={FADE_STOPS} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </>
  );
}

/**
 * The blur half of the fade, mounted by GlassBarBackground only past
 * GLASS_START. It is its own component so its hooks start WITH it: Reanimated
 * computes `useAnimatedProps`' initial value once, when the hook first runs,
 * and hands it to the view as an ordinary prop on every render — so the
 * native blur is created at the intensity for the current offset (a hair
 * above 0 just past 24pt), never at a value left from an earlier mount, and
 * never without one (expo-blur's own default is 50, a full blur).
 */
function GlassBlur({ scrollY, height, blurTarget }: GlassBarBackgroundProps) {
  const blurProps = useAnimatedProps(
    () => ({
      intensity: Math.max(
        GLASS_MIN_INTENSITY,
        interpolate(scrollY.value, [GLASS_START, GLASS_FULL], [0, FADE_BLUR_INTENSITY], Extrapolation.CLAMP),
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
    <Animated.View
      pointerEvents="none"
      style={[styles.glass, { height: Math.min(height, Math.round(FADE_STOPS[1] * (height + FADE_TAIL))) }, layerStyle]}
    >
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

interface GlassScrollFeedProps<T extends Component | ScrollViewInstance> {
  /** An animated ref (`useAnimatedRef`) on the scroll view or list the bar sits over. */
  scrollRef: AnimatedRef<T>;
  /** The fade's scroll value — `useGlassBar().scrollY`. */
  scrollY: SharedValue<number>;
}

/**
 * Feeds a glass bar's `scrollY` from a scroll view, on the UI thread. For a
 * screen whose list only exists in some states (the loaded one): render this
 * right AFTER that list, in the same branch, so it only ever watches a list
 * that is mounted — useScrollOffset warns about an empty ref. When the list
 * goes away the fade goes back to the top-of-page state with it. A screen
 * whose scroll view is always mounted can call useScrollOffset itself.
 */
export function GlassScrollFeed<T extends Component | ScrollViewInstance>({ scrollRef, scrollY }: GlassScrollFeedProps<T>) {
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
  blurTarget: RefObject<ViewInstance | null>;
  /** Feed it from the page's scroll — e.g. `useScrollOffset(listRef, glass.scrollY)`. */
  scrollY: SharedValue<number>;
  /** The bar's height, safe-area inset included: what the fade is sized from, and the page's top padding. */
  barHeight: number;
  /** The bar's `onLayout`. */
  onBarLayout: (event: LayoutChangeEvent) => void;
}

/**
 * Everything one screen needs for its glass bar's fade: the blur target, a
 * scroll value to drive it, and the bar's measured height.
 *
 * @param rowsEstimate The bar's height BELOW the safe-area inset before it has
 *   been measured (default: a pushed screen's 8 + 44pt control row).
 */
export function useGlassBar(rowsEstimate: number = GLASS_BAR_ROW): GlassBar {
  const insets = useSafeAreaInsets();
  const blurTarget = useRef<ViewInstance>(null);
  const scrollY = useSharedValue(0);
  const [barHeight, onBarLayout] = useMeasuredHeight(insets.top + rowsEstimate);
  return { blurTarget, scrollY, barHeight, onBarLayout };
}

const styles = StyleSheet.create({
  body: { flex: 1, marginTop: StyleSheet.hairlineWidth },
  /** The fade's frame: pinned to the top, full width; the height is the bar's (the gradient adds FADE_TAIL). */
  glass: { position: "absolute", top: 0, left: 0, right: 0 },
});
