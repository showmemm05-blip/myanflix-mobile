import { useEffect, useState, type ReactNode, type Ref } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ScrollViewInstance,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { LtIconButton } from "@/lottery/components/LtButton";
import { LtText } from "@/lottery/components/LtText";
import { LtToastHost } from "@/lottery/components/LtToast";
import { LT_COPY } from "@/lottery/copy";
import { LT, LT_EASE, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

export interface LtSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /**
   * The action row, pinned under the scrolling body (lt-base `.lt-sheet__foot`
   * is a 1fr / 2fr grid): give the secondary button `style={{ flex: 1 }}` and
   * the primary `style={{ flex: 2 }}` (two equal buttons: flex 1 each).
   */
  footer?: ReactNode;
  /**
   * Whether the scrim, the drag, the X and the phone's back key may close it.
   * False while a purchase is processing (Confirm): refused HERE, like the app
   * BottomSheet, so nothing can drag the sheet away and strand a live scrim.
   */
  dismissible?: boolean;
  /** The spoken name of the scrim ("Close wallet balance"); defaults to "Close". */
  closeLabel?: string;
  /**
   * Replaces the 60pt title row with the caller's own (Confirm v3's one-line
   * head: title · draw · a 36pt X). The grabber stays above it and the pair
   * is still the drag handle; `title` is then not drawn, so the header must
   * carry its own heading and its own close button.
   */
  header?: ReactNode;
  /** The body's padding, when a sheet needs its own (Confirm v3: 0 16 12). */
  bodyStyle?: StyleProp<ViewStyle>;
  /**
   * "row" (default): the 1fr / 2fr button row. "stack": one full-width column
   * with 4 between (Confirm v3: a reason line, the one Confirm, a quiet Cancel),
   * 10 above and 8 under it, plus the safe area.
   */
  footerLayout?: "row" | "stack";
  /**
   * False: no hairline over the footer and 8 above it instead of 12 — the
   * Leave sheet's lone ghost "Stay here" (board `.lt-leave .lt-sheet__foot`).
   * True by default.
   */
  footerDivider?: boolean;
  /** Floats 8 above the footer, inside the sheet, across the body (Confirm's undo toast). */
  footerOverlay?: ReactNode;
  /**
   * The body holds a text field (Confirm's typed quantity): the sheet rides on
   * the software keyboard and shortens to fit above it. Off by default.
   */
  keyboardAware?: boolean;
  /** The body's ScrollView, so a caller can bring a focused field into view. */
  scrollRef?: Ref<ScrollViewInstance>;
}

const ENTER_MS = 280;
const EXIT_MS = 200;
const REDUCED_MS = 120;
/** The keyboard lift glides about as fast as the keyboard itself. */
const LIFT_MS = 250;
/** Room kept between the status bar and a sheet that had to shorten for the keyboard. */
const KEYBOARD_TOP_AIR = 8;

/**
 * THE LOTTERY SHEET (lt-base 6.13): components/ui/BottomSheet.tsx's Modal
 * recipe COPIED — transparent, status and navigation bar translucent (the
 * BottomSheet explains why Android needs both), its own
 * GestureHandlerRootView (a Modal is its own window on Android), the drag on
 * the header only, and `dismissible` refused at the gesture itself — dressed
 * in Ivory Press: white, 10pt top corners, the warm sheet shadow, a 36 × 4
 * grabber, the warm 42% scrim, a 60pt header (title + 44pt close), a
 * scrolling body and a pinned footer over a hairline. The sheet is as tall as
 * its content, 90% of the window at most; then only the body scrolls.
 *
 * Motion (spec §1.4): in 280ms on the Lottery curve, out 200ms ease-in, the
 * scrim fading with it; reduced motion: a 120ms fade, no movement. Unlike the
 * app sheet it stays mounted through its exit, so the way out is seen too.
 *
 * Keyboard (`keyboardAware`, Confirm only): the same Modal props keep this
 * window still while the keyboard opens, so the sheet moves itself — it rises
 * by the covered strip (`useKeyboardInset`, hooks/, read-only here: the same
 * measurement BottomSheet makes, and 0 when the platform already moved the
 * window) and its height is capped to what is left above the keyboard, so the
 * header never leaves the screen. Reduced motion: it steps without gliding.
 */
