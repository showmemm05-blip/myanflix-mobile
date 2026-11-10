import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import {
  AccessibilityInfo,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ViewInstance,
} from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { dockBottomOffset, dockSideInsetFor, theme } from "@/theme";

type Glyph = keyof typeof Ionicons.glyphMap;

/**
 * Filled when chosen, outlined when not. Media has no "play in a rounded
 * square" glyph in Ionicons; `play-circle` is the closest real one. The
 * Lottery is a ticket.
 */
const ICONS: Record<string, { active: Glyph; inactive: Glyph }> = {
  HomeTab: { active: "home", inactive: "home-outline" },
  SearchTab: { active: "play-circle", inactive: "play-circle-outline" },
  LotteryTab: { active: "ticket", inactive: "ticket-outline" },
  WalletTab: { active: "wallet", inactive: "wallet-outline" },
};

/**
 * Four tabs (owner, 2026-10-15): Home · Media · Lottery · Wallet. Profile is
 * not a tab — it opens from the avatar in the top bars.
 */
const ORDER = ["HomeTab", "SearchTab", "LotteryTab", "WalletTab"];

/* ---- the Android blur switch ---- */

/**
 * THE ANDROID BLUR SWITCH. Android only blurs what sits inside a
 * BlurTargetView, so on Android 12 and newer every tab's page is wrapped in
 * one (TabBlurTarget, mounted by MainTabNavigator's `screenLayout`) and the
 * bar blurs the page of the tab that is showing. Set this to `false` and none
 * of that happens on Android: no page is wrapped, no blur is drawn, and the
 * bar wears its solid fill (SOLID_TINT) instead. iOS is not affected either
 * way. It is the one line to change if a phone draws the bar wrong or slows
 * down with it.
 */
const ANDROID_BAR_BLUR = true;

/**
 * Whether the tab pages get blur targets on this phone: Android 12 (API 31)
 * and newer, with the switch above on. Older Android has no cheap blur
 * (expo-blur's "dimezisBlurViewSdk31Plus" falls back to a flat tint there), so
 * it gets the solid fill and no wrappers at all. iOS blurs whatever is behind
 * the bar natively and needs no target, so its pages stay unwrapped too and
 * nothing about their layout changes there.
 */
export const TAB_BLUR_TARGETS = Platform.OS === "android" && ANDROID_BAR_BLUR && Platform.Version >= 31;

/* ---- the glass (Bar4.dc.html, theme dark, mode glass) ---- */

/**
 * The blur's strength (expo-blur's 1–100), fixed. About the drawing's frosted
 * look under the tint below: on iOS this is half of the native dark material;
 * on Android it becomes a radius of 50 ÷ 4 (expo-blur's default reduction).
 * Never 0 while mounted — expo-blur's Android view builds a live blur at
 * whatever value it holds (see GlassBar's GLASS_MIN_INTENSITY).
 */
const BLUR_INTENSITY = 50;
/** Over a real blur: the page shows through, darkened, so the names stay readable over any picture. */
const GLASS_TINT = "rgba(20,20,26,0.55)";
/**
 * Where no blur is drawn (Reduce Transparency, Android older than 12, no
 * target yet, or the switch off): nearly solid, so the page behind cannot
 * fight the names.
 */
const SOLID_TINT = "rgba(26,26,32,0.94)";
/** "Light on top": a soft shine over the upper half, gone by 62% of the height. */
const SHEEN_COLORS = ["rgba(255,255,255,0.16)", "rgba(255,255,255,0.05)", "rgba(255,255,255,0)"] as const;
const SHEEN_STOPS = [0, 0.4, 0.62] as const;
/** The thin bright edge: strongest along the top, faint at the sides and bottom. */
const EDGE_LIGHT =
  "inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -1px 0 rgba(255,255,255,0.08), inset 1px 0 0 rgba(255,255,255,0.10), inset -1px 0 0 rgba(255,255,255,0.10)";
