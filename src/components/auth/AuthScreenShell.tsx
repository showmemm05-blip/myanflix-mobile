import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollIntoViewContext, useKeyboardLift } from "@/hooks/useKeyboardLift";
import { theme } from "@/theme";

interface Props {
  /** The page, top to bottom — it draws its own top (AuthHero or AuthTopBar), which owns the status-bar inset. */
  children: ReactNode;
  /**
   * Pinned to the bottom while the page is short (SessionOffline's Retry /
   * Log out), and simply following the content once it is taller — a long
   * Burmese body at font scale 2.0 scrolls instead of sliding under it.
   */
  footer?: ReactNode;
}

/**
 * The page every auth screen sits on (Marquee): the near-black ground and a
 * keyboard-aware scroller. No card, no ticket — the boards put the fields
 * straight on the page under the artwork or the top bar.
 *
 * Purely presentational — it owns no auth state and calls no service.
 */
export function AuthScreenShell({ children, footer }: Props) {
  const insets = useSafeAreaInsets();

  /*
   * Keeping the focused field above the keyboard. Android's "resize" mode
   * shrinks the window but does not promise to scroll the focused input into
   * the part that is left, and on the Samsung it did not: the number pad sat
   * over the phone field. So the shell measures the focused input against the
   * content and scrolls it — plus the button under it — clear, both when the
   * keyboard appears and when focus moves between fields under an open one.
   * Positions are tracked from layout/scroll events rather than measured
   * against the scroll view itself, which Fabric does not offset by scroll.
   */
  const lift = useKeyboardLift();

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        /*
         * Today's model, kept deliberately (and shared as useKeyboardLift):
         * do NOT reach for
         * `useSheetKeyboardLift` / `useKeyboardOverlap` from wallet/SheetForm.
         * Those exist because a BottomSheet has a fixed height and a bottom
         * edge anchored inside a Modal, where neither platform scrolls a
         * focused field into view. None of that is true here — this is a full
         * screen in the activity window, it scrolls, and it has no anchored
         * footer. `useSheetKeyboardLift` returns 0 outside a sheet, and
         * copying the inset hook in would double-count on iOS on top of this
         * KeyboardAvoidingView: the exact "action marooned above a
         * keyboard-sized hole" bug those files were written to prevent.
         */
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={lift.scrollRef}
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + theme.spacing.xl + lift.keyboardPad },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          onLayout={lift.onViewportLayout}
          onScroll={lift.onScroll}
          scrollEventThrottle={32}
        >
          {/* One measurable block holding the whole page, so a field's
              position is read against something whose own offset onLayout
              reports. It grows to the viewport so a footer can sit at its
              foot while the page is short. */}
          <View ref={lift.contentRef} onLayout={lift.onContentLayout} style={styles.content}>
            <ScrollIntoViewContext.Provider value={lift.scrollFocusedIntoView}>
              {children}
              {footer ? (
                <>
                  <View style={styles.footerSpacer} />
                  <View style={styles.footer}>{footer}</View>
                </>
              ) : null}
            </ScrollIntoViewContext.Provider>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  /* Top-aligned like the boards: the art or the top bar starts at the very top edge. */
  scrollContent: { flexGrow: 1 },
  content: { flexGrow: 1 },
  /** At least the boards' 32pt between the last line of copy and the pinned actions. */
  footerSpacer: { flexGrow: 1, minHeight: theme.spacing.xl },
  footer: { paddingHorizontal: theme.layout.screenPadding },
});
