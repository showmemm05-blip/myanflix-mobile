import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { BusyDots } from "@/components/wallet/BusyDots";
import { PressScale } from "@/components/wallet/PressScale";
import { ROW_INSET, useWalletLayout } from "@/hooks/useWalletLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";

/**
 * The chrome of the full-height deposit / withdraw flows (Deposit.dc.html,
 * Withdraw.dc.html and their step 2 boards) — the header with its step bars,
 * the step's question, section titles and labels, the info note, the flow's
 * buttons and the pinned action bar. Presentational only: every value and
 * handler belongs to the flow that renders these.
 */

interface HeaderProps {
  /** Omitted on the success pane, which says what happened once, in its body. */
  title?: string;
  onClose: () => void;
  closeLabel: string;
  /** The current step; omitted on the success pane (no count, no progress). */
  step?: { n: number; total: number; title: string };
  /**
   * The left button's glyph: "close" (the X — leaves the flow) or "back" (a
   * chevron — the withdrawal-code pages step back one page). `closeLabel`
   * names it either way.
   */
  leading?: "close" | "back";
  /** Locks the left button while a request is in flight. */
  closeDisabled?: boolean;
}

/** From this OS text size on, "1 of 2" no longer fits its 56pt side and moves under the title row. */
const COUNT_BELOW_SCALE = 1.3;
/** The boards' header: a 56pt row, 8pt in from the sides; each side is 56 wide. */
const HEADER_SIDE = 56;
/** The close disc inside its 44pt target. */
const CLOSE_DISC = 40;

/**
 * Close (a 40pt disc) on the left, the title centred in 17/24 ExtraBold, "1 of
 * 2" on the right, then two 4pt crimson step bars. The sides are equal so the
 * title stays centred, and a long title wraps between them instead of being
 * cut. At large text sizes the count moves to its own right-aligned line
 * above the bars. A screen reader hears one heading: title, step and the
 * step's question.
 */
