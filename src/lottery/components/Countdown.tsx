import { memo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LtIcon } from "@/lottery/components/LtIcon";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { LtText } from "@/lottery/components/LtText";
import { LT_COPY } from "@/lottery/copy";
import { pad } from "@/lottery/data/format";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

const C = COMPONENT_COPY.countdown;

/** Whole days, hours and minutes from `nowMs` to `untilMs` (never below zero: a sale that just closed reads 0d 00h 00m). */
export function remainingParts(untilMs: number, nowMs: number): { d: number; h: number; m: number } {
  const minutes = Math.max(0, Math.floor((untilMs - nowMs) / 60_000));
  return { d: Math.floor(minutes / 1440), h: Math.floor((minutes % 1440) / 60), m: minutes % 60 };
}

/**
 * "Sales close in 2d 04h 15m" — measured from the server's clock
 * (useLotteryNow, which ticks it) to the draw's `salesCloseAt`; the caller
 * only shows it while the draw is open for sale.
 *
 * card — the cream box in the draw card (lt-base `.lt-countdown`): label
 *   left, the value right in Literata 26 with Franklin unit letters;
 * chip — the Home hero's white pill (Main board `.lt-adchip`): a green clock
 *   and "Draw 24 · Sales close in **2d 04h 15m**".
 *
 * Read as one timer; the visible value is hidden from screen readers.
 */
export const Countdown = memo(function Countdown({
  variant,
  drawNo,
  salesCloseAt,
  nowMs,
  style,
}: {
  variant: "card" | "chip";
  drawNo: number;
  /** ISO — when sales close. */
  salesCloseAt: string;
  /** The server's now on this phone (useLotteryNow). */
  nowMs: number;
  style?: StyleProp<ViewStyle>;
}) {
  const until = Date.parse(salesCloseAt);
  const parts = remainingParts(Number.isFinite(until) ? until : nowMs, nowMs);
  const d = String(parts.d);
  const h = pad(parts.h, 2);
  const m = pad(parts.m, 2);
  const spoken = LT_COPY.countdownA11y(parts.d, parts.h, parts.m);

  if (variant === "chip") {
    return (
      <View
        style={[styles.chip, style]}
        accessible
        accessibilityRole="timer"
        accessibilityLabel={C.chipA11y(drawNo, spoken)}
      >
        <LtIcon name="clock" size={16} color={LT.ok} />
        {/* One line; the Burmese line is much longer than "2d 04h 15m", so it may shrink a little rather than cut off. */}
        <LtText role="metaB" color={LT.ink2} tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {`${C.chipLead(drawNo)}${LT_COPY.countdownLabel} `}
          <LtText role="buttonSm" tabular>{C.value(d, h, m)}</LtText>
        </LtText>
      </View>
    );
  }

  // Nested Text ignores margins, so the units' spacing is a space after each.
  const unit = (text: string) => (
    <LtText role="metaB" color={LT.ink3}>
      {text}
    </LtText>
  );
  return (
    <View style={[styles.card, style]} accessible accessibilityRole="timer" accessibilityLabel={spoken}>
      <View style={styles.label}>
        <LtIcon name="clock" size={16} color={LT.ink3} />
        <LtText role="meta" color={LT.ink2}>
          {LT_COPY.countdownLabel}
        </LtText>
      </View>
      <LtText role="h" numberOfLines={1} style={styles.value}>
        {d}
        {unit(C.units.d)}
        {h}
        {unit(C.units.h)}
        {m}
        {unit(C.units.m)}
      </LtText>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: LT.cream,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.input,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    gap: 8,
    minHeight: 36,
    paddingLeft: 12,
    paddingRight: 14,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.round,
    boxShadow: LT_SHADOW.s1,
  },
  label: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  value: { flexShrink: 0 },
});
