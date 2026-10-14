import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Svg, { Path } from "react-native-svg";
import { theme } from "@/theme";
import {
  BAR,
  BAR_SLIDE_X,
  LETTER_BOXES,
  LETTER_ENTER_X,
  MARK,
  TIMELINE,
  TIMELINE_END,
  WORD_BOX_HEIGHT,
  WORD_BOX_TOP,
  type LetterBox,
} from "./splashGeometry";

/**
 * THE ANIMATED SPLASH (the owner's approved design, 2026-10-12): a full-screen
 * ground-coloured overlay above the app that starts as the native splash's
 * exact frame — the crimson bar alone, centred — and grows into the mark.
 *
 *   0.00 s  the bar, 12 × 48, centred on the window (= the native splash)
 *   0.06 s  it glows once (a soft crimson halo, peak at 0.26 s, gone by
 *           0.56 s) and slides 99.10 pt left to the head of the wordmark
 *   0.26 s  "MyanFlix" slides out from behind it, letter by letter: eight
 *           letters, 0.38 s each, 40 ms apart, from 14 pt left and opacity 0
 *   0.92 s  the mark is complete; it holds
 *   1.55 s  or whenever the app is ready after that, whichever is later: the
 *           whole overlay fades out over 0.32 s and `onFinished` unmounts it
 *
 * No light sweep, no sound (the owner removed the sweep). On a slow start the
 * finished mark simply holds — no spinner. Under the OS "reduce motion"
 * setting the mark appears complete and still, and only the fade remains.
 *
 * THE HANDOFF. App.tsx keeps `SplashScreen.preventAutoHideAsync()` at import,
 * and this overlay hides the native splash from its FIRST layout: at that
 * moment the overlay is on screen with the same pixels the native splash
 * shows (same ground, same bar, same centring on the full window), so the
 * switch is invisible. The native hide is asynchronous on both platforms —
 * iOS removes the launch view on the next main-queue turn, Android draws the
 * app's first frame only once the hide lifts its pre-draw gate (and App.tsx
 * sets the plugin's exit fade to 0 ms, or a ghost of the centred bar would
 * fade out on top of ours while it slides) — so the first `leadIn` ms of the
 * timeline hold still: whichever frame the system swaps on, both sides match.
 *
 * NOT TEXT. The letters are react-native-svg paths taken from the app's own
 * face (splash/wordmarkPaths.ts, Noto Sans Myanmar Black), so the mark never
 * waits for expo-font and never flashes a fallback face. There is no string
 * to translate; the overlay is hidden from screen readers like the native
 * splash before it, and the app bar's wordmark carries the name a moment later.
 *
 * ONE CLOCK. A single shared value runs from 0 to TIMELINE_END on the UI
 * thread and every piece — halo, slide, each letter — derives its own value
 * from it with its own curve, so they are frame-locked to one another and
 * "reduce motion" is simply the clock starting at the end. The fade is a
 * second value, driven by `ready` and the minimum hold on the JS side.
 *
 * Runs on each COLD START only: App.tsx mounts it once per JS runtime (a
 * resume from background never shows it; a full reload is a cold start).
 */

/** The preview's bar curve, cubic-bezier(.2,.9,.2,1): fast out, soft landing, no overshoot. */
const SLIDE_CURVE = Easing.bezierFn(0.2, 0.9, 0.2, 1);
/** The preview's letter curve, cubic-bezier(.2,.8,.2,1) — the boards' `.rise` (FadeInView). */
const LETTER_CURVE = Easing.bezierFn(0.2, 0.8, 0.2, 1);
const HALO_IN_CURVE = Easing.out(Easing.quad);
const HALO_OUT_CURVE = Easing.inOut(Easing.quad);
/** The preview's `markout`: ease-in. */
const EXIT_EASING = Easing.in(Easing.quad);

/**
 * The halo: a soft blur of the brand crimson around the bar's own box, drawn
 * with the view's `boxShadow` (React Native ≥ 0.76, both platforms, no extra
 * package; Android 8 and older draw no outset shadow, so there the bar simply
 * slides without its glow). The preview's 26 px blur beside a 40 px bar,
 * scaled to the 48 pt bar; 2 pt of spread brightens the core.
 */
const HALO_BLUR = 30;
const HALO_SPREAD = 2;
/** `theme.colors.brand` (#E0181F) at 80% — the glow's peak. */
const HALO_COLOR = "rgba(224,24,31,0.8)";

/** 0 before `start`, 1 after `start + duration`, the eased share in between. */
function phase(clockMs: number, start: number, duration: number, curve: (t: number) => number): number {
  "worklet";
  if (clockMs <= start) return 0;
  if (clockMs >= start + duration) return 1;
  return curve((clockMs - start) / duration);
}

interface AnimatedSplashProps {
  /** App.tsx's `isReady` — fonts (loaded or errored), auth bootstrap and language all landed. */
  ready: boolean;
  /** The fade has finished: unmount the overlay. */
  onFinished: () => void;
}

