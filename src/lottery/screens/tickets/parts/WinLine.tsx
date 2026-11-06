import { memo } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { StatusPill } from "@/lottery/components/Pills";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";

/**
 * The win line (lt-base 6.11 `.lt-winline`): the Won pill, then a title over
 * a gold-text line, on a gold tint inside a gold hairline — gold is for
 * winning only. Results' latest card, TicketView's compare and the Draw 23
 * group head on My tickets all use it; with `onPress` it is one 56pt button
 * with a gold chevron (the group head's "One of your tickets won ›").
 *
 * `kind="notwon"` is the same line for a ticket that did not win: mist and
 * ink-3, the Not won pill, no gold at all (TicketView only; no board shows it).
 */
export const WinLine = memo(function WinLine({
  title,
  sub,
  spoken,
  kind = "won",
  onPress,
  accessibilityHint,
  style,
}: {
  title: string;
  sub: string;
  /** The whole line as a screen reader should hear it (numbers digit by digit). */
  spoken: string;
  kind?: "won" | "notwon";
  onPress?: () => void;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const won = kind === "won";
  const body = (
    <>
      <StatusPill kind={won ? "won" : "notwon"} />
      <View style={styles.text}>
        <LtText role="metaB">{title}</LtText>
        <LtText role="micro" tabular color={won ? LT.goldText : LT.ink3}>
          {sub}
        </LtText>
      </View>
      {onPress ? <LtIcon name="next" size={20} color={won ? LT.goldText : LT.ink3} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.line, !won && styles.plain, style]} accessible accessibilityLabel={spoken}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.line,
        styles.button,
        !won && styles.plain,
        pressed && (won ? styles.wonPressed : styles.plainPressed),
        style,
      ]}
    >
      {body}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: LT.goldTint,
    borderWidth: 1,
    borderColor: LT.goldLine,
    borderRadius: LT_RADIUS.input,
  },
  button: { minHeight: 56 },
  plain: { backgroundColor: LT.mist, borderColor: LT.line },
  wonPressed: { backgroundColor: LT.goldPress },
  plainPressed: { backgroundColor: LT.cream2 },
  text: { flex: 1, minWidth: 0 },
});