export function LtSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
  closeLabel,
  header,
  bodyStyle,
  footerLayout = "row",
  footerDivider = true,
  footerOverlay,
  keyboardAware = false,
  scrollRef,
}: LtSheetProps) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [footerHeight, setFooterHeight] = useState(0);
  /** 0 = away, 1 = in place. */
  const shown = useSharedValue(0);
  const sheetHeight = useSharedValue(windowHeight);
  const drag = useSharedValue(0);

  const keyboard = useKeyboardInset(visible && keyboardAware);
  const lift = useSharedValue(keyboard);
  useEffect(() => {
    lift.value = reduceMotion ? keyboard : withTiming(keyboard, { duration: LIFT_MS, easing: LT_EASE });
  }, [keyboard, reduceMotion, lift]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.value = 0;
      shown.value = withTiming(1, { duration: reduceMotion ? REDUCED_MS : ENTER_MS, easing: LT_EASE });
    } else {
      shown.value = withTiming(
        0,
        { duration: reduceMotion ? REDUCED_MS : EXIT_MS, easing: Easing.in(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        },
      );
    }
  }, [visible, reduceMotion, shown, drag]);

  const close = () => {
    if (dismissible) onClose();
  };

  const pan = Gesture.Pan()
    .enabled(dismissible)
    .onUpdate((e) => {
      drag.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > sheetHeight.value * 0.3 || e.velocityY > 800) {
        runOnJS(onClose)();
      } else {
        drag.value = withTiming(0, { duration: 220, easing: LT_EASE });
      }
    });

  const sheetStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: shown.value, transform: [{ translateY: drag.value - lift.value }] }
      : { transform: [{ translateY: (1 - shown.value) * sheetHeight.value + drag.value - lift.value }] },
  );
  const scrimStyle = useAnimatedStyle(() => ({ opacity: shown.value }));

  const onSheetLayout = (event: LayoutChangeEvent) => {
    sheetHeight.value = event.nativeEvent.layout.height;
  };
  const onFooterLayout = (event: LayoutChangeEvent) => setFooterHeight(event.nativeEvent.layout.height);

  if (!mounted) return null;

  // With the keyboard up the sheet sits on it: the safe-area bottom is under the keyboard, and the
  // sheet may be no taller than the space left above it.
  const keyboardUp = keyboard > 0;
  const maxHeight = keyboardUp
    ? Math.min(windowHeight * 0.9, windowHeight - keyboard - insets.top - KEYBOARD_TOP_AIR)
    : windowHeight * 0.9;
  const stack = footerLayout === "stack";
  const footerBottom = (stack ? 8 : 16) + (keyboardUp ? 0 : insets.bottom);

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={close}
      supportedOrientations={["portrait", "portrait-upside-down", "landscape", "landscape-left", "landscape-right"]}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* A Modal is its own window on Android: it needs its own gesture root for the drag. */}
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          disabled={!dismissible}
          accessibilityRole="button"
          accessibilityLabel={closeLabel ?? LT_COPY.close}
        >
          <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
        </Pressable>

        <Animated.View
          onLayout={onSheetLayout}
          accessibilityViewIsModal
          style={[styles.sheet, { maxHeight }, sheetStyle]}
        >
          <GestureDetector gesture={pan}>
            <View>
              <View style={styles.grab} />
              {header ?? (
                <View style={styles.head}>
                  <LtText role="title" accessibilityRole="header" style={styles.title} numberOfLines={2}>
                    {title}
                  </LtText>
                  <LtIconButton
                    icon="close"
                    accessibilityLabel={LT_COPY.close}
                    onPress={close}
                    disabled={!dismissible}
                  />
                </View>
              )}
            </View>
          </GestureDetector>

          <ScrollView
            ref={scrollRef}
            style={styles.bodyScroll}
            contentContainerStyle={[styles.body, bodyStyle, !footer && { paddingBottom: 20 + insets.bottom }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {/* Inside the sheet's own box (so it takes touches on Android too), 8 above the footer. Kept mounted
              whenever the prop is given (even null), so what it holds can play its own exit. Placed BEFORE the footer
              in the tree (it still draws over the body), so a screen reader reaches Undo before Confirm, as on the board. */}
          {footerOverlay !== undefined ? (
            <View
              style={[styles.overlay, { bottom: (footer ? footerHeight : insets.bottom) + 8 }]}
              pointerEvents="box-none"
            >
              {footerOverlay}
            </View>
          ) : null}

          {footer ? (
            <View
              onLayout={onFooterLayout}
              style={[
                stack ? styles.footStack : styles.foot,
                !footerDivider && styles.footPlain,
                { paddingBottom: footerBottom },
              ]}
            >
              {footer}
            </View>
          ) : null}
        </Animated.View>
        {/* The page's toast host sits under this window; a toast raised from the sheet shows here too. */}
        <LtToastHost />
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: LT.scrim },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: LT.white,
    borderTopLeftRadius: LT_RADIUS.card,
    borderTopRightRadius: LT_RADIUS.card,
    boxShadow: LT_SHADOW.s3,
  },
  grab: { alignSelf: "center", width: 36, height: 4, marginTop: 8, borderRadius: 2, backgroundColor: LT.grab },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 60,
    paddingVertical: 4,
    paddingLeft: 16,
    paddingRight: 8,
  },
  title: { flex: 1 },
  bodyScroll: { flexGrow: 0, flexShrink: 1 },
  body: { paddingTop: 4, paddingHorizontal: 16, paddingBottom: 20 },
  foot: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: LT.white,
    borderTopWidth: 1,
    borderTopColor: LT.line,
  },
  /** Confirm v3: one column, a reason line / Confirm / quiet Cancel (lt-cs `.lt-sheet__foot`: gap 4, 10 16 8). */
  footStack: {
    gap: 4,
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: LT.white,
    borderTopWidth: 1,
    borderTopColor: LT.line,
  },
  /** `footerDivider={false}`: the foot runs on from the body (the Leave sheet). */
  footPlain: { borderTopWidth: 0, paddingTop: 8 },
  overlay: { position: "absolute", left: 16, right: 16, zIndex: 1 },
});
