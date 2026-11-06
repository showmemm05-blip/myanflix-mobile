import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { LtButton } from "@/lottery/components/LtButton";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { DoubleRule } from "@/lottery/components/Ornaments";
import { StatusPill } from "@/lottery/components/Pills";
import { LtCard } from "@/lottery/components/Surfaces";
import { dateLong, dateTimeLabel } from "@/lottery/data/format";
import type { PrizeSheet } from "@/lottery/data/prizes";
import { useDraw } from "@/lottery/hooks/useDraws";
import { RESULTS_COPY } from "@/lottery/screens/results/copy";
import { PrizeResults } from "@/lottery/screens/results/PrizeResults";
import { ltStop } from "@/lottery/i18n";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";

const C = RESULTS_COPY.latest;

/**
 * The LATEST RESULT card (Results board `lt-result`, round 2): the gold rule,
 * "Latest result" + Result published, "Draw 23", its date and when it was
 * published; then the customer's box — "You have 4 tickets for Draw 23. Open
 * them one by one and see what each one won." and the one big seal button
 * "Check my tickets" (the ticket-by-ticket reveal, CheckTickets); then the
 * whole prize sheet.
 *
 * On purpose this card never says WHETHER a ticket won: the board keeps that
 * for the reveal on Check my tickets, so it stays a surprise. The sheet is
 * the API's (GET /lottery/results); the draw's own time comes from its draw
 * record, read once.
 */
export const LatestResult = memo(function LatestResult({
  sheet,
  mineCount,
  onCheckMine,
}: {
  sheet: PrizeSheet;
  /** How many tickets the customer holds for this draw; undefined while they load. */
  mineCount: number | undefined;
  onCheckMine: () => void;
}) {
  const drawNo = sheet.drawNo;
  const draw = useDraw(drawNo);
  const published = dateTimeLabel(sheet.publishedAt);

  return (
    <LtCard tone="gold">
      <DoubleRule tone="gold" style={styles.rule} />
      <View style={styles.spread}>
        <LtText role="kicker">{C.kicker}</LtText>
        <StatusPill kind="published" />
      </View>
      <LtText role="h" accessibilityRole="header" style={styles.title}>
        {COMPONENT_COPY.drawNo(drawNo)}
      </LtText>
      <LtText role="meta" color={LT.ink2} style={styles.date}>
        {C.date(dateLong(sheet.dateIso), draw.info?.drawTime)}
      </LtText>
      <View style={styles.published}>
        <LtIcon name="check" size={14} color={LT.indigo} />
        <LtText role="caption">{C.published(published)}</LtText>
      </View>

      {/* Your tickets for this draw → the reveal. */}
      <View style={styles.mine}>
        {mineCount === undefined ? (
          <LtText role="meta" color={LT.ink2}>
            {C.mineLoading}
          </LtText>
        ) : mineCount ? (
          <>
            <LtText role="meta" color={LT.ink2}>
              <LtText role="buttonSm">{C.mineLead(mineCount, drawNo)}</LtText>
              {C.mineRest}
            </LtText>
            <LtButton
              variant="primary"
              size="block"
              icon="results"
              label={C.checkMine}
              accessibilityLabel={`${C.checkMine}${ltStop()} ${C.mineLead(mineCount, drawNo)}`}
              onPress={onCheckMine}
              style={styles.checkMine}
            />
          </>
        ) : (
          <LtText role="meta" color={LT.ink2}>
            {C.none(drawNo)}
          </LtText>
        )}
      </View>

      <PrizeResults sheet={sheet} />
    </LtCard>
  );
});

const styles = StyleSheet.create({
  /** lt-base `.lt-rule` keeps 14 under it. */
  rule: { marginBottom: 14 },
  spread: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { marginTop: 10 },
  date: { marginTop: 2 },
  published: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  /** `.lt-result__mine`: cream box, line edge, radius 8, padding 12, 16 below the published line. */
  mine: {
    marginTop: 16,
    padding: 12,
    backgroundColor: LT.cream,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.button,
  },
  checkMine: { marginTop: 10 },
});
