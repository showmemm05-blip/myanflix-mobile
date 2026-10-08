import { useEffect, type ReactNode } from "react";
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

/*
 * The small Marquee pieces the sign-in screens share (Login.dc.html,
 * LoginCode.dc.html, ForgotPassword*.dc.html, SessionOffline.dc.html).
 * Area-local on purpose: the shared Button clips its label to one line by
 * default, and the auth boards need a label that wraps freely (long Burmese
 * at font scale 2.0) and their own 52pt look with a three-dot pulse.
 *
 * Purely presentational — nothing here owns auth state or calls a service.
 */

/** The boards' one motion curve: cubic-bezier(.2,.8,.2,1). */
export const AUTH_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);

/* ------------------------------------------------------------------ */
/* Rise — a step's content entering (.rise: 10pt up + fade, 260ms)     */
/* ------------------------------------------------------------------ */

/**
 * Key it on the step so each step's block fades up as it arrives. A plain
 * timing curve, never a spring: the overshoot-and-settle bounce is what this
 * app stripped out of its sheets for reading as toy-like. Reduce motion: no
 * entrance at all.
 */
export function Rise({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const entering = reduceMotion
    ? undefined
    : FadeInDown.duration(260)
        .easing(AUTH_EASING)
        .withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] });
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

/**
 * .pop: a decorative badge arriving — from 80% and transparent to rest,
 * 400ms after a 100ms beat. Hidden from screen readers. Reduce motion: it is
 * simply there.
 */
