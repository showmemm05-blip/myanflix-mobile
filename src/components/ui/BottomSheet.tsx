import { useEffect, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
}

/**
 * The app's modal surface for pickers, filters and short forms. Drag the
 * grabber header (or tap the scrim) to dismiss — the pan lives on the header
 * only so scrollable sheet bodies never fight the dismiss gesture.
 */
export function BottomSheet({ visible, onClose, children, snapHeight, title, subtitle, showClose, footer }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = windowHeight * 0.92;
  const sheetHeight = Math.min(snapHeight ?? windowHeight * 0.6, maxHeight);
  const translateY = useSharedValue(sheetHeight);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(sheetHeight, { duration: 200 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, sheetHeight, translateY, backdropOpacity]);

  const close = () => onClose();

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > sheetHeight * 0.3 || e.velocityY > 800) {
        translateY.value = withTiming(sheetHeight, { duration: 180 });
        runOnJS(close)();
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
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
    >
      {/* On Android a Modal renders into its own Dialog window, which the
          app-root GestureHandlerRootView does not cover — without this
          wrapper the drag-to-dismiss pan below silently receives no events
          there (it works on iOS either way). */}
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdropTouchable} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button">
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.backdrop} />
        </Animated.View>
      </Pressable>

      <Animated.View
        style={[styles.sheet, { height: sheetHeight, paddingBottom: Math.max(insets.bottom, theme.spacing.md) }, sheetStyle]}
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

        <View style={styles.body}>{children}</View>
        {footer && <View style={styles.footer}>{footer}</View>}
      </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropTouchable: { ...StyleSheet.absoluteFillObject },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.scrim },
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
  footer: { paddingTop: theme.spacing.md },
});
