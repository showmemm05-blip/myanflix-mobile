import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { LtNote } from "@/lottery/components/Surfaces";
import { dateShort, ks, spaced } from "@/lottery/data/format";
import { groupName, type PrizeSheet } from "@/lottery/data/prizes";
import { useDrawWinners } from "@/lottery/hooks/useResults";
import { DreamErrorBanner, DreamLoadingLine } from "@/lottery/screens/dreams/DreamStates";
import { HOME_COPY } from "@/lottery/screens/home/copy";
import { TextLink } from "@/lottery/screens/tickets/parts/TextLink";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";
import type { LotteryWinner } from "@/types/lottery";

const C = HOME_COPY.winners;
/** Rows on the page (the board's four); the biggest prizes come first from the API. */
const SHOWN = 4;

/**
 * 4 · RECENT WINNERS (Main.dc.html `.lt-rw`): "Recent winners" + "See all"
 * (→ Results), the line "Previous draw · Sat 24 Oct 2026 · ticket numbers
 * only", then four rows of the previous draw's winning tickets — a rosette
 * on a gold-tint disc, the ticket number over its prize group, the amount
 * in gold (winning only). Numbers only, never a name (owner, 22 Oct 2026).
 *
 * The rows are GET /lottery/draws/:drawNo/winners for the newest published
 * draw. No published draw yet: one line. Loading, failed (Try again) and
 * "no winning tickets" are shown in the rows' place, never over the page —
 * for the results list too (the sheet is its newest), so an unanswered or
 * failed list never reads as "no draw has happened yet".
 */
export const RecentWinners = memo(function RecentWinners({
  sheet,
  loading,
  failed,
  onRetry,
  onSeeAll,
}: {
  /** The newest published sheet; null while there is none. */
  sheet: PrizeSheet | null;
  /** The results list's own state (useResults): still loading / failed, with its retry. */
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onSeeAll: () => void;
}) {
  const winners = useDrawWinners(sheet?.drawNo);
  const items = winners.data?.slice(0, SHOWN);

  return (
    <View>
      <View style={styles.head}>
        <LtText role="title" accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {C.title}
        </LtText>
        <TextLink label={C.seeAll} accessibilityLabel={C.seeAllA11y} onPress={onSeeAll} />
      </View>

      {sheet ? (
        <>
          <LtText role="micro" color={LT.ink3}>
            {C.sub(dateShort(sheet.dateIso))}
          </LtText>
          {items ? (
            items.length ? (
              <View style={styles.list} accessibilityLabel={C.listA11y}>
                {items.map((w, i) => (
                  <WinnerRow key={`${w.number}-${w.groupKey}-${i}`} winner={w} divided={i > 0} />
                ))}
              </View>
            ) : (
              <LtNote style={styles.note}>{C.noneInDraw}</LtNote>
            )
          ) : winners.isError ? (
            <DreamErrorBanner
              title={C.errorTitle}
              text={C.errorText}
              retryLabel={C.retry}
              onRetry={() => winners.refetch()}
              style={styles.note}
            />
          ) : (
            <DreamLoadingLine text={C.loading} style={styles.loading} />
          )}
        </>
      ) : loading ? (
        <DreamLoadingLine text={C.loading} style={styles.loading} />
      ) : failed ? (
        <DreamErrorBanner title={C.errorTitle} text={C.errorText} retryLabel={C.retry} onRetry={onRetry} style={styles.note} />
      ) : (
        <LtNote style={styles.empty}>{C.empty}</LtNote>
      )}
    </View>
  );
});

/** One winning ticket (`.lt-rw__row`): rosette · number over group · "+ 60,000,000 Ks" in gold; read as one line. */
function WinnerRow({ winner, divided }: { winner: LotteryWinner; divided: boolean }) {
  const group = groupName(winner.groupKey, winner.groupName);
  const amount = ks(winner.ks);
  return (
    <View
      style={[styles.row, divided && styles.rowDivided]}
      accessible
      accessibilityLabel={C.rowA11y(spaced(winner.number), group, amount)}
    >
      <View style={styles.rosette}>
        <LtIcon name="results" size={18} color={LT.goldText} />
      </View>
      <View style={styles.main}>
        <LtText role="num" style={styles.number} numberOfLines={1}>
          {winner.number}
        </LtText>
        <LtText role="caption" numberOfLines={1}>
          {group}
        </LtText>
      </View>
      <LtText role="h" color={LT.goldText} style={styles.amount} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {C.amount(amount)}
      </LtText>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40 },
  title: { flexShrink: 1 },
  /** `.lt-list`: white, line, radius 10, the row shadow, rows clipped. */
  list: {
    marginTop: 10,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    boxShadow: LT_SHADOW.s1,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8, paddingHorizontal: 12 },
  rowDivided: { borderTopWidth: 1, borderTopColor: LT.line },
  rosette: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.goldTint,
    borderWidth: 1,
    borderColor: LT.goldLine,
  },
  main: { flex: 1, minWidth: 0 },
  /** Literata 600 20/24, .06em (`.lt-rw__num`). */
  number: { lineHeight: 24 },
  /** Literata 700 16/20 (`.lt-rw__amt`). */
  amount: { fontSize: 16, lineHeight: 20, textAlign: "right" },
  note: { marginTop: 10 },
  loading: { marginTop: 6 },
  empty: { marginTop: 4 },
});
