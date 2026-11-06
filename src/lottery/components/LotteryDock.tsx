import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LtIcon, type LtIconName } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { LT_COPY } from "@/lottery/copy";
import { useKeyboardShown } from "@/lottery/hooks/useKeyboardShown";
import type { LotteryTabParamList } from "@/lottery/navigation/types";
import { LT, LT_EASE, LT_LAYOUT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

type TabName = keyof LotteryTabParamList;

/** Home · Draw · Results · Tickets · History (owner, 14 Oct 2026). */
const ORDER: readonly TabName[] = [
  "LotteryHomeTab",
  "LotteryDrawTab",
  "LotteryResultsTab",
  "LotteryTicketsTab",
  "LotteryHistoryTab",
];

const ICONS: Record<TabName, LtIconName> = {
  LotteryHomeTab: "home",
  LotteryDrawTab: "draw",
  LotteryResultsTab: "results",
  LotteryTicketsTab: "tickets",
  LotteryHistoryTab: "history",
};

/** An inactive tab: a 44pt round icon target. */
const ITEM = 44;
const ICON_SIZE = 22;
/** Where the icon sits in an inactive 44pt disc: centred. */
const ICON_REST_LEFT = (ITEM - ICON_SIZE) / 2;
/** Same spring as the app dock: settles in ~300ms without a visible bounce. */
const SPRING = { damping: 22, stiffness: 240, mass: 1 };
/** Extends each target over the capsule's vertical padding. */
const HIT_SLOP = { top: 10, bottom: 10, left: 4, right: 4 };
/** The label's size cap under the OS text-size setting. */
const LABEL_MAX_SCALE = 1.3;
/** A fitted label aims a hair under its room (TabBar explains). */
const FIT_SAFETY = 0.96;
/** lt-base 5b: under 360 wide a tighter pill, so "History" still fits at 320. */
const COMPACT_BELOW = 360;

/** The pill's geometry, regular and compact (lt-base: padding 0 18 0 14 · gap 8 — compact 0 12 0 10 · gap 6). */
function pillGeometry(compact: boolean) {
  const left = compact ? 10 : 14;
  const gap = compact ? 6 : 8;
  const right = compact ? 12 : 18;
  return {
    left,
    right,
    labelLeft: left + ICON_SIZE + gap,
    rowPadding: compact ? 4 : 10,
    fontSize: compact ? 12 : 14,
    lineHeight: compact ? 16 : 18,
  };
}

/**
 * THE LOTTERY DOCK (lt-base 5b): the MyanFlix app dock's SHAPE and BEHAVIOUR —
 * TabBar.tsx's DockItem, off-flow label measuring, fit-by-font-size, spring,
 * hit slop and hide-while-typing, copied rather than shared so the dark
 * dock and this one can never change each other — dressed in Ivory Press:
 * warm-white glass over a light blur, one warm hairline, the dock's paper
 * shadow, ink-3 line icons, and the current tab as a SEAL pill with a white
 * label. Five destinations: Home · Draw · Results · Tickets · History.
 *
 * Fit at 390: 358 capsule − 2 hairline − 20 padding − 4 × 44 discs − 62 pill
 * chrome leaves 98pt for the label; under 360 the compact pill leaves 52 at
 * 320, and a longer label is SET smaller, never truncated.
 *
 * While the keyboard is up it slides down and fades, takes no taps and leaves
 * the reading order (react-navigation's `tabBarHideOnKeyboard`, done by hand
 * as the app dock does). Reduced motion: the pill and the dock snap.
 */
export function LotteryDock({ state, navigation, insets }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const keyboardShown = useKeyboardShown();
  const [rowWidth, setRowWidth] = useState(0);
  const geometry = pillGeometry(width < COMPACT_BELOW);
  const maxLabelWidth =
    rowWidth > 0
      ? rowWidth - 2 * geometry.rowPadding - (ORDER.length - 1) * ITEM - (geometry.labelLeft + geometry.right)
      : Infinity;

  const away = useSharedValue(keyboardShown ? 1 : 0);
  useEffect(() => {
    const target = keyboardShown ? 1 : 0;
    away.value = reduceMotion ? target : withTiming(target, { duration: 240, easing: LT_EASE });
  }, [keyboardShown, reduceMotion, away]);
  const drop = LT_LAYOUT.dockH + LT_LAYOUT.dockLift + insets.bottom;
  const hideStyle = useAnimatedStyle(() => ({
    opacity: 1 - away.value,
    transform: [{ translateY: away.value * drop }],
  }));

  const goTo = (routeName: string, routeKey: string, focused: boolean) => {
    const event = navigation.emit({ type: "tabPress", target: routeKey, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(routeName);
  };

  return (
    <Animated.View
      style={[styles.wrapper, { bottom: insets.bottom + LT_LAYOUT.dockLift }, hideStyle]}
      pointerEvents={keyboardShown ? "none" : "box-none"}
      accessibilityElementsHidden={keyboardShown}
      importantForAccessibility={keyboardShown ? "no-hide-descendants" : "auto"}
    >
      {/* The fill and the shadow live on the capsule (a shadow needs a background to cast from); the blur sits in a clip. */}
      <View style={styles.capsule}>
        <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        </View>
        <View
          style={[styles.row, { paddingHorizontal: geometry.rowPadding }]}
          accessibilityRole="tablist"
          accessibilityLabel={LT_COPY.dockA11y}
          onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
        >
          {ORDER.map((name) => {
            const index = state.routes.findIndex((r) => r.name === name);
            const route = state.routes[index];
            if (!route) return null;
            const focused = state.index === index;
            return (
              <DockItem
                key={route.key}
                icon={ICONS[name]}
                label={LT_COPY.tabs[name]}
                focused={focused}
                maxLabelWidth={maxLabelWidth}
                geometry={geometry}
                onPress={() => goTo(name, route.key, focused)}
                onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              />
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

interface DockItemProps {
  icon: LtIconName;
  label: string;
  focused: boolean;
  maxLabelWidth: number;
  geometry: ReturnType<typeof pillGeometry>;
  onPress: () => void;
  onLongPress: () => void;
}

/**
 * One tab — TabBar's DockItem: the seal pill is ONE view whose width springs
 * between the 44pt disc and icon + label, so the neighbours slide along; a
 * label too wide for a small phone is set at a font size computed to fit
 * (never `adjustsFontSizeToFit` alone, whose floor iOS turns into an ellipsis).
 */
function DockItem({ icon, label, focused, maxLabelWidth, geometry, onPress, onLongPress }: DockItemProps) {
  const reduceMotion = useReducedMotion();
  const [naturalWidth, setNaturalWidth] = useState(0);
  const labelWidth = Math.min(naturalWidth, maxLabelWidth);
  const fit = naturalWidth > maxLabelWidth ? (maxLabelWidth / naturalWidth) * FIT_SAFETY : 1;
  const labelStyle = { fontSize: geometry.fontSize * fit, lineHeight: geometry.lineHeight };
  const progress = useSharedValue(focused ? 1 : 0);
  const openExtra = useSharedValue(0);
  const iconShift = geometry.left - ICON_REST_LEFT;

  useEffect(() => {
    openExtra.value = labelWidth > 0 ? geometry.labelLeft + labelWidth + geometry.right - ITEM : 0;
  }, [labelWidth, geometry.labelLeft, geometry.right, openExtra]);

  useEffect(() => {
    const target = focused ? 1 : 0;
    progress.value = reduceMotion ? target : withSpring(target, SPRING);
  }, [focused, progress, reduceMotion]);

  const pillStyle = useAnimatedStyle(() => ({ width: ITEM + Math.max(progress.value, 0) * openExtra.value }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: Math.min(Math.max(progress.value, 0), 1) }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: iconShift * Math.min(Math.max(progress.value, 0), 1) }],
  }));
  const labelFade = useAnimatedStyle(() => ({ opacity: Math.min(Math.max(progress.value * 1.4 - 0.4, 0), 1) }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.item, pressed && !reduceMotion && styles.itemPressed]}
    >
      {({ pressed }) => (
        <>
          {/* The measuring copy: invisible, off-flow, in a box wider than any label. */}
          <View style={styles.measure} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <LtText
              role="buttonSm"
              numberOfLines={1}
              maxFontSizeMultiplier={LABEL_MAX_SCALE}
              style={{ fontSize: geometry.fontSize, lineHeight: geometry.lineHeight }}
              onLayout={(e) => {
                const measured = Math.ceil(e.nativeEvent.layout.width);
                if (measured !== naturalWidth) setNaturalWidth(measured);
              }}
            >
              {label}
            </LtText>
          </View>

          <Animated.View style={[styles.pill, pillStyle]}>
            {pressed ? (
              <View style={[StyleSheet.absoluteFill, styles.pillRound, { backgroundColor: focused ? LT.sealPress : LT.cream2 }]} />
            ) : (
              <Animated.View style={[StyleSheet.absoluteFill, styles.pillRound, styles.pillFill, fillStyle]} pointerEvents="none" />
            )}
            <Animated.View style={[styles.icon, iconStyle]}>
              <LtIcon name={icon} size={ICON_SIZE} color={focused ? LT.white : pressed ? LT.ink : LT.ink3} />
            </Animated.View>
            {/* The Pressable already speaks the label; this copy is visual only. */}
            <Animated.View
              style={[styles.labelBox, { left: geometry.labelLeft }, labelFade]}
              pointerEvents="none"
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <LtText
                role="buttonSm"
                color={LT.white}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                maxFontSizeMultiplier={LABEL_MAX_SCALE}
                style={[labelStyle, labelWidth > 0 ? { width: labelWidth } : undefined]}
              >
                {label}
              </LtText>
            </Animated.View>
          </Animated.View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: LT_LAYOUT.dockSide,
  },
  capsule: {
    width: "100%",
    maxWidth: LT_LAYOUT.dockMax,
    height: LT_LAYOUT.dockH,
    borderRadius: LT_RADIUS.dock,
    backgroundColor: LT.glass,
    borderWidth: 1,
    borderColor: LT.line,
    boxShadow: LT_SHADOW.dock,
  },
  clip: { borderRadius: LT_RADIUS.dock, overflow: "hidden" },
  /** space-evenly, as the app dock: the free room is shared before, between and after the tabs. */
  row: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-evenly" },
  item: { height: ITEM, justifyContent: "center" },
  itemPressed: { transform: [{ translateY: 1 }] },
  pill: { height: ITEM, borderRadius: ITEM / 2, overflow: "hidden", justifyContent: "center" },
  pillRound: { borderRadius: ITEM / 2 },
  pillFill: { backgroundColor: LT.seal },
  icon: { position: "absolute", left: ICON_REST_LEFT, width: ICON_SIZE, height: ICON_SIZE },
  /** Absolutely placed, so the pill's animated width clips it as it opens. */
  labelBox: { position: "absolute", top: 0, bottom: 0, justifyContent: "center" },
  /** Wider than any label so the measuring copy is never constrained. */
  measure: { position: "absolute", left: 0, top: 0, width: 600, flexDirection: "row", opacity: 0 },
});
