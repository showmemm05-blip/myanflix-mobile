import { memo, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { AUTH_EASING } from "@/components/auth/AuthParts";
import { theme, withAlpha } from "@/theme";

/**
 * The sign-in brand moment (Login.dc.html): ONE static drawing — a dusk sky,
 * a low sun, stupa silhouettes and a toddy palm — under two scrims, with the
 * wordmark top-left and the screen's own title block at the bottom.
 *
 * Owner decision: AuthScreenShell dropped the old 11-layer poster marquee for
 * cold-start speed. This is one small SVG of eleven flat shapes, no images,
 * no network, no blur — far cheaper than that marquee, and it never moves
 * except for a single 700ms settle on mount (none under reduce motion).
 *
 * Its palette is illustration colour (like SubscribeArt's stage), not UI
 * tokens. `muted` is SessionOffline's desaturated take (saturate .35 + a 30%
 * dark veil), precomputed instead of filtered.
 */
const ART = {
  sky: "#2A1B3D",
  sun: "#F2B66D",
  hills: "#3B2752",
  ground: "#140C1E",
} as const;
const ART_MUTED = {
  sky: "#241F2B",
  sun: "#D0BBA1",
  hills: "#332C3B",
  ground: "#110E14",
} as const;

/** The board's frame (390 × 844). Hero heights below are read off it. */
const BOARD_HEIGHT = 844;
/** Never scale the art below this share of the board on a short phone. */
const MIN_SCALE = 0.62;

/**
 * Board heights per use, before the status-bar inset is added on top:
 * Login's phone step 404, every later sign-in step 248, the reset "done"
 * screen 360, SessionOffline 460. On a phone shorter than the board they
 * shrink with the screen, so a 568pt phone still shows its field and button.
 */
export const HERO_HEIGHT = { tall: 404, short: 248, done: 360, offline: 460 } as const;
export type HeroSize = keyof typeof HERO_HEIGHT;

function subscribeToScreenMetrics(onChange: () => void): () => void {
  // Fires on rotation and other configuration changes — exactly when the
  // screen's own height really changes.
  const subscription = Dimensions.addEventListener("change", onChange);
  return () => subscription.remove();
}

/**
 * SCREEN height, deliberately — NOT `useWindowDimensions()`. app.json keeps
 * Expo's default "resize" keyboard mode, so Android shrinks the WINDOW when
 * the number pad opens; keyed off the window, the hero would collapse the
 * moment a field was focused and spring back when the keyboard closed. The
 * screen's own metrics are untouched by the keyboard; a rotation moves them
 * and the "change" event delivers it. The snapshot is a rounded number, so a
 * metrics event that changes nothing re-renders nothing.
 */
function screenScale(): number {
  const ratio = Dimensions.get("screen").height / BOARD_HEIGHT;
  return Math.round(Math.min(1, Math.max(MIN_SCALE, ratio)) * 100) / 100;
}

function useHeroScale(): number {
  return useSyncExternalStore(subscribeToScreenMetrics, screenScale);
}

interface Props {
  size: HeroSize;
  /** SessionOffline: the same drawing, drained of colour. */
  muted?: boolean;
  /** The block pinned to the hero's bottom edge (rail + title, a badge…). */
  children?: ReactNode;
}

/**
 * The hero is a MIN height, not a height: the bottom block is laid out in
 * flow, so a long Burmese title at font scale 2.0 grows the hero instead of
 * climbing over the wordmark. Moving between Login's tall phone step and its
 * shorter later steps animates that floor over 320ms (instant under reduce
 * motion).
 */
export function AuthHero({ size, muted, children }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const scale = useHeroScale();
  const target = Math.round(HERO_HEIGHT[size] * scale) + insets.top;

  const minHeight = useSharedValue(target);
  useEffect(() => {
    minHeight.value = reduceMotion ? target : withTiming(target, { duration: 320, easing: AUTH_EASING });
  }, [target, minHeight, reduceMotion]);
  const heightStyle = useAnimatedStyle(() => ({ minHeight: minHeight.value }));

  return (
    <Animated.View style={[styles.hero, heightStyle]}>
      <HeroArt muted={!!muted} />
      <View style={[styles.wordmarkRow, { paddingTop: insets.top + 18 }]}>
        <Wordmark />
      </View>
      <View style={styles.grow} />
      <View style={styles.bottom}>{children}</View>
    </Animated.View>
  );
}

/** The 6×24 crimson bar + "MyanFlix" in 22/28 black — the app bar's wordmark. */
function Wordmark() {
  const { t } = useLanguage();
  return (
    <View style={styles.wordmark}>
      <View style={styles.wordmarkBar} />
      <ThemedText weight="black" color={theme.colors.text} style={styles.wordmarkText}>
        {t.common.appName}
      </ThemedText>
    </View>
  );
}

/**
 * The drawing and its scrims. Memoised — nothing about it depends on the step,
 * so a keystroke or a step change never re-renders eleven SVG nodes.
 * Decorative: hidden from screen readers.
 */
const HeroArt = memo(function HeroArt({ muted }: { muted: boolean }) {
  const reduceMotion = useReducedMotion();
  const palette = muted ? ART_MUTED : ART;
  // .open: settle from 40% and 1.06× to rest, once, on mount.
  const settle = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    // Once per screen: from 1 (already settled) the timing is a no-op.
    settle.value = reduceMotion ? 1 : withTiming(1, { duration: 700, easing: AUTH_EASING });
  }, [settle, reduceMotion]);
  const settleStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + 0.6 * settle.value,
    transform: [{ scale: 1.06 - 0.06 * settle.value }],
  }));

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: palette.sky }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[StyleSheet.absoluteFill, settleStyle]}>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 404" preserveAspectRatio="xMidYMid slice">
          <Rect width={390} height={404} fill={palette.sky} />
          <Circle cx={284} cy={128} r={118} fill={palette.sun} opacity={0.12} />
          <Circle cx={284} cy={128} r={46} fill={palette.sun} />
          <Circle cx={52} cy={70} r={1.6} fill={palette.sun} opacity={0.7} />
          <Circle cx={128} cy={44} r={1.2} fill={palette.sun} opacity={0.6} />
          <Circle cx={176} cy={96} r={1.4} fill={palette.sun} opacity={0.5} />
          <Path d="M0 270 C70 242 140 260 210 238 C270 220 330 232 390 216 V404 H0 Z" fill={palette.hills} />
          <Path
            d="M68 262 H124 L118 251 H74 Z M80 251 C80 230 112 230 112 251 Z M93 236 L96 194 L99 236 Z M174 244 H206 L202 237 H178 Z M182 237 C182 224 198 224 198 237 Z M188.5 228 L190 204 L191.5 228 Z"
            fill={palette.hills}
          />
          <Path d="M0 334 C80 320 160 330 240 316 C300 306 350 312 390 304 V404 H0 Z" fill={palette.ground} />
          <Path
            d="M248 318 H352 L342 302 H258 Z M266 302 H334 L326 290 H274 Z M280 290 C280 252 320 252 320 290 Z M296 262 L300 186 L304 262 Z"
            fill={palette.ground}
          />
          <Path
            d="M40 336 L47 336 L61 262 L57 262 Z M59 263 C44 250 30 252 18 264 C33 257 46 259 58 266 Z M59 263 C70 248 86 247 98 254 C84 252 71 256 60 266 Z M59 263 C55 246 46 238 34 236 C47 243 54 252 57 266 Z M59 263 C66 249 77 241 89 239 C78 246 68 254 61 266 Z"
            fill={palette.ground}
          />
          <Rect y={300} width={390} height={104} fill={theme.colors.background} opacity={0.35} />
        </Svg>
      </Animated.View>
      {muted ? <View style={[StyleSheet.absoluteFill, styles.veil]} /> : null}
      <LinearGradient colors={TOP_SCRIM} style={styles.topScrim} />
      <LinearGradient colors={BOTTOM_SCRIM} locations={BOTTOM_STOPS} style={styles.bottomScrim} />
    </View>
  );
});

