import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { LtIcon, type LtIconName } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { LtCard } from "@/lottery/components/Surfaces";
import { TICKET_VIEW_COPY } from "@/lottery/screens/tickets/copy";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";

const C = TICKET_VIEW_COPY.step;

/**
 * "Ticket 2 of 3 with 372694" (TicketView board `tv-step`): the same number
 * bought more than once is several separate tickets, each with its own ID, so
 * the large view steps through them in the order they were bought. The
 * middle line is a polite live region — stepping is announced — and the
 * arrows are the lt-base `.lt-step` squares (44, white, line-strong; mist
 * when there is nowhere to go). One ticket with the number: "Your only
 * ticket with 004821" and both arrows off.
 */
export const SameNumberStepper = memo(function SameNumberStepper({
  number,
  index,
  total,
  onPrev,
  onNext,
}: {
  number: string;
  /** 0-based place of this ticket among the ones with its number. */
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const many = total > 1;
  return (
    <LtCard tone="flat" style={styles.card}>
      <View style={styles.row}>
        <StepButton icon="back" label={C.prev(number)} enabled={index > 0} onPress={onPrev} />
        <View
          style={styles.mid}
          accessible
          accessibilityLabel={many ? C.ofA11y(index + 1, total, number) : C.onlyA11y(number)}
          accessibilityLiveRegion="polite"
        >
          <LtText role="metaB" tabular style={styles.center}>
            {many ? C.of(index + 1, total, number) : C.only(number)}
          </LtText>
          <LtText role="caption" style={styles.center}>
            {many ? C.sameSub : C.onlySub}
          </LtText>
        </View>
        <StepButton icon="next" label={C.next(number)} enabled={index < total - 1} onPress={onNext} />
      </View>
    </LtCard>
  );
});

function StepButton({
  icon,
  label,
  enabled,
  onPress,
}: {
  icon: LtIconName;
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [
        styles.step,
        !enabled && styles.stepOff,
        pressed && enabled && styles.stepPressed,
        pressed && enabled && !reduceMotion && styles.stepDown,
      ]}
    >
      <LtIcon name={icon} size={18} color={enabled ? LT.ink : LT.ink3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  mid: { flex: 1, minWidth: 0, alignItems: "center" },
  center: { textAlign: "center" },
  step: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.lineStrong,
    borderRadius: LT_RADIUS.button,
  },
  stepOff: { backgroundColor: LT.mist, borderColor: LT.line },
  stepPressed: { backgroundColor: LT.cream2 },
  stepDown: { transform: [{ translateY: 1 }] },
});
