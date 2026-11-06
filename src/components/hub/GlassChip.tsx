import type { ReactNode, RefObject } from "react";
import { Pressable, StyleSheet, View, type ViewInstance } from "react-native";
import { BlurView } from "expo-blur";
import { useReducedMotion } from "react-native-reanimated";
import { theme, withAlpha } from "@/theme";

/** Boards: a 36pt chip, radius 18, inside a 44pt target. */
export const GLASS_CHIP_HEIGHT = 36;
/** Resting chip fill over the art: white at 14% on a dark blur (boards). */
const RESTING_FILL = withAlpha(theme.colors.text, 0.14);
/** The picked genre's ring — "this is what you are looking at". */
const PICK_RING = withAlpha(theme.colors.text, 0.9);

interface Props {
  /** The pressable's view, so a screen can hand screen-reader focus back to the chip (the Categories chip). */
  chipRef?: RefObject<ViewInstance | null>;
  /** Solid white with near-black ink — "where you are". */
  selected?: boolean;
  /** The picked genre / category: a white ring over the glass. */
  ringed?: boolean;
  /** The ✕: a 36pt circle. */
  round?: boolean;
  /** Omitted: a label, not a control. */
  onPress?: () => void;
  accessibilityLabel: string;
  /** A chip that opens a menu says whether it is open. */
  expanded?: boolean;
  /** A tighter right edge before a trailing chevron (the boards' 14 / 12). */
  trailingPad?: boolean;
  /** A tighter left edge before a leading chevron (the "‹ Media" back chip: 6 / 12). */
  leadingPad?: boolean;
  /** Greyed and not pressable — the "Categories ▾" pill on Music, which has no categories (MediaMusic.dc.html). */
  disabled?: boolean;
  children: ReactNode;
}

/**
 * The Media pages' chip over the hero (the hub boards): dark glass — white at
 * 14% over a blur — with white ink, or solid white with near-black ink when
 * `selected`. It carries the "‹ Media" back control, "Categories ▾" (greyed
 * on Music), the picked genre and the results view's ✕; every one keeps a
 * 44pt target, and at 2× text the chip grows rather than clipping.
 */
export function GlassChip({
  chipRef,
  selected = false,
  ringed = false,
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
  const face = (
    <View
      style={[
        styles.chip,
        trailingPad && styles.chipTrailing,
        leadingPad && styles.chipLeading,
        round && styles.chipRound,
        selected && styles.chipSelected,
        ringed && styles.chipRinged,
      ]}
    >
      {selected ? null : (
        <View style={styles.glass} pointerEvents="none">
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.glassFill]} />
        </View>
      )}
      {children}
    </View>
  );

  if (!onPress) {
    return (
      <View style={styles.target} accessible accessibilityLabel={accessibilityLabel} accessibilityState={{ selected }}>
        {face}
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
        pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
      ]}
    >
      {face}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { minHeight: theme.layout.minTouch, justifyContent: "center" },
  /** The ✕'s 44pt square target around its 36pt disc. */
  targetRound: { minWidth: theme.layout.minTouch, alignItems: "center" },
  /** A minimum, so 2× text grows the chip rather than clipping its label. */
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: GLASS_CHIP_HEIGHT,
    paddingHorizontal: theme.layout.screenPadding,
    paddingVertical: 4,
    borderRadius: GLASS_CHIP_HEIGHT / 2,
    overflow: "hidden",
  },
  chipTrailing: { paddingLeft: 14, paddingRight: 12 },
  chipLeading: { paddingLeft: 6, paddingRight: 12, gap: 2 },
  chipRound: {
    width: GLASS_CHIP_HEIGHT,
    height: GLASS_CHIP_HEIGHT,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: "center",
  },
  chipSelected: { backgroundColor: theme.colors.play },
  chipRinged: { borderWidth: 1.5, borderColor: PICK_RING },
  glass: { ...StyleSheet.absoluteFill, borderRadius: GLASS_CHIP_HEIGHT / 2, overflow: "hidden" },
  glassFill: { backgroundColor: RESTING_FILL },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.75 },
  /** The board's greyed pill: the whole target at 45%. */
  disabled: { opacity: 0.45 },
});