/** "Thin rim": a hairline so the bar has an edge over any picture, white or black. */
const RIM = "rgba(255,255,255,0.22)";
/**
 * "Floating": the soft shadow under the capsule. React Native draws an outset
 * `boxShadow` only OUTSIDE the view's rounded box — Android clips the box out
 * of the shadow (OutsetBoxShadowDrawable, clipOutPath) and iOS masks it out
 * (RCTBoxShadow, an even-odd mask) — so on our see-through glass it never
 * darkens the glass from behind, unlike the old `shadow*`/`elevation`
 * props, which are cast from the view's fill and showed through it. Android
 * older than 9 draws no outset shadow at all.
 */
const FLOAT_SHADOW = "0 14px 34px rgba(0,0,0,0.42), 0 3px 8px rgba(0,0,0,0.28)";

/* ---- the lens (the chosen tab's red glass bubble) ---- */

/** The lens sits this far in from the capsule's top and bottom. */
const LENS_INSET = 4;
/** Fully round ends: half of the lens's 54pt height. */
const LENS_RADIUS = (theme.layout.tabBarHeight - 2 * LENS_INSET) / 2;
/** The crimson `primary` at 40%: a red-tinted glass, not a solid pill. */
const LENS_FILL = "rgba(224,24,31,0.40)";
/**
 * Laid over LENS_FILL while a finger is down, it makes exactly the drawing's
 * pressed 52%: 0.40 + 0.20 × (1 − 0.40) = 0.52. An opacity fade of this layer
 * is cheap on the UI thread, where animating the lens's own colour would make
 * iOS rebuild its three shadow layers on every frame.
 */
const LENS_PRESS_FILL = "rgba(224,24,31,0.20)";
/**
 * The soft white highlight in the lens's upper-left (the drawing's radial
 * light at 30% across the top, as a slanted linear fade).
 */
const LENS_HIGHLIGHT_COLORS = ["rgba(255,255,255,0.26)", "rgba(255,255,255,0)"] as const;
const LENS_HIGHLIGHT_STOPS = [0, 0.62] as const;
const LENS_HIGHLIGHT_START = { x: 0.15, y: 0 };
const LENS_HIGHLIGHT_END = { x: 0.6, y: 1 };
/** A bright line inside the top, a faint shade inside the bottom, and a small drop under it. */
const LENS_SHADOW = "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 1px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.22)";
/** While a finger is down on the chosen tab the lens swells a little. */
const LENS_PRESS_SCALE = 1.06;
/**
 * The glide to a tapped tab: one small overshoot, then rest. Damping ratio
 * 22 ÷ (2√270) ≈ 0.67 overshoots by about 6% (the drawing's
 * cubic-bezier(0.34, 1.4, 0.64, 1) by about 5%), peaks at ~260ms and is
 * within 1% of the tab by ~400ms. The overshoot grows with the distance, as
 * the drawing's does: Home → Wallet swings ~15pt past and the capsule's round
 * end clips it for an instant.
 */
const LENS_SPRING = { mass: 1, stiffness: 270, damping: 22 };
/** The swell and its release: the drawing's 200ms CSS ease-out. */
const LENS_PRESS_TIMING = { duration: 200, easing: Easing.bezier(0, 0, 0.58, 1) };

/* ---- the tabs ---- */

/** The row's inner side padding: four equal columns across what is left. */
const ROW_PADDING = 4;
const ICON_SIZE = 24;
/** Between the icon and its name. */
const LABEL_GAP = 2;
/**
 * Room kept free on each side of a name inside its column, so a long name
 * stays inside the lens's rounded ends instead of touching them.
 */
const LABEL_SIDE = 6;
/** Chosen: white icon and name. */
const INK_CHOSEN = theme.colors.text;
/** Not chosen: a soft white, still clearly readable on the dark glass. */
const INK = "#E6E6EB";
/** The name's size cap under the OS text-size setting. */
const LABEL_MAX_SCALE = 1.3;
/**
 * The names use the type scale's 11pt role (`overline`, 14pt line; ThemedText
 * adds its +4 for Burmese), drawn untracked as in the drawing. Its font size
 * is what a fit shrinks.
 */