export function Pop({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    shown.value = reduceMotion ? 1 : withDelay(100, withTiming(1, { duration: 400, easing: AUTH_EASING }));
  }, [shown, reduceMotion]);
  const animated = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ scale: 0.8 + 0.2 * shown.value }],
  }));
  return (
    // Decorative by contract: a badge restates the title next to it.
    <Animated.View style={[style, animated]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {children}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Dots — "busy" is a pulse, never a spinner                           */
/* ------------------------------------------------------------------ */

const DOT_LOW = 0.25;
const HALF_PULSE_MS = 480;
const DOT_STAGGER_MS = 150;

/** Three pulsing dots (the boards' busy Continue / Verify / Retry / SMS row). Still under reduce motion. */
export function AuthDots({ color, size = 7 }: { color: string; size?: number }) {
  return (
    <View
      style={[styles.dots, { gap: size === 7 ? 7 : 5 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Dot index={0} color={color} size={size} />
      <Dot index={1} color={color} size={size} />
      <Dot index={2} color={color} size={size} />
    </View>
  );
}

function Dot({ index, color, size }: { index: number; color: string; size: number }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : DOT_LOW);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    opacity.value = DOT_LOW;
    opacity.value = withDelay(
      index * DOT_STAGGER_MS,
      withRepeat(withTiming(1, { duration: HALF_PULSE_MS, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
    return () => cancelAnimation(opacity);
  }, [opacity, index, reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, animated]}
    />
  );
}

/* ------------------------------------------------------------------ */
/* AuthButton                                                          */
/* ------------------------------------------------------------------ */

/**
 * - `primary` — crimson commit (Continue, Sign up, Verify, Reset password).
 * - `play` — white with near-black ink (Retry, Back to sign in).
 * - `secondary` — white at 16% (Log out).
 */
export type AuthButtonVariant = "primary" | "play" | "secondary";

const BUTTON_LOOK: Record<AuthButtonVariant, { fill: string; ink: string; weight: "extrabold" | "bold" }> = {
  primary: { fill: theme.colors.primary, ink: theme.colors.onPrimary, weight: "extrabold" },
  play: { fill: theme.colors.play, ink: theme.colors.onPlay, weight: "extrabold" },
  secondary: { fill: theme.colors.tonalStrong, ink: theme.colors.text, weight: "bold" },
};

interface AuthButtonProps {
  title: string;
  onPress: () => void;
  variant?: AuthButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Busy: the label gives way to three pulsing dots and the button is locked. */
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The boards' 52pt, radius-12 button. The label WRAPS rather than clipping —
 * a Burmese "Reset password" at font scale 2.0 needs two lines, and a button
 * that ellipsizes its own verb is worse than a taller one. minHeight, never
 * height, for the same reason. Press = scale .96 (an opacity dip under
 * reduce motion).
 */
export function AuthButton({ title, onPress, variant = "primary", icon, loading, disabled, style }: AuthButtonProps) {
  const reduceMotion = useReducedMotion();
  const look = BUTTON_LOOK[variant];
  const locked = !!loading || !!disabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: look.fill },
        loading ? styles.buttonBusy : disabled ? styles.buttonDisabled : null,
        pressed && !locked && (reduceMotion ? styles.pressedStill : styles.pressed),
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: locked, busy: !!loading }}
    >
      {loading ? (
        <AuthDots color={look.ink} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={look.ink} /> : null}
          <ThemedText weight={look.weight} color={look.ink} style={styles.buttonLabel}>
            {title}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* AuthLink — a quiet 44pt text action under the hairline              */
/* ------------------------------------------------------------------ */

interface AuthLinkProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * `link` — crimson words (#FF4D55, the readable crimson): Forgot password,
   * Request a new code, Choose another method. `plain` — white (Back).
   * `muted` — the running countdown, which is information, not an action.
   */
  tone?: "link" | "plain" | "muted";
  tabular?: boolean;
}

/**
 * Left-aligned like the boards, one per row, a 44pt row however short the
 * label. The label wraps — no numberOfLines — so a Burmese "Request again in
 * 60s" at font scale 2.0 takes a second line instead of an ellipsis.
 */
export function AuthLink({ label, onPress, disabled, icon, tone = "link", tabular }: AuthLinkProps) {
  const reduceMotion = useReducedMotion();
  const color = disabled || tone === "muted" ? theme.colors.textFaint : tone === "plain" ? theme.colors.text : theme.colors.link;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.link, pressed && !disabled && (reduceMotion ? styles.pressedStill : styles.pressed)]}
      hitSlop={{ left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
      <ThemedText
        weight={tone === "muted" ? "bold" : "extrabold"}
        color={color}
        tabular={tabular}
        style={styles.linkLabel}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* AuthError — directly under the fields, danger red, polite live      */
/* ------------------------------------------------------------------ */

/**
 * The error line under the field (or the method rows) it is about. Android
 * reads it through the polite live region; iOS has no live regions, so the
 * message is announced once when it appears or changes.
 */
export function AuthError({ message, style }: { message: string | null; style?: StyleProp<ViewStyle> }) {
  useEffect(() => {
    if (message && Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  if (!message) return null;
  return (
    <View style={[styles.error, style]} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={18} color={theme.colors.danger} style={styles.errorIcon} />
      <ThemedText variant="muted" color={theme.colors.danger} style={styles.flexText}>
        {message}
      </ThemedText>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Hairline, notes, labels                                              */
/* ------------------------------------------------------------------ */

/** The hairline that replaced the ticket's tear: above it what to do, below it the ways out. */
export function AuthDivider() {
  return <View style={styles.divider} />;
}

/** The quiet line under the hairline (One number covers…, Use at least 8 characters…). */
export function AuthNote({ children }: { children: string }) {
  return (
    <ThemedText variant="caption" weight="regular" color={theme.colors.textFaint} style={styles.note}>
      {children}
    </ThemedText>
  );
}

/** The 13/18 bold field label the boards put over every input. */
export function AuthLabel({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <ThemedText variant="caption" weight="bold" color={theme.colors.textMuted}>
        {children}
      </ThemedText>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* StepRail                                                             */
/* ------------------------------------------------------------------ */

interface StepRailProps {
  /** Zero-based index of the current step. */
  index: number;
  count: number;
  /** The rail's own width — 120 on sign-in (4 steps), 96 on reset (3 steps). */
  width: number;
  accessibilityLabel: string;
}

/**
 * 4pt crimson bars over the white-at-25% track, filled up to the current
 * step. Revealed by OPACITY: a UI-thread property that touches no layout,
 * where animating each bar's width or colour would cost a layout pass or a
 * JS-thread frame per step change.
 */
export function StepRail({ index, count, width, accessibilityLabel }: StepRailProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(index);

  useEffect(() => {
    progress.value = withTiming(index, { duration: reduceMotion ? 0 : 200, easing: Easing.out(Easing.cubic) });
  }, [index, progress, reduceMotion]);

  return (
    <View
      style={[styles.rail, { width }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <RailSegment key={i} index={i} progress={progress} />
      ))}
    </View>
  );
}

function RailSegment({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [index - 1, index], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <View style={styles.railSegment}>
      <Animated.View style={[styles.railFill, fill]} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* NumberChip — the number under edit                                   */
/* ------------------------------------------------------------------ */

interface NumberChipProps {
  phone: string;
  /** Given → the chip is the "Change phone number" control (sign-in). Omitted → a plain label (reset). */
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/**
 * A 34pt pill on #1C1C23 with the number in tabular figures. On sign-in the
 * affordance to change the number IS the number (a hairline, then the crimson
 * swap glyph), inside a 44pt target; on the reset screens it only says which
 * number the code belongs to.
 */
export function NumberChip({ phone, onPress, disabled, accessibilityLabel }: NumberChipProps) {
  const reduceMotion = useReducedMotion();
  const pill = (
    <View style={[styles.chip, onPress ? styles.chipAction : styles.chipStatic]}>
      <Ionicons name="call-outline" size={15} color={theme.colors.textFaint} />
      <ThemedText variant="muted" weight="bold" color={theme.colors.text} tabular style={styles.chipNumber}>
        {phone}
      </ThemedText>
      {onPress ? (
        <>
          <View style={styles.chipRule} />
          <Ionicons name="swap-horizontal-outline" size={16} color={disabled ? theme.colors.textFaint : theme.colors.link} />
        </>
      ) : null}
    </View>
  );

  if (!onPress) return <View style={styles.chipRow}>{pill}</View>;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chipTarget,
        pressed && !disabled && (reduceMotion ? styles.pressedStill : styles.pressed),
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? phone}
      accessibilityState={{ disabled: !!disabled }}
    >
      {pill}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* BackDisc — the 40pt round back control (forgot-password top bar)     */
/* ------------------------------------------------------------------ */

export function BackDisc({
  onPress,
  disabled,
  accessibilityLabel,
}: {
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.backTarget,
        disabled && styles.buttonDisabled,
        pressed && !disabled && (reduceMotion ? styles.pressedStill : styles.pressed),
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
    >
      <View style={styles.backDisc}>
        <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* IconDisc — the 56pt round glyph above a forgot-password title        */
/* ------------------------------------------------------------------ */

export function IconDisc({ icon, color }: { icon: keyof typeof Ionicons.glyphMap; color: string }) {
  return (
    <View style={styles.iconDisc} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Ionicons name={icon} size={26} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: "row", alignItems: "center", justifyContent: "center" },

  button: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.radius.button,
  },
  /** The boards' busy button: the fill at 60%, dots in its ink. */
  buttonBusy: { opacity: 0.6 },
  buttonDisabled: { opacity: 0.45 },
  /** 16pt label; wraps and centres — `flexShrink` lets it break inside the row. */
  buttonLabel: { flexShrink: 1, fontSize: 16, textAlign: "center" },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.75 },

  link: {
    alignSelf: "flex-start",
    minHeight: theme.layout.minTouch,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  linkLabel: { flexShrink: 1, fontSize: 15 },

  error: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  /** Sits on the first line's x-height rather than the block's centre. */
  errorIcon: { marginTop: 1 },
  flexText: { flex: 1 },

  divider: { height: 1, backgroundColor: theme.colors.border, marginTop: 28 },
  note: { marginTop: theme.spacing.md },

  rail: { flexDirection: "row", gap: 6 },
  railSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.colors.track, overflow: "hidden" },
  railFill: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.primary },

  chipTarget: { alignSelf: "flex-start", minHeight: theme.layout.minTouch, justifyContent: "center" },
  chipRow: { flexDirection: "row" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: 34,
    paddingVertical: 4,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceElevated,
  },
  chipAction: { paddingHorizontal: 12 },
  chipStatic: { paddingLeft: 12, paddingRight: 14 },
  chipNumber: { flexShrink: 1 },
  chipRule: { width: 1, height: 16, backgroundColor: theme.colors.borderStrong },

  backTarget: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  backDisc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.tonalSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  iconDisc: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
});
