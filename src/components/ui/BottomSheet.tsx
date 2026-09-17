import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from "react-native";
import { BlurView } from "expo-blur";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

interface Props {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  snapHeight?: number;
  /** Optional sheet title rendered in the grabber header. */
  title?: string;
  /** One quiet line under the title. */
  subtitle?: string;
  /** Shows a 44pt close button on the right of the header. */
  showClose?: boolean;
  /** Pinned below the scrollable body (e.g. a submit button). */
  footer?: ReactNode;
  /**
   * Whether the scrim and the drag gesture may dismiss the sheet. Defaults to
   * true; pass false while a request is in flight.
   *
   * It has to be refused HERE rather than by an owner that ignores `onClose`,
   * because the pan animates the sheet off-screen and only then reports the
   * dismissal. An owner that declines at that point leaves `visible` true with
   * the sheet already translated away — an invisible form behind a live scrim,
   * with no way back. Gating the gesture itself is the only version that
   * cannot strand it.
   */
  dismissible?: boolean;
}

/**
 * How much of the window's bottom edge the keyboard covers, in dp.
 *
 * This number is only correct while the sheet's own window stays still. iOS
 * leaves a presented view alone for free; Android does NOT, and the two
 * translucency props on the Modal below are what buy the same behaviour there
 * — read that note before touching anything here, because if the window moves
 * as well, everything measured below is applied a second time on top of it.
 * With the window still, nothing gets out of the keyboard's way unless this
 * hook measures the covered strip and the pieces that must clear it move
 * themselves by it.
 *
 * Why the `+ insets.bottom` on Android, spelled out because it looks like a
 * bug: React Native does not report the keyboard's own height there. It reports
 * `ime().bottom - systemBars().bottom` (ReactRootView.checkForKeyboardEvents),
 * i.e. the strip MINUS the navigation bar, because the nav bar sits in front of
 * the keyboard. safe-area-context's `insets.bottom` is exactly that nav bar and
 * nothing else — it masks `statusBars|displayCutout|navigationBars|captionBar`
 * and deliberately excludes `ime()`, so it does not grow when the keyboard
 * opens. Adding it back therefore reconstructs `ime().bottom`: the true
 * distance from the window bottom to the top of the keyboard, counted once.
 * iOS already reports that full distance, so nothing is added there.
 *
 * Why Keyboard events and not Reanimated's `useAnimatedKeyboard`: Reanimated
 * installs its inset listener and its WindowInsetsAnimation callback on the
 * ACTIVITY window's decorView, and this sheet is not in the activity window —
 * it is in the Modal's Dialog window, so the value can never be relied on to
 * arrive here. These events come from the activity's own global-layout
 * listener, which does fire while the Modal is up. They also fire ONCE per
 * open/close rather than once per animation frame, which is what keeps the
 * bring-into-view below to a single scroll per tap.
 *
 * AND WHY IT IS USUALLY ZERO ON ANDROID. Knowing the strip is only half the
 * job: what matters is whether anything still has to move because of it. With
 * Expo's default `softwareKeyboardLayoutMode: "resize"` the window HOSTING this
 * sheet shrinks to the space above the keyboard, so the sheet — anchored to
 * that window's bottom — is already clear of it and needs no lift at all.
 * Lifting anyway is exactly the bug a user photographed: the action bar sat
 * marooned in the middle of the sheet with a keyboard-sized hole beneath it,
 * because the platform's move and this component's move had been added
 * together. iOS never resizes a presented view, so there the lift is the only
 * thing that clears the keyboard and the full strip is right.
 *
 * Rather than hard-code that per platform — "pan" mode, a future RN change or
 * a tablet's floating keyboard would each break the assumption silently — the
 * window is measured: if it shrank when the keyboard appeared, the platform
 * has already done the moving and the strip this reports is 0.
 */