const LABEL_FONT_SIZE = theme.type.overline.fontSize;
/**
 * A fitted name aims a hair under its room: glyph advances do not scale
 * perfectly linearly with the font size (hinting, rounding), and a name that
 * comes out a fraction too wide is exactly what an ellipsis is drawn for.
 */
const FIT_SAFETY = 0.96;

/** Four equal columns across the row's inner width; the lens is exactly one wide. */
function columnWidth(barWidth: number): number {
  return Math.max(0, (barWidth - 2 * ROW_PADDING) / ORDER.length);
}

/* ---- blur targets (Android) ---- */

type TargetRef = RefObject<ViewInstance | null>;

/**
 * Which tab pages have a mounted blur target, by route key. One per tab
 * navigator: MainTabNavigator creates it, its `screenLayout` fills it and the
 * bar reads the focused tab's entry from it.
 */
export interface TabBlurTargets {
  get(routeKey: string): TargetRef | undefined;
  /** Adds a mounted target; returns the function that removes it again. */
  register(routeKey: string, ref: TargetRef): () => void;
  subscribe(listener: () => void): () => void;
}

export function createTabBlurTargets(): TabBlurTargets {
  const refs = new Map<string, TargetRef>();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    get: (routeKey) => refs.get(routeKey),
    register(routeKey, ref) {
      refs.set(routeKey, ref);
      notify();
      return () => {
        if (refs.get(routeKey) !== ref) return;
        refs.delete(routeKey);
        notify();
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** For a bar given no registry (iOS needs none): never a target. */
const NO_TARGETS = createTabBlurTargets();

interface TabBlurTargetProps {
  targets: TabBlurTargets;
  routeKey: string;
  children: ReactNode;
}

/**
 * One tab's whole page as the bar's blur target (expo-blur's BlurTargetView),
 * mounted around each tab by MainTabNavigator's `screenLayout` — on Android 12+
 * only (TAB_BLUR_TARGETS). It sits inside the tab's scene, so the bar, which
 * the navigator draws after all the scenes, is never inside the target it
 * blurs (a blur inside its own target would blur itself). The pages' own
 * GlassTarget wrappers for the top bars simply nest inside it.
 *
 * It registers from a LAYOUT effect, which runs after its ref is attached, so
 * the ref is set before anyone can read it, and before any passive effect of
 * the same commit. That registration does NOT re-render the bar by itself:
 * React's useSyncExternalStore subscribes, and takes the new tab's
 * getSnapshot, only in its passive pass, so the notify finds no listener yet
 * (the bar's first mount) or checks the old tab's key. The bar picks the
 * target up in that passive pass. A tab change is a sync update (a tap, and
 * React Navigation's store), so React runs those passive effects and the
 * bar's re-render in the same JS task and React Native draws only the end
 * result: no solid frame. A non-sync update (the bar's first mount, e.g. on
 * a cold start, under the splash) can show the solid fill for a frame first.
 * Either way the bar never mounts its blur before the target exists
 * (expo-blur reads the target once, when the BlurView mounts).
 */
export function TabBlurTarget({ targets, routeKey, children }: TabBlurTargetProps) {
  const ref = useRef<ViewInstance>(null);
  useLayoutEffect(() => targets.register(routeKey, ref), [targets, routeKey]);
  return (
    <BlurTargetView ref={ref} style={styles.target}>
      {children}
    </BlurTargetView>
  );
}

/** The focused tab's blur target, or undefined while it has none. */
function useFocusedTarget(targets: TabBlurTargets, routeKey: string | undefined): TargetRef | undefined {
  return useSyncExternalStore(targets.subscribe, () => (routeKey ? targets.get(routeKey) : undefined));
}

/**
 * Whether the soft keyboard is up. Same events react-navigation's own bar uses
 * for `tabBarHideOnKeyboard`: iOS announces the keyboard before it moves,
 * Android only once it is there.
 */
function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setShown(true));
    const hide = Keyboard.addListener(hideEvent, () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

/**
 * iOS "Reduce Transparency" (Settings → Accessibility → Display & Text Size):
 * read once and followed while the app runs. iOS only: React Native cannot
 * read Android's equivalent (e.g. Samsung One UI's "Reduce transparency and
 * blur") and reports false there, so on Android this stays false.
 */
function useReduceTransparency(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    // A change event is newer than the first read, whichever arrives first.
    let settled = false;
    const subscription = AccessibilityInfo.addEventListener("reduceTransparencyChanged", (value) => {
      settled = true;
      setOn(value);
    });
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((value) => {
        if (!settled) setOn(value);
      })
      .catch(() => {
        // Unknown: keep the glass.
      });
    return () => {
      settled = true;
      subscription.remove();
    };
  }, []);
  return on;
}

interface CustomTabBarProps extends BottomTabBarProps {
  /** The tab pages' blur targets (Android 12+); see TabBlurTarget. */
  blurTargets?: TabBlurTargets;
}

/**
 * THE LIQUID GLASS BAR (owner, 2026-11-10; Bar4.dc.html, dark) — one floating
 * capsule, 62pt tall, 18pt in from the sides (12pt on a window narrower than
 * 360pt) and 8pt above the safe-area bottom inset. It is made of glass: the
 * page behind it blurred and darkened, a shine on its upper half, a bright
 * top edge, a hairline rim and a soft shadow under it. Every tab shows its
 * icon with its name under it; the chosen one sits in a red-tinted glass
 * LENS that glides to the next tab with a small bounce. Four destinations,
 * same `tabPress` contract as react-navigation's own bar (plus its
 * `tabLongPress` event).
 *
 * Where no blur can be drawn — iOS with Reduce Transparency on, Android older
 * than 12, or Android before the tab's blur target exists — the glass becomes
 * a nearly solid dark fill; everything else stays.
 *
 * Scrolling roots clear it with `theme.layout.tabBarClearance` (static,
 * worst-case inset) or `useDockClearance()` (exact for this device).
 */
export function CustomTabBar({ state, navigation, insets, blurTargets }: CustomTabBarProps) {
  const { t } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const side = dockSideInsetFor(windowWidth);
  // The capsule's width: estimated from the window so the lens is in place on
  // the first frame, then measured.
  const [barWidth, setBarWidth] = useState(() => windowWidth - 2 * side);
  const keyboardShown = useKeyboardShown();
  const reduceMotion = useReducedMotion();
  const reduceTransparency = useReduceTransparency();

  const focusedRoute = state.routes[state.index];
  const focusedKey = focusedRoute?.key;
  const target = useFocusedTarget(blurTargets ?? NO_TARGETS, TAB_BLUR_TARGETS ? focusedKey : undefined);
  const drawBlur = Platform.OS === "ios" ? !reduceTransparency : TAB_BLUR_TARGETS && target !== undefined;

  const column = columnWidth(barWidth);
  /**
   * The widest a name may be inside its column. Wider than this (a Burmese
   * name on a 320pt phone, or a large text size), it is set at a smaller font
   * size computed to fit, never wrapped or cut (see TabItem). On a 390pt phone
   * a column is (354 − 8) ÷ 4 = 86.5pt, so a name gets 74.5pt; on a 320pt
   * phone (12pt sides) a column is 72pt and a name gets 60pt.
   */
  const labelRoom = Math.max(0, column - 2 * LABEL_SIDE);
  const lensIndex = focusedRoute ? ORDER.indexOf(focusedRoute.name) : -1;

  // The lens's place in columns (0–3, springing past a little), the column
  // width (the lens's own width, and what its place multiplies), and how far a
  // finger has swollen it (0–1). All three are read on the UI thread only, so
  // the glide and the swell never wait on JS, and the lens's width and place
  // always change together (after a rotation, for one).
  const lensPos = useSharedValue(Math.max(lensIndex, 0));
  const lensColumn = useSharedValue(column);
  const lensPress = useSharedValue(0);

  useEffect(() => {
    if (lensIndex < 0) return;
    lensPos.value = reduceMotion ? lensIndex : withSpring(lensIndex, LENS_SPRING);
    // A new chosen tab starts unswollen, even if a finger was still down on
    // the old one when the tab changed (its release no longer reaches the lens).
    lensPress.value = 0;
  }, [lensIndex, lensPos, lensPress, reduceMotion]);

  const lensStyle = useAnimatedStyle(() => ({
    // Translate first, then scale: the swell stays centred on the lens.
    transform: [
      { translateX: ROW_PADDING + lensPos.value * lensColumn.value },
      { scale: reduceMotion ? 1 : 1 + (LENS_PRESS_SCALE - 1) * lensPress.value },
    ],
  }));
  // A style of its own: width is a layout prop, and in the glide's style it
  // would push every frame of the glide through a full layout pass instead of
  // Reanimated's fast path. Both styles read lensColumn, so when it changes
  // they update in the same UI frame.
  const lensWidthStyle = useAnimatedStyle(() => ({ width: lensColumn.value }));
  const lensPressStyle = useAnimatedStyle(() => ({ opacity: lensPress.value }));

  // Reduce motion: the lens deepens its red under the finger but does not swell.
  const pressLens = useCallback(() => {
    lensPress.value = reduceMotion ? 1 : withTiming(1, LENS_PRESS_TIMING);
  }, [lensPress, reduceMotion]);
  const releaseLens = useCallback(() => {
    lensPress.value = reduceMotion ? 0 : withTiming(0, LENS_PRESS_TIMING);
  }, [lensPress, reduceMotion]);

  const onBarLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      if (width <= 0) return;
      // The lens follows the measurement straight away, on the UI thread,
      // without waiting for the re-render below (which only resizes the
      // names' room). This is the one place the capsule's width changes.
      lensColumn.value = columnWidth(width);
      setBarWidth((current) => (current === width ? current : width));
    },
    [lensColumn],
  );

  const labels: Record<string, string> = {
    HomeTab: t.nav.home,
    SearchTab: t.nav.media,
    LotteryTab: t.nav.lottery,
    WalletTab: t.nav.wallet,
  };

  const goTo = (routeName: string, routeKey: string, focused: boolean) => {
    const event = navigation.emit({ type: "tabPress", target: routeKey, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  const longPress = (routeKey: string) => {
    navigation.emit({ type: "tabLongPress", target: routeKey });
  };

  return (
    <View
      style={[styles.bar, { left: side, right: side, bottom: dockBottomOffset(insets.bottom) }, keyboardShown && styles.barHidden]}
      onLayout={onBarLayout}
      // While the keyboard is up the bar steps aside (react-navigation's
      // `tabBarHideOnKeyboard`, which a custom bar has to do itself): where
      // the window shrinks for the keyboard it would otherwise ride on top of
      // it and cover the field's suggestions. Hidden, not unmounted, so the
      // measured names survive and the lens does not glide in again on return.
      // (Opacity 0 flat, never in between: an iOS blur under a parent that is
      // partly transparent renders broken.)
      pointerEvents={keyboardShown ? "none" : "box-none"}
      accessibilityElementsHidden={keyboardShown}
      importantForAccessibility={keyboardShown ? "no-hide-descendants" : "auto"}
    >
      {/* The glass, back to front, all clipped to the capsule. The float
          shadow lives on the capsule itself (outside this clip) and is drawn
          only outside its box, so it never shows through the glass. */}
      <View style={styles.glass} pointerEvents="none">
        {drawBlur ? (
          // On Android it blurs the FOCUSED tab's page and is remounted when
          // the tab changes (keyed by the route), because expo-blur reads its
          // target once, on mount — kept, it would go on blurring the old tab.
          // iOS ignores the target and the method, and keeps one blur.
          <BlurView
            key={TAB_BLUR_TARGETS ? focusedKey : "glass"}
            intensity={BLUR_INTENSITY}
            tint="dark"
            blurTarget={target}
            blurMethod="dimezisBlurViewSdk31Plus"
            style={styles.blur}
          />
        ) : null}
        <View style={[styles.layer, { backgroundColor: drawBlur ? GLASS_TINT : SOLID_TINT }]} />
        <LinearGradient colors={SHEEN_COLORS} locations={SHEEN_STOPS} style={styles.layer} />
        <View style={styles.edgeLight} />
        <View style={styles.rim} />
        {lensIndex >= 0 ? (
          <Animated.View style={[styles.lens, lensWidthStyle, lensStyle]}>
            <Animated.View style={[styles.layer, styles.lensPressFill, lensPressStyle]} />
            <LinearGradient
              colors={LENS_HIGHLIGHT_COLORS}
              locations={LENS_HIGHLIGHT_STOPS}
              start={LENS_HIGHLIGHT_START}
              end={LENS_HIGHLIGHT_END}
              style={styles.layer}
            />
          </Animated.View>
        ) : null}
      </View>

      <View style={styles.row} accessibilityRole="tablist">
        {ORDER.map((name) => {
          const index = state.routes.findIndex((r) => r.name === name);
          const route = state.routes[index];
          // An empty column keeps the four columns, and so the lens, lined up.
          if (!route) return <View key={name} style={styles.item} />;
          const focused = state.index === index;

          return (
            <TabItem
              key={route.key}
              icons={ICONS[name]}
              label={labels[name]}
              focused={focused}
              labelRoom={labelRoom}
              reduceMotion={reduceMotion}
              onPress={() => goTo(name, route.key, focused)}
              onLongPress={() => longPress(route.key)}
              onPressIn={focused ? pressLens : undefined}
              onPressOut={focused ? releaseLens : undefined}
            />
          );
        })}
      </View>
    </View>
  );
}

interface TabItemProps {
  icons: { active: Glyph; inactive: Glyph };
  label: string;
  focused: boolean;
  /** Room the column gives this name; see CustomTabBar. */
  labelRoom: number;
  reduceMotion: boolean;
  onPress: () => void;
  onLongPress: () => void;
  /** Only the chosen tab's: they swell and release the lens. */
  onPressIn?: () => void;
  onPressOut?: () => void;
}

/**
 * One tab: the whole column is its touch target (62pt tall and a quarter of
 * the bar wide — 86.5pt on a 390pt phone, 72pt on a 320pt one), with the icon
 * over its name. The lens behind the chosen tab is drawn
 * by the bar, not here; a tab that is not chosen keeps the small press shrink
 * it always had (off under reduce motion).
 *
 * A name never wraps or ends in "…". When it is wider than its room, it is
 * SET smaller: its font size is scaled by room ÷ natural width, computed here
 * rather than left to `adjustsFontSizeToFit`, whose floor
 * (`minimumFontScale`) iOS turns into an ellipsis and Android ignores. The
 * natural width is measured in bold, the chosen weight and the wider one, so
 * a name keeps the same size whether its tab is chosen or not.
 */
function TabItem({
  icons,
  label,
  focused,
  labelRoom,
  reduceMotion,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
}: TabItemProps) {
  /** The name's natural one-line width, measured off-flow (see `measure` below). */
  const [naturalWidth, setNaturalWidth] = useState(0);
  /**
   * 1 when the name fits as designed; below 1 it is the share of the design
   * size that fits. The OS text-size factor is already inside `naturalWidth`
   * and is applied again on top of `fontSize`, so the ratio carries straight
   * over to the rendered width.
   */
  const fit = labelRoom > 0 && naturalWidth > labelRoom ? (labelRoom / naturalWidth) * FIT_SAFETY : 1;
  const fittedStyle = fit < 1 ? { fontSize: LABEL_FONT_SIZE * fit } : undefined;
  const ink = focused ? INK_CHOSEN : INK;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.item, pressed && !focused && !reduceMotion && styles.itemPressed]}
    >
      {/* The measuring copy: invisible, outside the flow and inside a box far
          wider than any name, so onLayout reports the name's natural width
          rather than whatever room its column happens to give it. */}
      <View style={styles.measure} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <ThemedText
          variant="overline"
          weight="bold"
          numberOfLines={1}
          maxFontSizeMultiplier={LABEL_MAX_SCALE}
          style={styles.labelType}
          onLayout={(e) => {
            const width = Math.ceil(e.nativeEvent.layout.width);
            if (width !== naturalWidth) setNaturalWidth(width);
          }}
        >
          {label}
        </ThemedText>
      </View>

      <View style={styles.icon}>
        <Ionicons name={focused ? icons.active : icons.inactive} size={ICON_SIZE} color={ink} />
      </View>
      {/* The Pressable already speaks the name; this copy is visual only.
          `adjustsFontSizeToFit` stays only as a backstop for the last
          fraction of a point; the fitted size above does the real work. */}
      <ThemedText
        variant="overline"
        weight={focused ? "bold" : "semibold"}
        color={ink}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        maxFontSizeMultiplier={LABEL_MAX_SCALE}
        importantForAccessibility="no"
        accessibilityElementsHidden
        style={[styles.labelType, styles.label, fittedStyle]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;

const styles = StyleSheet.create({
  /**
   * The capsule: placed by the bar (sides and lift), sized and rounded here.
   * It carries the float shadow and no fill of its own — the fill is the
   * glass inside the clip.
   */
  bar: {
    position: "absolute",
    // Read the token directly — the bar's height has one home, the theme.
    height: theme.layout.tabBarHeight,
    borderRadius: theme.radius.dock,
    boxShadow: FLOAT_SHADOW,
  },
  barHidden: { opacity: 0 },
  /** Keeps every glass layer and the lens inside the capsule's round ends. */
  glass: { ...FILL, borderRadius: theme.radius.dock, overflow: "hidden" },
  /** The blur clips itself too (expo-blur reads the radius from its style on both platforms). */
  blur: { ...FILL, borderRadius: theme.radius.dock },
  layer: FILL,
  edgeLight: { ...FILL, borderRadius: theme.radius.dock, boxShadow: EDGE_LIGHT },
  rim: {
    ...FILL,
    borderRadius: theme.radius.dock,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RIM,
  },
  /**
   * The lens: one column wide and placed by its animated translateX, both
   * from the bar's `lensColumn`. `overflow: hidden` rounds the highlight and the press layer;
   * React Native still draws the lens's own outset shadow outside it.
   */
  lens: {
    position: "absolute",
    left: 0,
    top: LENS_INSET,
    bottom: LENS_INSET,
    borderRadius: LENS_RADIUS,
    backgroundColor: LENS_FILL,
    boxShadow: LENS_SHADOW,
    overflow: "hidden",
  },
  lensPressFill: { backgroundColor: LENS_PRESS_FILL },
  /** Four equal columns (flex: 1 each) across the row's inner width — the lens's grid. */
  row: { ...FILL, flexDirection: "row", paddingHorizontal: ROW_PADDING },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: LABEL_SIDE,
  },
  itemPressed: { transform: [{ scale: 0.96 }] },
  icon: { width: ICON_SIZE, height: ICON_SIZE, alignItems: "center", justifyContent: "center" },
  /** `overline` is tracked for eyebrows; the tab names are not. */
  labelType: { letterSpacing: 0 },
  label: { marginTop: LABEL_GAP, textAlign: "center" },
  /** Wider than any name so the measuring copy is never constrained. */
  measure: { position: "absolute", left: 0, top: 0, width: 600, flexDirection: "row", opacity: 0 },
  /** A tab page's blur target fills its scene exactly as the page did. */
  target: { flex: 1 },
});
