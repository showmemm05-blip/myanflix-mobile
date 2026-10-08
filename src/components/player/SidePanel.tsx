import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeIn, SlideInRight, useReducedMotion } from "react-native-reanimated";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/** PlayerSettings.dc.html: a 420pt panel, never more than this share of a narrower window. */
const PANEL_WIDTH = 420;
const PANEL_MAX_SHARE = 0.62;
/** The board's `slidein .28s cubic-bezier(.2,.8,.2,1)`. */
const SLIDE_MS = 280;
const SLIDE_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);

interface Props {
  onClose: () => void;
  /** Spoken name of the panel. */
  accessibilityLabel: string;
  /** Pinned at the top of the panel (the settings tabs and Close). */
  header: ReactNode;
  children: ReactNode;
}

/**
 * The fullscreen player's right-side panel (PlayerSettings.dc.html): a
 * #121217 sheet with 24pt left corners sliding in over a 60% black backdrop.
 * Tapping the backdrop, the panel's own Close or Android's back closes it.
 *
 * A Modal for the same reasons BottomSheet is one: it sits above the native
 * video surface for touch, it owns Android's back while open, and it must be
 * told every orientation — without that iOS pins a modal to portrait and the
 * panel would open sideways over the landscape player. Mounted only while
 * open, so it has no exit animation, like the sheets it replaces.
 */
export function SidePanel({ onClose, accessibilityLabel, header, children }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const panelWidth = Math.min(PANEL_WIDTH, width * PANEL_MAX_SHARE);

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      supportedOrientations={["portrait", "portrait-upside-down", "landscape", "landscape-left", "landscape-right"]}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Animated.View
        style={StyleSheet.absoluteFill}
        entering={reduceMotion ? undefined : FadeIn.duration(200)}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t.common.close}
        />
      </Animated.View>

      <Animated.View
        entering={reduceMotion ? undefined : SlideInRight.duration(SLIDE_MS).easing(SLIDE_EASING)}
        accessibilityViewIsModal
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.panel,
          {
            width: panelWidth,
            paddingTop: 16 + insets.top,
            paddingBottom: 16 + insets.bottom,
            paddingRight: Math.max(44, insets.right + 16),
          },
        ]}
      >
        {header}
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: theme.colors.overlay },
  panel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    paddingLeft: 24,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.sheet,
    borderBottomLeftRadius: theme.radius.sheet,
    shadowColor: "#000",
    shadowOffset: { width: -20, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
});
