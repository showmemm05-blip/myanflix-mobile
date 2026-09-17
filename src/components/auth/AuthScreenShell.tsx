import { useSyncExternalStore, type ReactNode } from "react";
import { Dimensions, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { AuroraBackdrop } from "@/components/common/AuroraBackdrop";
import { FadeInView } from "@/components/ui/FadeInView";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";

interface Props {
  children: ReactNode;
}

/**
 * The shell every auth screen sits in: a restrained aurora wash, the crimson
 * wordmark, and a keyboard-aware scroller holding the ticket underneath.
 *
 * The poster marquee that used to head this screen is gone — it was eleven
 * gradient layers on the very first surface a logged-out cold start paints,
 * and it made the sign-in page look like every other streaming sign-in page.
 * The shape is now the ticket below, not the artwork above.
 *
 * Purely presentational — it owns no auth state and calls no service.
 */
export function AuthScreenShell({ children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      {/*
       * 240 is an INVARIANT, not a taste call. The ticket's tear fakes two
       * punched holes by filling circles with `colors.background`, and that
       * illusion only holds where the card sits on FLAT background. With the
       * wordmark block at 82 and the card top at >=154, the tear never lands
       * above y~440 on any step or device — so the wash has to be dead well
       * before it. Raising this height brings the seam back.
       */}
      <AuroraBackdrop tone="violet" height={240} intensity={0.7} />

      <KeyboardAvoidingView
        style={styles.flex}
        /*
         * Today's model, kept deliberately: do NOT reach for
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
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + theme.spacing.lg,
              paddingBottom: insets.bottom + theme.spacing.xl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Wordmark />
          <View>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * The ticket: a card with a bite out of each side and a perforated tear across
 * it. Above the tear is what the user must DO; below it, in the stub, is how
 * it reaches them. The stub is always rendered — that permanent slot is what
 * lets today's "delivery isn't switched on yet" and tomorrow's "Viber isn't
 * available for this number" occupy the same pixels without the card
 * reflowing on the day the feature lands.
 */
export function AuthTicket({ children, stub }: { children: TicketContent; stub: ReactNode }) {
  const compact = useCompactAuthLayout();

  return (
    <FadeInView duration={280} delay={60}>
      <View style={compact ? styles.cardCompact : styles.card}>
        <View style={styles.topHalf}>{typeof children === "function" ? children(compact) : children}</View>
        <Tear compact={compact} />
        <View style={styles.stubBlock}>{stub}</View>
      </View>
    </FadeInView>
  );
}

/**
 * Ticket content. The function form exists so a caller whose own layout has to
 * follow the density (PhoneAuthFlow's header minHeight) can read `compact`
 * from the ONE place that computes it, instead of calling
 * `useCompactAuthLayout` a second time and subscribing a second subtree to
 * screen-metric events. Callers that don't care (ForgotPassword) pass plain
 * elements and nothing changes for them.
 */
export type TicketContent = ReactNode | ((compact: boolean) => ReactNode);

/** Below this SCREEN height the ticket switches to its tighter padding set. */
const COMPACT_SCREEN_HEIGHT = 700;

/*
 * Module scope, so `useSyncExternalStore` gets stable references and a render
 * of this hook allocates nothing.
 */
function subscribeToScreenMetrics(onChange: () => void): () => void {
  // Fires on rotation and other configuration changes, which is exactly when
  // the screen's height really does change.
  const subscription = Dimensions.addEventListener("change", onChange);
  return () => subscription.remove();
}

/**
 * SCREEN height, deliberately — NOT `useWindowDimensions()`.
 *
 * app.json sets no `softwareKeyboardLayoutMode`, so Expo's default "resize"
 * applies and Android shrinks the activity WINDOW when the number pad opens:
 * on an 852dp phone the window drops to roughly 550. Keyed off the window,
 * this boolean would flip the moment a field was focused and flip back when
 * the keyboard closed — collapsing and re-expanding ~30pt of ticket padding
 * mid-typing, which is the exact twitch the header's minHeight was added to
 * prevent. `Dimensions.get("screen")` is the display's own metrics: the
 * keyboard cannot move it, a rotation can, and the "change" event above
 * delivers the rotation.
 *
 * `useWindowDimensions().height` stays RIGHT in BottomSheet / SuggestionPanel /
 * the player sheets: those MEASURE the space left beside the keyboard. This is
 * a layout-density switch about the device, so it must not see the keyboard.
 */
function isCompactScreen(): boolean {
  return Dimensions.get("screen").height < COMPACT_SCREEN_HEIGHT;
}

/**
 * The one definition of "short phone" across the auth screens.
 *
 * A BOOLEAN, not a measurement — and the snapshot is the boolean itself, not
 * the height, so a metrics event that doesn't cross the threshold re-renders
 * nothing at all. Every style set it chooses between must be a pre-built
 * `StyleSheet` entry rather than an object built inline.
 *
 * NOT exported on purpose: `AuthTicket` is the single subscriber, and content
 * that needs the answer receives it through `TicketContent`'s function form.
 * Exporting this again is how the auth tree grows a second subscription.
 */
function useCompactAuthLayout(): boolean {
  return useSyncExternalStore(subscribeToScreenMetrics, isCompactScreen);
}

/* ------------------------------------------------------------------ */

function Wordmark() {
  const { t } = useLanguage();

  return (
    <FadeInView duration={220} style={styles.wordmark}>
      <View style={styles.mark}>
        <Ionicons name="play" size={15} color={theme.colors.brand} style={styles.markGlyph} />
      </View>
      {/* Crimson is reserved for the wordmark alone — never for actions. */}
      <ThemedText variant="display" weight="bold" color={theme.colors.brand} style={styles.wordmarkText}>
        {t.common.appName}
      </ThemedText>
    </FadeInView>
  );
}

/** Built once at module load — 26 static dots must never be rebuilt per render. */
const PERF_DOTS: readonly number[] = Object.freeze(Array.from({ length: 26 }, (_, i) => i));

/** The perforation, plus the two half-circles bitten out of the card's edges. */
function Tear({ compact }: { compact: boolean }) {
  return (
    <View
      style={compact ? styles.tearRowCompact : styles.tearRow}
      pointerEvents="none"
      // A screen reader announcing 26 dots would be worse than useless.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.notch, styles.notchLeft]} />
      <View style={styles.dots}>
        {PERF_DOTS.map((i) => (
          <View key={i} style={styles.dot} />
        ))}
      </View>
      <View style={[styles.notch, styles.notchRight]} />
    </View>
  );
}

/** Everything the two padding variants of the ticket share. */
const CARD_BASE = {
  marginHorizontal: theme.layout.screenPadding,
  backgroundColor: theme.colors.surface,
  borderRadius: theme.radius["3xl"],
  borderWidth: 1,
  borderColor: theme.colors.border,
  /*
   * ONE brighter hairline along the top edge. This is the whole reason the
   * ticket reads as lifted off the page rather than drawn on it — it is
   * cheaper than any shadow trick, and it is the single most deletable-looking
   * line in this file. It is not a typo.
   */
  borderTopColor: theme.colors.borderStrong,
  /* Load-bearing: the two notches sit ON the card's edge, half outside it. */
  overflow: "visible" as const,
  ...theme.shadow.lg,
};

const TEAR_BASE = {
  height: 16,
  flexDirection: "row" as const,
  alignItems: "center" as const,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  /*
   * `justifyContent: "center"` with `flexGrow: 1` buys both behaviours from
   * one property: a short card floats centred like an object, and the moment
   * the content is taller than the frame (every OTP step, every keyboard-up
   * state) it top-aligns and scrolls normally.
   */
  scrollContent: { flexGrow: 1, justifyContent: "center" },

  /* ---- wordmark ---- */
  wordmark: {
    height: 82,
    marginBottom: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm + 2,
  },
  mark: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brandSoft,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.brand, 0.36),
    alignItems: "center",
    justifyContent: "center",
  },
  /** The play triangle's own mass sits left of centre — nudge it back. */
  markGlyph: { marginLeft: 2 },
  wordmarkText: { letterSpacing: -0.6 },

  /* ---- the ticket ---- */
  card: { ...CARD_BASE, paddingHorizontal: theme.spacing.lg, paddingTop: 20, paddingBottom: theme.spacing.lg },
  cardCompact: {
    ...CARD_BASE,
    paddingHorizontal: theme.spacing.md + 4,
    paddingTop: theme.spacing.md,
    paddingBottom: 20,
  },
  topHalf: { gap: theme.spacing.md },
  stubBlock: { gap: 12 },

  /* ---- the tear ---- */
  // Negative margins equal to the card's own padding, so the row reaches the
  // card's edges and the notches can straddle them.
  tearRow: { ...TEAR_BASE, marginHorizontal: -theme.spacing.lg, marginTop: theme.spacing.lg, marginBottom: 20 },
  tearRowCompact: {
    ...TEAR_BASE,
    marginHorizontal: -(theme.spacing.md + 4),
    marginTop: theme.spacing.md,
    marginBottom: 14,
  },
  /** Filled with the PAGE colour, which is what fakes a punched hole. */
  notch: {
    position: "absolute",
    top: 0,
    width: 16,
    height: 16,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  notchLeft: { left: -8 },
  notchRight: { right: -8 },
  // 8pt of notch intrudes past the card edge, plus 8pt of air.
  dots: { flex: 1, flexDirection: "row", justifyContent: "space-between", marginHorizontal: theme.spacing.md },
  dot: {
    width: 3,
    height: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: withAlpha(theme.colors.text, 0.14),
  },
});