function useKeyboardOverlap(enabled: boolean, windowHeight: number): number {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const [overlap, setOverlap] = useState(0);

  /**
   * The tallest this window has been seen, which is its height with no keyboard
   * up. A window that resizes for the keyboard drops well below it; one that
   * does not stays exactly on it.
   */
  const fullHeight = useRef(windowHeight);
  if (windowHeight > fullHeight.current) fullHeight.current = windowHeight;
  // Well above rotation jitter and toolbar changes, far below any keyboard.
  const windowResized = fullHeight.current - windowHeight > 80;

  useEffect(() => {
    // Sheets stay mounted while closed — a closed one has no field to protect,
    // and two sheets must never both be listening.
    if (!enabled) return;
    // Android only ever emits the `Did` pair; iOS's `Will` pair carries the
    // final height at the START of its animation, so the bar travels with the
    // keyboard instead of snapping after it.
    const ios = Platform.OS === "ios";
    const strip = (height: number) => {
      // The platform already lifted everything by shrinking the window; adding
      // our own move on top is what put the action bar in mid-air.
      if (windowResized) return 0;
      // Android reports the strip MINUS the navigation bar, which sits in front
      // of the keyboard; safe-area's bottom inset is exactly that bar (it masks
      // ime() out), so adding it back reconstructs the true distance, counted
      // once. iOS already reports the full distance.
      return Math.round(height + (ios ? 0 : bottomInset));
    };
    // A sheet can open ON TOP of a keyboard that is already up — the filter
    // sheet opens from the search screen without blurring its search field, so
    // no show event is coming and there would be nothing to lift by. RN caches
    // the live frame between its own did-show/did-hide, so read it once.
    const standing = Keyboard.metrics();
    if (standing) setOverlap(strip(standing.height));
    const subscriptions = [
      Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (event: KeyboardEvent) => {
        const height = strip(event.endCoordinates.height);
        setOverlap((current) => (current === height ? current : height));
      }),
      Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setOverlap(0)),
    ];
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      setOverlap(0);
    };
  }, [enabled, bottomInset, windowResized]);

  return enabled ? overlap : 0;
}

/**
 * How much of the sheet's CONTENT BOX is obstructed at its bottom edge, in dp.
 *
 * One number serves both consumers because they are the same measurement: a bar
 * pinned to the body's bottom edge rises by it to land exactly on the keyboard,
 * and a scrolling body reserves it so its last row can still be scrolled clear.
 * It is the keyboard's strip minus the padding the sheet already keeps below
 * its content — without that subtraction a bar lifted by the full strip floats
 * `sheetBottomPadding` above the keyboard, with a dead gap under it.
 *
 * The sheet does NOT inset itself by this. Its height is fixed and its bottom
 * is anchored, so a bottom inset can only come out of the content box: the body
 * is `flex: 1`, and every field visibly climbed the sheet the moment a keyboard
 * opened. Only the pieces that must clear the keyboard read this and move
 * themselves — by transform or by padding below the last row, never by layout
 * above it — so the fields stay exactly where they were.
 *
 * Only descendants of a BottomSheet can read it: a sheet that needs the value
 * in its own body has to put that body in a child component (see `SheetForm`).
 */
const SheetKeyboardContext = createContext(0);

export function useSheetKeyboardLift(): number {
  return useContext(SheetKeyboardContext);
}

/**
 * The app's modal surface for pickers, filters and short forms. Drag the
 * grabber header (or tap the scrim) to dismiss — the pan lives on the header
 * only so scrollable sheet bodies never fight the dismiss gesture.
 */
/**
 * The sheet's entrance curve. Deliberately NOT a spring: the spring this
 * replaced ran at damping 22 / stiffness 220, a damping ratio of 0.74, so it
 * overshot its resting place and settled back — the bounce that reads as toy-
 * like when all you did was tap a control. This is a decelerating curve that
 * arrives once and stops: fast off the mark so the sheet feels immediately
 * attached to the finger, then easing into place. Closing is quicker and
 * plainer, because nobody studies a sheet on its way out.
 */
const ENTER_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const ENTER_DURATION_MS = 300;
/** Same curve, shorter: releasing a half-dragged sheet is a correction, not an entrance. */
const SETTLE_DURATION_MS = 220;
const EXIT_DURATION_MS = 200;

