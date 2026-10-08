import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BusyDots } from "@/components/ui/BusyDots";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

export type ConfirmDialogTone = "destructive" | "primary";

interface Props {
  visible: boolean;
  /** The question — "Delete your account?". Spoken first: focus lands on it when the dialog opens. */
  title: string;
  /** One or two plain sentences under the title. */
  message?: string;
  /** The committing button's label — "Delete". */
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** Cancel, a tap on the dimmed backdrop, Android's back, and the iOS escape gesture. */
  onCancel: () => void;
  /**
   * The request the confirm button started is in flight: that button shows
   * the busy dots, and nothing — Cancel, the backdrop, back — may close the
   * dialog until the owner clears it, because closing would hide the one
   * answer the action gets.
   */
  busy?: boolean;
  /** "destructive" (default) fills the confirm button deep red; "primary" crimson. */
  tone?: ConfirmDialogTone;
}

const CONFIRM_FILL: Record<ConfirmDialogTone, string> = {
  destructive: theme.colors.dangerStrong,
  primary: theme.colors.primary,
};
const CONFIRM_INK: Record<ConfirmDialogTone, string> = {
  destructive: theme.colors.onDangerStrong,
  primary: theme.colors.onPrimary,
};

/** The board's `.rise`: cubic-bezier(.2,.8,.2,1), a 12pt drift. */
const RISE_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);
const RISE_DISTANCE = 12;
const ENTER_MS = 220;
/**
 * A button's width before it grows, scaled with the reader's text size. Two of
 * them plus the gap fit side by side on a 320pt phone at the default size;
 * once they cannot (larger text, long Burmese), the row wraps and each button
 * takes the full width instead of cutting its label.
 */
const BUTTON_BASIS = 100;
const BUTTON_GAP = 10;
/** The board's 32pt margins, and a cap so a tablet does not get a banner. */
const SIDE_MARGIN = 32;
const MAX_WIDTH = 400;
/** Air kept above and below the card inside the safe area. */
const VERTICAL_MARGIN = 24;
/**
 * How long after opening the title is handed screen-reader focus — once the
 * Modal has been presented, so the event is not lost to the transition.
 */
const FOCUS_DELAY_MS = 350;

/**
 * An in-app confirmation (Marquee, DeleteAccount.dc.html): a #121217 card
 * with 24pt corners, centred over a 60% black backdrop — the title, a line
 * of body copy, then Cancel (white at 12%) beside the confirm button (deep
 * red for a destructive action), both 48pt with 12pt corners.
 *
 * A screen reader stays inside it: the card is `accessibilityViewIsModal`
 * (iOS), the backdrop is hidden from accessibility, and the Modal is its own
 * window on Android. Focus is moved to the title on open; Android's back,
 * the backdrop and the iOS escape gesture all mean Cancel. The entrance is a
 * short fade and rise — a plain fade under reduce motion.
 *
 * Render it INSIDE whatever modal surface opened it (a BottomSheet's
 * children): iOS presents a Modal from the nearest view controller, and one
 * declared beside an open sheet would ask a controller that is already
 * presenting, which shows nothing.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  tone = "destructive",
}: Props) {
  const reduceMotion = useReducedMotion();
  const { fontScale, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const titleRef = useRef<View>(null);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: ENTER_MS, easing: RISE_EASING });
    const focusTimer = setTimeout(() => {
      if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(focusTimer);
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.value) * RISE_DISTANCE }],
  }));

  const cancel = () => {
    if (!busy) onCancel();
  };
  const buttonBasis = BUTTON_BASIS * Math.max(1, fontScale);
  // Large text in landscape can be taller than the window: the words scroll
  // inside the card and the two buttons stay on it.
  const maxCardHeight = windowHeight - insets.top - insets.bottom - 2 * VERTICAL_MARGIN;
  const fill = CONFIRM_FILL[tone];
  const ink = CONFIRM_INK[tone];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={cancel}
      // Every orientation the app can be in, or iOS pins the dialog to portrait.
      supportedOrientations={["portrait", "portrait-upside-down", "landscape", "landscape-left", "landscape-right"]}
      // Android: the dim reaches under the status and navigation bars, as the
      // sheets' does (BottomSheet explains the pair).
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={cancel}
          disabled={busy}
          // A second way to Cancel for touch; a screen reader has the button.
          accessible={false}
          importantForAccessibility="no"
        >
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        </Pressable>

        <Animated.View
          style={[styles.card, { maxHeight: maxCardHeight }, cardStyle]}
          accessibilityViewIsModal
          onAccessibilityEscape={cancel}
        >
          <ScrollView style={styles.words} bounces={false} showsVerticalScrollIndicator={false}>
            <View ref={titleRef} accessible accessibilityRole="header" accessibilityLabel={title}>
              <ThemedText variant="section">{title}</ThemedText>
            </View>
            {message ? (
              <ThemedText variant="body" color={theme.colors.textBody} style={styles.message}>
                {message}
              </ThemedText>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <DialogButton
              label={cancelLabel}
              onPress={cancel}
              disabled={busy}
              fill={theme.colors.tonal}
              ink={theme.colors.text}
              weight="bold"
              basis={buttonBasis}
              reduceMotion={reduceMotion}
            />
            <DialogButton
              label={confirmLabel}
              onPress={() => {
                if (!busy) onConfirm();
              }}
              busy={busy}
              fill={fill}
              ink={ink}
              weight="extrabold"
              basis={buttonBasis}
              reduceMotion={reduceMotion}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function DialogButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  fill,
  ink,
  weight,
  basis,
  reduceMotion,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  fill: string;
  ink: string;
  weight: "bold" | "extrabold";
  basis: number;
  reduceMotion: boolean;
}) {
  const inactive = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      style={({ pressed }) => [
        styles.button,
        { flexBasis: basis, backgroundColor: fill },
        disabled && styles.buttonDisabled,
        busy && styles.buttonBusy,
        pressed && !inactive && (reduceMotion ? styles.pressedStill : styles.pressed),
      ]}
    >
      {busy ? (
        <BusyDots color={ink} />
      ) : (
        <ThemedText weight={weight} color={ink} style={styles.buttonLabel}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SIDE_MARGIN,
  },
  backdrop: { backgroundColor: theme.colors.overlay },
  card: {
    width: "100%",
    maxWidth: MAX_WIDTH,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: 20,
    paddingBottom: theme.spacing.md,
    borderRadius: theme.radius.sheet,
    backgroundColor: theme.colors.surface,
    // The board lifts this one card off the dimmed page (0 24 60 at 60%).
    ...theme.shadow.lg,
  },
  /** Only as tall as the words, and the part that gives way when the card is capped. */
  words: { flexGrow: 0, flexShrink: 1 },
  message: { marginTop: theme.spacing.sm },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: BUTTON_GAP,
    marginTop: 20,
  },
  /** 48pt; a label that wraps grows the button rather than being cut. */
  button: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.button,
  },
  buttonLabel: { fontSize: 16, textAlign: "center" },
  buttonDisabled: { opacity: 0.45 },
  buttonBusy: { opacity: 0.85 },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.8 },
});
