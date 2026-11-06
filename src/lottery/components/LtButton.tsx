import { memo, type Ref } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewInstance,
  type ViewStyle,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { LtIcon, type LtIconName } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { MYANMAR_SCRIPT } from "@/lottery/theme/type";
import { LT_COPY } from "@/lottery/copy";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";

export type LtButtonVariant = "primary" | "secondary" | "ghost";
/** block 52 (full width) · md 48 · sm 40 · xs 36 — sm and xs still reach 44 with hitSlop. */
export type LtButtonSize = "block" | "md" | "sm" | "xs";

export interface LtButtonProps {
  variant?: LtButtonVariant;
  size?: LtButtonSize;
  label: string;
  /** A leading icon (16). */
  icon?: LtIconName;
  /** The icons' size: 16 by default (Draw's "Add to list" uses 18, board `.lt-add svg`). */
  iconSize?: number;
  /** A trailing icon (16) — "See your tickets ›", "Find your number ⌄". */
  iconRight?: LtIconName;
  onPress: () => void;
  disabled?: boolean;
  /** Processing: a spinner (three still dots under reduced motion) + "Processing…", width kept, presses ignored. */
  busy?: boolean;
  /** The word shown (and spoken) while busy; "Processing…" by default (Results' check says "Checking…"). */
  busyLabel?: string;
  accessibilityLabel?: string;
  /** Why it is disabled, or what it does, when the label alone does not say (Confirm: "Short by 2,500 Ks…"). */
  accessibilityHint?: string;
  /**
   * Secondary only: "indigo" sets the label and icon in indigo and presses to
   * the indigo tint (Draw's "Add to list": a second action that must not look
   * like the seal-red buy). Disabled looks like any disabled secondary.
   */
  tone?: "ink" | "indigo";
  style?: StyleProp<ViewStyle>;
  /** The pressable itself, so a screen can move a screen reader to it (Draw's Buy after Confirm closes). */
  buttonRef?: Ref<ViewInstance>;
}

const HEIGHT: Record<LtButtonSize, number> = { block: 52, md: 48, sm: 40, xs: 36 };

interface Ink {
  bg: string;
  pressed: string;
  border: string;
  text: string;
}

/** Rest · pressed · disabled per variant (lt-base 6.5; hover does not exist on a phone). */
const INK: Record<LtButtonVariant, { rest: Ink; disabled: Ink }> = {
  primary: {
    rest: { bg: LT.seal, pressed: LT.sealPress, border: "transparent", text: LT.white },
    disabled: { bg: LT.disabled, pressed: LT.disabled, border: "transparent", text: LT.ink3 },
  },
  secondary: {
    rest: { bg: LT.white, pressed: LT.cream2, border: LT.lineStrong, text: LT.ink },
    disabled: { bg: LT.mist, pressed: LT.mist, border: LT.line, text: LT.ink3 },
  },
  ghost: {
    rest: { bg: "transparent", pressed: LT.indigoPress, border: "transparent", text: LT.indigo },
    disabled: { bg: "transparent", pressed: "transparent", border: "transparent", text: LT.ink3 },
  },
};

/** The secondary button in indigo ink (`tone="indigo"`, Draw board `.lt-add`). */
const SECONDARY_INDIGO: Ink = { bg: LT.white, pressed: LT.indigoPress, border: LT.lineStrong, text: LT.indigo };

/**
 * The Lottery button. Seal red is the ONE main action on a screen; secondary
 * is white with a line-strong outline; ghost is indigo text. Pressed moves the
 * button 1pt down (off under reduced motion). A busy button keeps its width
 * and its colours (it is not "disabled" to the eye, only to the finger) and
 * says "Processing…".
 */
export const LtButton = memo(function LtButton({
  variant = "primary",
  size = "md",
  label,
  icon,
  iconRight,
  iconSize = 16,
  onPress,
  disabled = false,
  busy = false,
  busyLabel = LT_COPY.processing,
  accessibilityLabel,
  accessibilityHint,
  tone = "ink",
  style,
  buttonRef,
}: LtButtonProps) {
  const reduceMotion = useReducedMotion();
  const ink =
    disabled && !busy
      ? INK[variant].disabled
      : tone === "indigo" && variant === "secondary"
        ? SECONDARY_INDIGO
        : INK[variant].rest;
  const small = size === "sm" || size === "xs";
  const height = HEIGHT[size];
  // sm (40) and xs (36) reach the 44pt target over their own edges (lt-base ::after inset −2 / −4).
  const slop = Math.max(0, (44 - height) / 2);

  const burmeseLabel = MYANMAR_SCRIPT.test(label);
  return (
    <Pressable
      ref={buttonRef}
      onPress={busy || disabled ? undefined : onPress}
      disabled={disabled || busy}
      hitSlop={slop ? { top: slop, bottom: slop } : undefined}
      accessibilityRole="button"
      accessibilityLabel={busy ? busyLabel : (accessibilityLabel ?? label)}
      accessibilityHint={busy ? undefined : accessibilityHint}
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          paddingHorizontal: small ? 14 : 20,
          backgroundColor: pressed && !busy ? ink.pressed : ink.bg,
          borderColor: ink.border,
        },
        size === "block" && styles.block,
        pressed && !busy && !disabled && !reduceMotion && styles.pressed,
        style,
      ]}
    >
      {/* The label stays in the layout while busy (invisible), so the width never jumps. */}
      <View style={[styles.row, busy && styles.hidden]}>
        {icon ? <LtIcon name={icon} size={iconSize} color={ink.text} /> : null}
        <LtText
          role={small ? "buttonSm" : "button"}
          color={ink.text}
          numberOfLines={1}
          // Burmese runs longer than English: a Burmese label shrinks to fit rather than
          // cut its amount (RN 0.88's new architecture has no floor for this, so the
          // Burmese copy is kept short enough that it barely shrinks). English never.
          adjustsFontSizeToFit={burmeseLabel}
        >
          {label}
        </LtText>
        {iconRight ? <LtIcon name={iconRight} size={iconSize} color={ink.text} /> : null}
      </View>
      {busy ? (
        <View style={[StyleSheet.absoluteFill, styles.row, styles.center]}>
          {reduceMotion ? <StillDots color={ink.text} /> : <ActivityIndicator size="small" color={ink.text} />}
          <LtText role={small ? "buttonSm" : "button"} color={ink.text} numberOfLines={1}>
            {busyLabel}
          </LtText>
        </View>
      ) : null}
    </Pressable>
  );
});

/** Reduced motion's stand-in for the spinner (lt-base `.lt-dots`). */
function StillDots({ color }: { color: string }) {
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.dot, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

export interface LtIconButtonProps {
  icon: LtIconName;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
  /** Icon size; 20 by default (lt-base `.lt-iconbtn svg`). */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** A 44 × 44 icon-only button (sheet close). */
export const LtIconButton = memo(function LtIconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled = false,
  color = LT.ink2,
  size = 20,
  style,
}: LtIconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed, style]}
    >
      <LtIcon name={icon} size={size} color={disabled ? LT.lineStrong : color} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: LT_RADIUS.button,
    borderWidth: 1,
  },
  block: { alignSelf: "stretch" },
  pressed: { transform: [{ translateY: 1 }] },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  center: { justifyContent: "center" },
  hidden: { opacity: 0 },
  dots: { flexDirection: "row", alignItems: "center", gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: LT_RADIUS.button,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPressed: { backgroundColor: LT.cream2 },
});
