import type { ReactNode, RefObject } from "react";
import { Pressable, StyleSheet, View, type ViewInstance } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { GlassFace } from "@/components/layout/GlassFace";
import { theme } from "@/theme";

/** The "Top bar" board (2026-11-10): a 40pt pill with 20pt round ends, inside a 44pt target. */
export const GLASS_CHIP_HEIGHT = 40;

interface Props {
  /** The pressable's view, so a screen can hand screen-reader focus back to the chip (the Categories chip). */
  chipRef?: RefObject<ViewInstance | null>;
  /** Solid white with near-black ink — "where you are". */
  selected?: boolean;
  /** The picked genre / category: the same glass tinted red (the board's picked pill). */
  picked?: boolean;
  /** The ✕: a 40pt glass circle. */
  round?: boolean;
  /** Omitted: a label, not a control. */
  onPress?: () => void;
  accessibilityLabel: string;
  /** A chip that opens a menu says whether it is open. */
  expanded?: boolean;
  /** A tighter right edge before a trailing chevron (the board's 16 / 12: the picked name). */
  trailingPad?: boolean;
  /** A tighter left edge before a leading glyph (the board's 10 / 16: "‹ Media"). */
  leadingPad?: boolean;
  /** Greyed and not pressable — the Categories button on Music, which has no categories (MediaMusic.dc.html). */
  disabled?: boolean;
  children: ReactNode;
}

/**
 * The word control in the top bars' rows (the "Top bar" board, 2026-11-10):
 * a 40pt Liquid Glass pill (GlassFace) with white ink — red-tinted glass when
 * `picked`, or solid white with near-black ink when `selected`. It carries
 * the "‹ Media" back control, "Categories ▾" (greyed on Music), the picked
 * genre, the results view's ✕ (a 40pt glass circle) and the Filters page's
 * Reset; every one keeps a 44pt target, and at 2× text the pill grows rather
 * than clipping.
 *
 * Pressed, it shrinks to 96% (Reduce Motion: it stays put and lights up
 * instead). It never dims under a finger, and a greyed pill is drawn with the
 * solid glass (no blur), because an iOS blur under a parent with alpha < 1
 * renders broken.
 */
export function GlassChip({
  chipRef,
  selected = false,
  picked = false,
  round = false,
  onPress,
  accessibilityLabel,
  expanded,
  trailingPad = false,
  leadingPad = false,
  disabled = false,
  children,
}: Props) {
  const reduceMotion = useReducedMotion();
  const face = (pressed: boolean) => (
    <View
      style={[
        styles.chip,
        trailingPad && styles.chipTrailing,
        leadingPad && styles.chipLeading,
        round && styles.chipRound,
        selected && styles.chipSelected,
      ]}
    >
      {selected ? null : (
        <GlassFace radius={GLASS_CHIP_HEIGHT / 2} picked={picked} solid={disabled} pressed={reduceMotion && pressed} />
      )}
      {children}
    </View>
  );

  if (!onPress) {
    return (
      <View style={styles.target} accessible accessibilityLabel={accessibilityLabel} accessibilityState={{ selected }}>
        {face(false)}
      </View>
    );
  }

  const state = {
    selected,
    ...(expanded === undefined ? {} : { expanded }),
    ...(disabled ? { disabled } : {}),
  };
  return (
    <Pressable
      ref={chipRef}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={state}
      style={({ pressed }) => [
        styles.target,
        round && styles.targetRound,
        disabled && styles.disabled,
        pressed && !reduceMotion && styles.pressed,
      ]}
    >
      {({ pressed }) => face(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { minHeight: theme.layout.minTouch, justifyContent: "center" },
  /** The ✕'s 44pt square target around its 40pt circle. */
  targetRound: { minWidth: theme.layout.minTouch, alignItems: "center" },
  /**
   * A minimum, so 2× text grows the chip rather than clipping its label. Not
   * clipped itself: the glass clips its own layers, and its shadow has to
   * fall outside the pill.
   */
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    minHeight: GLASS_CHIP_HEIGHT,
    paddingHorizontal: theme.layout.screenPadding,
    paddingVertical: 4,
    borderRadius: GLASS_CHIP_HEIGHT / 2,
  },
  /** The board: 16pt on the word side, 12pt before the ▾. */
  chipTrailing: { paddingLeft: theme.layout.screenPadding, paddingRight: 12 },
  /** The board: 10pt before the ‹, 16pt on the word side. */
  chipLeading: { paddingLeft: 10, paddingRight: theme.layout.screenPadding },
  chipRound: {
    width: GLASS_CHIP_HEIGHT,
    height: GLASS_CHIP_HEIGHT,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: "center",
  },
  chipSelected: { backgroundColor: theme.colors.play },
  pressed: { transform: [{ scale: 0.96 }] },
  /** The board's greyed pill: the whole target at 45% (its glass is solid, so this is safe on iOS). */
  disabled: { opacity: 0.45 },
});
