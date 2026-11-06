import { memo } from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from "react-native-reanimated";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { DRAW_COPY } from "@/lottery/screens/draw/copy";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

/**
 * THE UNDO TOAST ("027514 removed · Undo"): the Lottery toast's ink look,
 * padding 2 4 2 14, a trash icon, the line, and a white underlined Undo, 44
 * tall. The Confirm sheet shows it above its buttons; Draw's "Your numbers"
 * shows it where every toast goes, under the top bar.
 *
 * It is NOT live: the caller's polite line already said "… removed. Undo is
 * …". Give it a new `key` for each removal so the entrance plays again.
 * Reduced motion: it fades instead of sliding in.
 */
export const UndoToast = memo(function UndoToast({
  text,
  spoken,
  undoLabel,
  onUndo,
  onFocus,
  onBlur,
  style,
}: {
  /** "027514 removed" / "3 numbers cleared". */
  text: string;
  /** The line read digit by digit. */
  spoken: string;
  /** "Undo: bring back 0 2 7 5 1 4". */
  undoLabel: string;
  onUndo: () => void;
  /** Undo has keyboard focus (a hardware keyboard / switch access): the caller holds the timer. */
  onFocus: () => void;
  onBlur: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={reduceMotion ? FadeIn.duration(120) : FadeInDown.duration(220)}
      exiting={FadeOut.duration(reduceMotion ? 120 : 180)}
      style={[styles.toast, style]}
    >
      <LtIcon name="trash" size={16} color={LT.paper} />
      <LtText role="meta" color={LT.paper} tabular numberOfLines={1} style={styles.text} accessibilityLabel={spoken}>
        {text}
      </LtText>
      <Pressable
        onPress={onUndo}
        onFocus={onFocus}
        onBlur={onBlur}
        accessibilityRole="button"
        accessibilityLabel={undoLabel}
        style={({ pressed }) => [styles.undo, pressed && styles.undoPressed]}
      >
        <LtText role="buttonSm" color={LT.white} style={styles.undoText}>
          {DRAW_COPY.confirm.undo}
        </LtText>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingVertical: 2,
    paddingLeft: 14,
    paddingRight: 4,
    backgroundColor: LT.ink,
    borderRadius: LT_RADIUS.button,
    boxShadow: LT_SHADOW.s2,
  },
  text: { flex: 1, minWidth: 0 },
  undo: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: LT_RADIUS.input,
  },
  undoPressed: { backgroundColor: LT.paperVeil },
  undoText: { textDecorationLine: "underline" },
});