export function FlowHeader({ title, onClose, closeLabel, step, leading = "close", closeDisabled }: HeaderProps) {
  const { t } = useLanguage();
  const { fontScale } = useWalletLayout();
  const stepOf = step ? t.wallet.stepOf.replace("{n}", String(step.n)).replace("{total}", String(step.total)) : "";
  const countBelow = fontScale >= COUNT_BELOW_SCALE;
  const count = step ? (
    <ThemedText
      variant="caption"
      weight="bold"
      tabular
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={[styles.stepCount, countBelow && styles.stepCountBelow]}
    >
      {t.wallet.stepCount.replace("{n}", String(step.n)).replace("{total}", String(step.total))}
    </ThemedText>
  ) : null;

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.side}>
          <PressScale
            onPress={onClose}
            disabled={closeDisabled}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            accessibilityState={{ disabled: !!closeDisabled }}
            style={[styles.closeTarget, closeDisabled && styles.disabled]}
          >
            <View style={styles.closeDisc}>
              {leading === "back" ? (
                <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
              ) : (
                <Ionicons name="close" size={20} color={theme.colors.text} />
              )}
            </View>
          </PressScale>
        </View>
        {title ? (
          <ThemedText
            weight="extrabold"
            accessibilityRole="header"
            accessibilityLabel={step ? `${title}, ${stepOf}, ${step.title}` : title}
            style={styles.title}
          >
            {title}
          </ThemedText>
        ) : (
          <View style={styles.titleSpacer} />
        )}
        <View style={[styles.side, styles.sideEnd]}>{countBelow ? null : count}</View>
      </View>
      {countBelow ? count : null}
      {step ? (
        <View style={styles.progress} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {Array.from({ length: step.total }, (_, index) => (
            <View key={index} style={[styles.segment, index < step.n && styles.segmentDone]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The step's question as the page's large heading ("Amount and method",
 * "How much?") — 24/30 ExtraBold, 24pt under the step bars.
 */
export function FlowHeading({ children }: { children: string }) {
  return (
    <ThemedText variant="title" accessibilityRole="header" style={styles.heading}>
      {children}
    </ThemedText>
  );
}

/** A flow section's 19/26 title ("Send To", "Account Type"). */
export function FlowSectionTitle({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <ThemedText variant="section" accessibilityRole="header">
        {children}
      </ThemedText>
    </View>
  );
}

/** The quiet 13pt Bold label over a field or a figure ("Amount", "Bank Name"). */
export function FlowLabel({ children, inset }: { children: ReactNode; inset?: boolean }) {
  return (
    <ThemedText variant="caption" weight="bold" style={[styles.label, inset && styles.labelInset]}>
      {children}
    </ThemedText>
  );
}

/** An info glyph and a muted explanation — what happens next, what a request does. */
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <View style={styles.note}>
      <Ionicons name="information-circle-outline" size={18} color={theme.colors.textFaint} style={styles.noteIcon} />
      <ThemedText variant="caption" weight="regular" tabular style={styles.noteText}>
        {children}
      </ThemedText>
    </View>
  );
}

export type FlowButtonVariant = "primary" | "play" | "tonal" | "ghost" | "danger";

interface FlowButtonProps {
  /** Omitted = an icon-only square (needs `icon` and `accessibilityLabel`). */
  title?: string;
  onPress: () => void;
  /**
   * primary = crimson commit (Continue, Submit); play = white (Close on a
   * success pane, the empty wallet's Deposit); tonal = white at 16% (Back,
   * Retry, Load more); ghost = words only; danger = the soft red retry of a
   * failed balance.
   */
  variant?: FlowButtonVariant;
  /** 52pt (the flows' pinned buttons), 48pt (a state's action) or 44pt (inline retry). */
  size?: "lg" | "md" | "sm";
  icon?: keyof typeof Ionicons.glyphMap;
  /** Busy: three pulsing dots in place of the label; the button is locked meanwhile. */
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const BUTTON_HEIGHT = { lg: 52, md: 48, sm: 44 } as const;

const LOOK: Record<FlowButtonVariant, { fill: string; ink: string }> = {
  primary: { fill: theme.colors.primaryStrong, ink: theme.colors.onPrimaryStrong },
  play: { fill: theme.colors.play, ink: theme.colors.onPlay },
  tonal: { fill: theme.colors.tonalStrong, ink: theme.colors.text },
  ghost: { fill: "transparent", ink: theme.colors.textMuted },
  danger: { fill: withAlpha(theme.colors.danger, 0.16), ink: theme.colors.text },
};

/**
 * The wallet's rectangular button: radius 12, ExtraBold label, press scale.
 * Busy shows three pulsing dots (never a spinner) and keeps the label for a
 * screen reader. The label wraps onto more lines rather than being cut to "…"
 * — the stacking rule in SheetStepActions keeps that rare.
 */
export function FlowButton({
  title,
  onPress,
  variant = "primary",
  size = "lg",
  icon,
  loading,
  disabled,
  accessibilityLabel,
  style,
}: FlowButtonProps) {
  const isDisabled = disabled || loading;
  const { fill, ink } = LOOK[variant];
  const height = BUTTON_HEIGHT[size];

  return (
    <PressScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={[
        styles.button,
        { minHeight: height, backgroundColor: fill },
        title ? styles.buttonWide : { width: height, height },
        !!title && size !== "lg" && styles.buttonCompact,
        // The busy button keeps its full colour (it is working, not refused);
        // only a disabled one fades.
        disabled && !loading && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <BusyDots color={ink} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === "lg" ? 22 : 18} color={ink} /> : null}
          {title ? (
            <ThemedText
              weight="extrabold"
              style={[styles.buttonLabel, size !== "lg" && styles.buttonLabelCompact, { color: ink }]}
            >
              {title}
            </ThemedText>
          ) : null}
        </>
      )}
    </PressScale>
  );
}

interface ActionsProps {
  submitTitle: string;
  onSubmit: () => void;
  submitting: boolean;
  submitDisabled: boolean;
  onBack: () => void;
}

/**
 * The last step's buttons: Back and Submit. Side by side (a 52pt tonal Back
 * square, then Submit) where the submit label fits beside it; otherwise —
 * small phones, larger text — Submit full width with a full-width Back under
 * it, so the label is never squeezed (see useWalletLayout.sheetActionsStacked).
 * Back is locked while the request is in flight, like the flow itself.
 */
export function SheetStepActions({ submitTitle, onSubmit, submitting, submitDisabled, onBack }: ActionsProps) {
  const { t } = useLanguage();
  const { sheetActionsStacked } = useWalletLayout();

  const submit = (
    <FlowButton
      title={submitTitle}
      onPress={onSubmit}
      loading={submitting}
      disabled={submitDisabled}
      style={sheetActionsStacked ? undefined : styles.submitBeside}
    />
  );

  if (sheetActionsStacked) {
    return (
      <View style={styles.stackedActions}>
        {submit}
        <FlowButton
          title={t.common.back}
          variant="ghost"
          icon="chevron-back"
          onPress={onBack}
          disabled={submitting}
        />
      </View>
    );
  }

  return (
    <View style={styles.actionRow}>
      <FlowButton
        variant="tonal"
        icon="chevron-back"
        onPress={onBack}
        disabled={submitting}
        accessibilityLabel={t.common.back}
      />
      {submit}
    </View>
  );
}

/** How far the page fades into the pinned bar above its buttons. */
const BAR_FADE = 24;
const FADE_COLORS = [withAlpha(theme.colors.background, 0), theme.colors.background] as const;

/**
 * The pinned bar under a flow: the page fades into it over 24pt (no hairline),
 * then the error notice and the buttons on the page fill, 16pt in from the
 * sides. The safe-area bottom comes from the sheet's own bottom padding.
 */
export function FlowActionBar({
  children,
  contentStyle,
}: {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  // The fade is see-through, so a touch there belongs to the form under it
  // (box-none + a pass-through gradient); the solid fill below it is a view of
  // its own that keeps touches, so nothing hidden behind the bar can be hit.
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <LinearGradient pointerEvents="none" colors={FADE_COLORS} style={styles.barFade} />
      <View style={styles.barFill} />
      <View style={[styles.barContent, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: theme.spacing.xs },
  headerRow: { flexDirection: "row", alignItems: "center", minHeight: 56, paddingHorizontal: theme.spacing.sm },
  /** Equal shares of the leftover width keep the title centred between them. */
  side: { flexGrow: 1, flexBasis: 0, minWidth: HEADER_SIDE, alignItems: "flex-start" },
  sideEnd: { alignItems: "flex-end", paddingRight: theme.spacing.sm },
  closeTarget: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  closeDisc: {
    width: CLOSE_DISC,
    height: CLOSE_DISC,
    borderRadius: CLOSE_DISC / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.tonalSoft,
  },
  title: { flexShrink: 1, fontSize: 17, textAlign: "center" },
  titleSpacer: { flexShrink: 1 },
  stepCount: { color: theme.colors.textMuted, textAlign: "right" },
  stepCountBelow: { paddingTop: theme.spacing.xs, paddingHorizontal: ROW_INSET },
  progress: { flexDirection: "row", gap: 6, paddingTop: theme.spacing.xs, paddingHorizontal: ROW_INSET },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.colors.tonalStrong },
  segmentDone: { backgroundColor: theme.colors.primary },
  heading: { paddingTop: theme.spacing.lg, paddingHorizontal: ROW_INSET },
  label: { color: theme.colors.textMuted, paddingBottom: theme.spacing.sm },
  labelInset: { paddingHorizontal: ROW_INSET },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: ROW_INSET,
  },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1, color: theme.colors.textMuted },
  button: {
    borderRadius: theme.radius.button,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  buttonWide: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm },
  buttonCompact: { paddingHorizontal: 18 },
  buttonLabel: { flexShrink: 1, fontSize: 16, textAlign: "center" },
  buttonLabelCompact: { fontSize: 15 },
  disabled: { opacity: 0.4 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  submitBeside: { flex: 1 },
  stackedActions: { gap: theme.spacing.xs },
  bar: { paddingTop: BAR_FADE, paddingHorizontal: ROW_INSET },
  barFade: { position: "absolute", top: 0, left: 0, right: 0, height: BAR_FADE },
  barFill: {
    position: "absolute",
    top: BAR_FADE,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
  },
  barContent: { gap: 10 },
});

/**
 * SheetForm's own pinned-bar chrome (hairline, sheet fill, padding) switched
 * off, so the flow's FlowActionBar — passed as the form's `action` — draws the
 * Marquee fade instead.
 */
export const flowActionBar = StyleSheet.create({
  bar: {
    paddingTop: 0,
    gap: 0,
    borderTopWidth: 0,
    backgroundColor: "transparent",
  },
}).bar;