export function AnimatedSplash({ ready, onFinished }: AnimatedSplashProps) {
  // Read once, at mount, as the whole app does (Reanimated's value is the
  // setting as it was when the app started — exactly the cold-start question).
  // Synchronous, so under reduce motion even the FIRST frame is the finished
  // mark; AccessibilityInfo's async answer would land a frame later and move it.
  const reduceMotion = useReducedMotion();
  const clock = useSharedValue(reduceMotion ? TIMELINE_END : 0);
  const exit = useSharedValue(0);
  const started = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holdDone, setHoldDone] = useState(false);
  const [exiting, setExiting] = useState(false);

  // The fade's completion arrives from the UI thread; it must reach whatever
  // `onFinished` App.tsx holds by then, not the one captured at the start.
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);
  const finish = useCallback(() => onFinishedRef.current(), []);

  /**
   * The first layout is the handoff (see the header): hide the native splash,
   * start the clock, start the minimum hold. `onLayout` fires again on a
   * rotation — the guard keeps all three to the first one.
   */
  const handleLayout = useCallback(() => {
    if (started.current) return;
    started.current = true;
    SplashScreen.hideAsync().catch(() => {});
    if (!reduceMotion) {
      clock.value = withTiming(TIMELINE_END, {
        duration: TIMELINE_END,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      });
    }
    holdTimer.current = setTimeout(() => setHoldDone(true), TIMELINE.minHold);
  }, [clock, reduceMotion]);

  // The exit: the later of the minimum hold and the app being ready. The app
  // tree is already mounted under the overlay by the time `ready` is true
  // (App.tsx renders it in the same commit), so the fade reveals a drawn
  // screen. ReduceMotion.Never on purpose: a cross-fade is not motion, and
  // Reanimated's System default would otherwise cut it to nothing.
  useEffect(() => {
    if (!holdDone || !ready || exiting) return;
    setExiting(true);
    exit.value = withTiming(
      1,
      { duration: TIMELINE.exit, easing: EXIT_EASING, reduceMotion: ReduceMotion.Never },
      (finished) => {
        "worklet";
        if (finished) scheduleOnRN(finish);
      },
    );
  }, [holdDone, ready, exiting, exit, finish]);

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      cancelAnimation(clock);
      cancelAnimation(exit);
    },
    [clock, exit],
  );

  const overlayStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: BAR_SLIDE_X * phase(clock.value, TIMELINE.leadIn, TIMELINE.slide, SLIDE_CURVE) }],
  }));
  const haloStyle = useAnimatedStyle(() => {
    const t = clock.value;
    const up = phase(t, TIMELINE.leadIn, TIMELINE.haloIn, HALO_IN_CURVE);
    const down = phase(t, TIMELINE.leadIn + TIMELINE.haloIn, TIMELINE.haloOut, HALO_OUT_CURVE);
    return { opacity: up - down };
  });

  return (
    <Animated.View
      style={[styles.overlay, overlayStyle]}
      onLayout={handleLayout}
      // Swallows every touch while it is the thing on screen; lets them
      // through to the app the moment the fade starts.
      pointerEvents={exiting ? "none" : "auto"}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* The word, in its finished place inside the centred mark box. Rendered
          first so the bar and its halo pass OVER the letters as they emerge. */}
      <View style={styles.centre}>
        <View style={styles.mark}>
          {LETTER_BOXES.map((box, index) => (
            <Letter key={box.letter.char + index} box={box} index={index} clock={clock} />
          ))}
        </View>
      </View>
      {/* The bar, centred on the full window by layout alone — no measuring,
          no transform at frame 0, the same centring the native splash uses —
          then slid left by the window-independent BAR_SLIDE_X. */}
      <View style={styles.centre}>
        <Animated.View style={[styles.barBox, barStyle]}>
          <Animated.View style={[styles.halo, haloStyle]} />
          <View style={styles.bar} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/**
 * One letter: an <Svg> exactly its ink box, at its advance-width place, that
 * fades in while sliding right from 14 pt behind on its own slot of the clock.
 */
function Letter({ box, index, clock }: { box: LetterBox; index: number; clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = phase(
      clock.value,
      TIMELINE.lettersFrom + index * TIMELINE.letterStagger,
      TIMELINE.letter,
      LETTER_CURVE,
    );
    return { opacity: p, transform: [{ translateX: LETTER_ENTER_X * (1 - p) }] };
  });
  return (
    <Animated.View style={[styles.letter, { left: box.left, width: box.width }, style]}>
      <Svg width={box.width} height={WORD_BOX_HEIGHT} viewBox={box.viewBox}>
        <Path d={box.letter.d} fill={theme.colors.text} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /** Above everything App.tsx renders beside it; the app's own ground. */
  overlay: { ...StyleSheet.absoluteFill, zIndex: 1, backgroundColor: theme.colors.background },
  centre: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  /** The finished mark's box: 210.20 × 48, centred — bar at its left, the word's ink to its right edge. */
  mark: { width: MARK.width, height: MARK.height },
  letter: { position: "absolute", top: WORD_BOX_TOP, height: WORD_BOX_HEIGHT },
  barBox: { width: BAR.width, height: BAR.height },
  /** The same crimson as the app bar's mark (`logoMark`). */
  bar: { ...StyleSheet.absoluteFill, borderRadius: BAR.radius, backgroundColor: theme.colors.brand },
  halo: {
    ...StyleSheet.absoluteFill,
    borderRadius: BAR.radius,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: HALO_BLUR, spreadDistance: HALO_SPREAD, color: HALO_COLOR }],
  },
});
