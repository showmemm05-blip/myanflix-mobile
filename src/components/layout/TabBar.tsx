import { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { dockBottomOffset, theme } from "@/theme";

type Glyph = keyof typeof Ionicons.glyphMap;

/**
 * Filled when active, outlined when not. Media has no "play in a rounded
 * square" glyph in Ionicons; `play-circle` is the closest real one.
 */
const ICONS: Record<string, { active: Glyph; inactive: Glyph }> = {
  HomeTab: { active: "home", inactive: "home-outline" },
  SearchTab: { active: "play-circle", inactive: "play-circle-outline" },
  WalletTab: { active: "wallet", inactive: "wallet-outline" },
};

/**
 * Three tabs (owner, 2026-10-07): Home · Media · Wallet. Profile is not a tab
 * — it opens from the avatar in the top bars.
 */
const ORDER = ["HomeTab", "SearchTab", "WalletTab"];

/** An inactive tab: a 44pt round icon target. */
const ITEM = 44;
const ICON_SIZE = 22;
/** The active pill's insets around icon + label (DesignSystem: padding 0 18 0 14, gap 8). */
const PILL_LEFT = 14;
const PILL_GAP = 8;
const PILL_RIGHT = 18;
/** Where the icon sits in an inactive 44pt disc: centred. */
const ICON_REST_LEFT = (ITEM - ICON_SIZE) / 2;
/** Where the label starts inside the open pill. */
const LABEL_LEFT = PILL_LEFT + ICON_SIZE + PILL_GAP;
/**
 * Spring for the pill opening: a little life, settles in ~300ms without a
 * visible bounce (damping ratio ≈ 0.71).
 */
const SPRING = { damping: 22, stiffness: 240, mass: 1 };
/** Extends each target over the dock's 10pt vertical padding. */
const HIT_SLOP = { top: 10, bottom: 10, left: 4, right: 4 };
/** The capsule's inner side padding (DesignSystem: padding 0 10px). */
const ROW_PADDING = 10;
/** The label's size cap under the OS text-size setting. */
const LABEL_MAX_SCALE = 1.3;
/** The label's role in the type scale; its font size is what a fit shrinks. */
const LABEL_FONT_SIZE = theme.type.muted.fontSize;
/**
 * A fitted label aims a hair under its room: glyph advances do not scale
 * perfectly linearly with the font size (hinting, rounding), and a label that
 * comes out a fraction too wide is exactly what an ellipsis is drawn for.
 */
const FIT_SAFETY = 0.96;

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
 * The Marquee DOCK — one floating capsule 16pt in from the sides and 20pt above
 * the safe-area bottom inset. The active tab grows into a crimson pill that
 * carries its label; the others are 44pt icon buttons whose names are spoken,
 * not shown. Three destinations, same `tabPress` contract as react-navigation's
 * own bar (plus its `tabLongPress` event).
 *
 * Scrolling roots clear it with `theme.layout.tabBarClearance` (static,
 * worst-case inset) or `useDockClearance()` (exact for this device).
 */
export function CustomTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { t } = useLanguage();
  const [rowWidth, setRowWidth] = useState(0);
  const keyboardShown = useKeyboardShown();
  /**
   * The widest a label may be before the open pill would push its
   * neighbours out of the capsule: the row's inner width, minus the other
   * tabs' 44pt discs, minus the pill's own chrome. No gap is reserved between
   * items — `space-evenly` spreads whatever is left, and at the limit the
   * pill meets a 44pt disc whose icon still sits 11pt in from its edge. Wider
   * than this (a small phone at a large text size), the label is set at a
   * smaller font size computed to fit, never truncated (see DockItem).
   * With three tabs a 320pt phone leaves 118pt here, so every label fits.
   */
  const maxLabelWidth =
    rowWidth > 0 ? rowWidth - 2 * ROW_PADDING - (ORDER.length - 1) * ITEM - (LABEL_LEFT + PILL_RIGHT) : Infinity;

  const labels: Record<string, string> = {
    HomeTab: t.nav.home,
    SearchTab: t.nav.media,
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
      style={[styles.wrapper, { bottom: dockBottomOffset(insets.bottom) }, keyboardShown && styles.wrapperHidden]}
      // While the keyboard is up the dock steps aside (react-navigation's
      // `tabBarHideOnKeyboard`, which a custom bar has to do itself): where
      // the window shrinks for the keyboard it would otherwise ride on top of
      // it and cover the field's suggestions. Hidden, not unmounted, so the
      // measured labels survive and the pill does not re-open on return.
      pointerEvents={keyboardShown ? "none" : "box-none"}
      accessibilityElementsHidden={keyboardShown}
      importantForAccessibility={keyboardShown ? "no-hide-descendants" : "auto"}
    >
      {/* The dock fill lives on the capsule itself, not only inside the clip:
          an Android elevation shadow is cast from the view's own background,
          and iOS gets a real shape to shadow instead of re-deriving one from
          the children every frame. The blur then samples that fill plus the
          8% of content showing through it — the same 92% dark glass. */}
      <View style={styles.capsule}>
        <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.hairline]} />
        </View>
        <View
          style={styles.row}
          accessibilityRole="tablist"
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
                icons={ICONS[name]}
                label={labels[name]}
                focused={focused}
                maxLabelWidth={maxLabelWidth}
                onPress={() => goTo(name, route.key, focused)}
                onLongPress={() => longPress(route.key)}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