/** Keeps the wordmark legible on the sky. */
const TOP_SCRIM = [withAlpha(theme.colors.background, 0.72), withAlpha(theme.colors.background, 0)] as const;
/** Dissolves the art into the page so the title block reads on it. */
const BOTTOM_SCRIM = [
  withAlpha(theme.colors.background, 0),
  withAlpha(theme.colors.background, 0.84),
  theme.colors.background,
] as const;
const BOTTOM_STOPS = [0, 0.58, 1] as const;

const styles = StyleSheet.create({
  hero: { overflow: "hidden", backgroundColor: theme.colors.background },
  wordmarkRow: { paddingHorizontal: theme.layout.screenPadding },
  wordmark: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  wordmarkBar: { width: 6, height: 24, borderRadius: 2, backgroundColor: theme.colors.brand },
  wordmarkText: { fontSize: 22, lineHeight: 28, letterSpacing: -0.66 },
  /** Air between the wordmark and the bottom block, however tall either grows. */
  grow: { flexGrow: 1, minHeight: theme.spacing.lg },
  bottom: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: 14 },
  veil: { backgroundColor: withAlpha(theme.colors.background, 0.3) },
  topScrim: { position: "absolute", left: 0, right: 0, top: 0, height: 120 },
  bottomScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "72%" },
});