export function BottomSheet({
  visible,
  onClose,
  children,
  snapHeight,
  title,
  subtitle,
  showClose,
  footer,
  dismissible = true,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = windowHeight * 0.92;
  const sheetHeight = Math.min(snapHeight ?? windowHeight * 0.6, maxHeight);
  const keyboardOverlap = useKeyboardOverlap(visible, windowHeight);
  const sheetBottomPadding = Math.max(insets.bottom, theme.spacing.md);
  /**
   * The strip is measured from the window bottom, but everything that reads it
   * is positioned inside the content box, whose bottom already sits
   * `sheetBottomPadding` higher. Converting once, here, is what stops the same
   * number being counted twice further down.
   */
  const keyboardLift = Math.max(keyboardOverlap - sheetBottomPadding, 0);
  const translateY = useSharedValue(sheetHeight);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: ENTER_DURATION_MS, easing: ENTER_EASING });
      backdropOpacity.value = withTiming(1, { duration: ENTER_DURATION_MS, easing: ENTER_EASING });
    } else {
      translateY.value = withTiming(sheetHeight, { duration: EXIT_DURATION_MS, easing: Easing.in(Easing.quad) });
      backdropOpacity.value = withTiming(0, { duration: EXIT_DURATION_MS });
    }
  }, [visible, sheetHeight, translateY, backdropOpacity]);

  const close = () => onClose();

  const pan = Gesture.Pan()
    // Disabled rather than merely ignored: a disabled gesture never moves the
    // sheet at all, so there is no off-screen position to recover from.
    .enabled(dismissible)
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > sheetHeight * 0.3 || e.velocityY > 800) {
        translateY.value = withTiming(sheetHeight, { duration: 180, easing: Easing.in(Easing.quad) });
        runOnJS(close)();
      } else {
        translateY.value = withTiming(0, { duration: SETTLE_DURATION_MS, easing: ENTER_EASING });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      // Without this, iOS pins the modal to portrait, so sheets opened from the
      // landscape fullscreen player (speed / quality / subtitles / episodes)
      // render sideways. Must list every orientation the app can be in.
      supportedOrientations={["portrait", "portrait-upside-down", "landscape", "landscape-left", "landscape-right"]}
      // Android only, and load-bearing — this is what stops the keyboard being
      // counted twice. RN hardcodes SOFT_INPUT_ADJUST_RESIZE on every Modal's
      // Dialog window (ReactModalHostView.createDialog), so a dialog whose
      // decor still fits system windows is RESIZED by the system when the
      // keyboard opens: its bottom edge snaps to the top of the keyboard,
      // carrying this bottom-anchored sheet up with it and clipping the header
      // off the root — and then the lift measured above is applied on top of
      // that, which is how the action bar ended up floating a whole keyboard
      // too high with dead sheet under it.
      // These props are the only opt-out: RN calls `dialogWindow
      // .enableEdgeToEdge()` — i.e. decorFitsSystemWindows(false) — only when
      // `navigationBarTranslucent` is set, and it warns unless the status bar
      // is translucent too. An edge-to-edge window is handed the keyboard as an
      // inset rather than being resized, which is the premise the measurement
      // above depends on. Where the platform already enforces edge-to-edge
      // (Android 15+ targeting SDK 35+) RN reads both props as true no matter
      // what we pass, so this is a no-op there and a fix everywhere below it.
      // The sheet now reaches under the navigation bar; its `paddingBottom:
      // sheetBottomPadding` is what keeps the content itself clear of it.
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* On Android a Modal renders into its own Dialog window, which the
          app-root GestureHandlerRootView does not cover — without this
          wrapper the drag-to-dismiss pan below silently receives no events
          there (it works on iOS either way). */}
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <Pressable
        style={styles.backdropTouchable}
        onPress={onClose}
        disabled={!dismissible}
        accessibilityLabel="Close"
        accessibilityRole="button"
      >
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.backdrop} />
        </Animated.View>
      </Pressable>

      <Animated.View
        style={[
          styles.sheet,
          // Deliberately keyboard-independent: the height and this padding are
          // what keep the body's frame — and so every field in it — perfectly
          // still while the keyboard comes and goes.
          { height: sheetHeight, paddingBottom: sheetBottomPadding },
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={pan}>
          <View style={styles.header}>
            <View style={styles.handle} />
            {(title || showClose) && (
              <View style={styles.headerRow}>
                <View style={styles.headerText}>
                  {title && (
                    <ThemedText variant="section" numberOfLines={1}>
                      {title}
                    </ThemedText>
                  )}
                  {subtitle && (
                    <ThemedText variant="caption" numberOfLines={2}>
                      {subtitle}
                    </ThemedText>
                  )}
                </View>
                {showClose && (
                  <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
                    <Ionicons name="close" size={20} color={theme.colors.textMuted} />
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </GestureDetector>

        <SheetKeyboardContext.Provider value={keyboardLift}>
          <View style={styles.body}>{children}</View>
          {/* Lifted by a transform, never by layout: a margin here would push
              the body's bottom edge up and reflow the content above it. It
              carries the sheet's own fill so the body scrolls under it.
              Its own height is not published to the body: the footer sits
              BELOW the body in flow, so lifting it by `keyboardLift` covers
              exactly `keyboardLift` of the body — its height is already out of
              the body's box and would be reserved twice if it were added. */}
          {footer && (
            <View style={[styles.footer, keyboardLift > 0 && { transform: [{ translateY: -keyboardLift }] }]}>
              {footer}
            </View>
          )}
        </SheetKeyboardContext.Provider>
      </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropTouchable: { ...StyleSheet.absoluteFill },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.scrim },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.popover,
    borderTopLeftRadius: theme.radius["3xl"],
    borderTopRightRadius: theme.radius["3xl"],
    borderTopWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingHorizontal: theme.spacing.lg,
    ...theme.shadow.lg,
  },
  header: { paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.sm },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.borderStrong,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  headerText: { flex: 1, gap: 2 },
  close: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
  },
  body: { flex: 1 },
  footer: { paddingTop: theme.spacing.md, backgroundColor: theme.colors.popover },
});