interface DockItemProps {
  icons: { active: Glyph; inactive: Glyph };
  label: string;
  focused: boolean;
  /** Room the row can give this label; see CustomTabBar. */
  maxLabelWidth: number;
  onPress: () => void;
  onLongPress: () => void;
}

/**
 * One tab. The crimson pill is a single view whose WIDTH springs between the
 * 44pt disc and icon + label, so its neighbours slide along with it and a long
 * Burmese label simply makes a longer pill — it is never truncated. On a phone
 * too narrow for it, the label is SET smaller: its font size is scaled by
 * room ÷ natural width, computed here rather than left to
 * `adjustsFontSizeToFit`, whose floor (`minimumFontScale`) iOS turns into an
 * ellipsis and Android ignores. Reduce motion: the pill snaps open and closed.
 */
function DockItem({ icons, label, focused, maxLabelWidth, onPress, onLongPress }: DockItemProps) {
  const reduceMotion = useReducedMotion();
  /** The label's natural one-line width, measured off-flow (see `measure` below). */
  const [naturalWidth, setNaturalWidth] = useState(0);
  const labelWidth = Math.min(naturalWidth, maxLabelWidth);
  /**
   * 1 when the label fits as designed; below 1 it is the share of the design
   * size that fits. The OS text-size factor is already inside `naturalWidth`
   * and is applied again on top of `fontSize`, so the ratio carries straight
   * over to the rendered width.
   */
  const fit = naturalWidth > maxLabelWidth ? (maxLabelWidth / naturalWidth) * FIT_SAFETY : 1;
  const fittedStyle = fit < 1 ? { fontSize: LABEL_FONT_SIZE * fit } : undefined;
  const progress = useSharedValue(focused ? 1 : 0);
  const openExtra = useSharedValue(0);

  useEffect(() => {
    // The open pill is LABEL_LEFT + label + PILL_RIGHT wide; closed it is ITEM.
    openExtra.value = labelWidth > 0 ? LABEL_LEFT + labelWidth + PILL_RIGHT - ITEM : 0;
  }, [labelWidth, openExtra]);

  useEffect(() => {
    const target = focused ? 1 : 0;
    progress.value = reduceMotion ? target : withSpring(target, SPRING);
  }, [focused, progress, reduceMotion]);

  const pillStyle = useAnimatedStyle(() => ({
    width: ITEM + Math.max(progress.value, 0) * openExtra.value,
  }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: Math.min(Math.max(progress.value, 0), 1) }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (PILL_LEFT - ICON_REST_LEFT) * Math.min(Math.max(progress.value, 0), 1) }],
  }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: Math.min(Math.max(progress.value * 1.4 - 0.4, 0), 1) }));

  const color = focused ? theme.colors.onPrimary : theme.colors.textFaint;

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
      {/* The measuring copy: invisible, outside the flow and inside a box far
          wider than any label, so onLayout reports the label's natural width
          rather than whatever the pill happens to be at that moment. */}
      <View style={styles.measure} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <ThemedText
          variant="muted"
          weight="extrabold"
          numberOfLines={1}
          maxFontSizeMultiplier={LABEL_MAX_SCALE}
          onLayout={(e) => {
            const width = Math.ceil(e.nativeEvent.layout.width);
            if (width !== naturalWidth) setNaturalWidth(width);
          }}
        >
          {label}
        </ThemedText>
      </View>

      <Animated.View style={[styles.pill, pillStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.pillFill, fillStyle]} pointerEvents="none" />
        <Animated.View style={[styles.icon, iconStyle]}>
          <Ionicons name={focused ? icons.active : icons.inactive} size={ICON_SIZE} color={color} />
        </Animated.View>
        {/* The Pressable already speaks the label; this copy is visual only. */}
        <Animated.View
          style={[styles.labelBox, labelStyle]}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {/* `adjustsFontSizeToFit` stays only as a backstop for the last
              fraction of a point; the fitted size above does the real work. */}
          <ThemedText
            variant="muted"
            weight="extrabold"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            maxFontSizeMultiplier={LABEL_MAX_SCALE}
            color={theme.colors.onPrimary}
            style={[fittedStyle, labelWidth > 0 ? { width: labelWidth } : undefined]}
          >
            {label}
          </ThemedText>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: theme.layout.dockSideInset,
    right: theme.layout.dockSideInset,
    // Read the token directly — the dock height has one home, the theme.
    height: theme.layout.tabBarHeight,
  },
  wrapperHidden: { opacity: 0 },
  /** Carries the fill and the shadow; the clip below keeps the blur inside the radius. */
  capsule: {
    flex: 1,
    borderRadius: theme.radius.dock,
    backgroundColor: theme.colors.dock,
    ...theme.shadow.dock,
  },
  clip: { borderRadius: theme.radius.dock, overflow: "hidden" },
  /** The design's `inset 0 0 0 1px rgba(255,255,255,0.06)`: a hairline, not a frame. */
  hairline: {
    borderRadius: theme.radius.dock,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.tonalSoft,
  },
  /**
   * `space-evenly`, not `space-between`: with three tabs, `space-between`
   * pinned Home and Wallet to the capsule's ends and left two wide holes in
   * the middle. Evenly, the free room is shared as equal gaps before, between
   * and after the tabs, so the three sit balanced across the capsule while
   * the open pill still grows and its neighbours slide along with it.
   */
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: ROW_PADDING,
  },
  item: { height: ITEM, justifyContent: "center" },
  itemPressed: { transform: [{ scale: 0.96 }] },
  pill: {
    height: ITEM,
    borderRadius: ITEM / 2,
    overflow: "hidden",
    justifyContent: "center",
  },
  pillFill: { backgroundColor: theme.colors.primary, borderRadius: ITEM / 2 },
  icon: { position: "absolute", left: ICON_REST_LEFT, width: ICON_SIZE, height: ICON_SIZE },
  /** Absolutely placed, so the pill's animated width clips it as it opens. */
  labelBox: { position: "absolute", left: LABEL_LEFT, top: 0, bottom: 0, justifyContent: "center" },
  /** Wider than any label so the measuring copy is never constrained. */
  measure: { position: "absolute", left: 0, top: 0, width: 600, flexDirection: "row", opacity: 0 },
});
