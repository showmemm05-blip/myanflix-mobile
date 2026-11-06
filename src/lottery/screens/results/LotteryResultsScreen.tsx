import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { LotteryFooter } from "@/lottery/components/LotteryFooter";
import { LotteryScreen } from "@/lottery/components/LotteryScreen";
import { LtButton } from "@/lottery/components/LtButton";
import { LtEmpty } from "@/lottery/components/LtEmpty";
import { LtText } from "@/lottery/components/LtText";
import { StatusPill } from "@/lottery/components/Pills";
import { LtCard } from "@/lottery/components/Surfaces";
import { WinningTiles } from "@/lottery/components/WinningTiles";
import { dateLong } from "@/lottery/data/format";
import { useLotteryFocusRefresh } from "@/lottery/hooks/lotteryKeys";
import { useCurrentDraw } from "@/lottery/hooks/useCurrentDraw";
import { useResults } from "@/lottery/hooks/useResults";
import { useDrawTickets } from "@/lottery/hooks/useTickets";
import type { LotteryResultsScreenProps } from "@/lottery/navigation/types";
import { DrawStripSkeleton } from "@/lottery/screens/draw/DrawStates";
import { DreamErrorBanner, DreamLoadingLine } from "@/lottery/screens/dreams/DreamStates";
import { CheckNumber } from "@/lottery/screens/results/CheckNumber";
import { EarlierResults } from "@/lottery/screens/results/EarlierResults";
import { LatestResult } from "@/lottery/screens/results/LatestResult";
import { RESULTS_COPY } from "@/lottery/screens/results/copy";
import { PageHead } from "@/lottery/screens/tickets/parts/PageHead";
import { LT } from "@/lottery/theme/tokens";

const C = RESULTS_COPY;

/**
 * RESULTS (Results.dc.html, round 2 — owner 15 Oct 2026: prizes are various,
 * not one winning number). From the top: the page head; the LATEST result as
 * a gold card holding the customer's "Check my tickets" box and the WHOLE
 * prize sheet — nine groups, 173 numbers, the draw's own Ks amounts, 4th /
 * 5th folded; the NEXT result (the draw on sale or coming up, dashed tiles);
 * "Check a number" (one draw at a time, all nine groups, every prize
 * listed); the earlier results, each opening onto its sheet in short and
 * your tickets for it.
 *
 * The published draws and their sheets are GET /lottery/results (phase 3,
 * 2026-10-19); the next draw is the current one (GET /lottery/draws/current)
 * while it is not published; the customer's tickets for a draw are read per
 * draw as needed. Loading shows the head and two card-shaped skeletons; a
 * failed load, Try again; no published draw yet, "No results yet".
 *
 * "Check my tickets" opens the ticket-by-ticket reveal (the CheckTickets
 * route); ticket links open the ticket INSIDE the Tickets tab (`initial:
 * false`, so My tickets stays underneath and Back returns to it).
 */
export function LotteryResultsScreen({ navigation }: LotteryResultsScreenProps) {
  useLotteryFocusRefresh();
  const results = useResults();
  const sheets = results.sheets;
  const latest = sheets[0];
  const current = useCurrentDraw();
  // The draw whose result is still to come: the current draw, unless the current draw IS the latest result.
  const next = current.data?.info && current.data.info.status !== "published" ? current.data.info : null;
  const latestMine = useDrawTickets(latest?.drawNo);
  const heldNext = useDrawTickets(next?.no);

  const openTicket = useCallback(
    (ticketId: string) =>
      navigation.navigate("LotteryTicketsTab", { screen: "LotteryTicketView", params: { ticketId }, initial: false }),
    [navigation],
  );
  const openTickets = useCallback(
    () => navigation.navigate("LotteryTicketsTab", { screen: "LotteryTickets", pop: true }),
    [navigation],
  );
  const openCheckTickets = useCallback(() => navigation.navigate("CheckTickets"), [navigation]);

  return (
    <LotteryScreen topBar={{ variant: "root" }} contentStyle={styles.content} footer={<LotteryFooter />}>
      <PageHead title={C.title} sub={C.sub} />

      {results.isPending ? (
        <View style={styles.loading}>
          <DreamLoadingLine text={C.loading} />
          <DrawStripSkeleton />
          <DrawStripSkeleton />
        </View>
      ) : results.isError && !latest ? (
        <DreamErrorBanner title={C.errorTitle} text={C.errorText} retryLabel={C.retry} onRetry={() => results.refetch()} />
      ) : latest ? (
        <LatestResult
          sheet={latest}
          mineCount={latestMine.data ? latestMine.tickets.length : latestMine.isError ? 0 : undefined}
          onCheckMine={openCheckTickets}
        />
      ) : (
        <LtEmpty title={C.empty.title} text={C.empty.text} />
      )}

      {/* ----- Next result (not drawn yet) ----- */}
      {next ? (
        <LtCard tone="flat">
          <View style={styles.spread}>
            <LtText role="kicker" accessibilityRole="header">
              {C.next.kicker}
            </LtText>
            <StatusPill kind="waiting" />
          </View>
          <LtText role="title" style={styles.nextTitle}>
            {C.next.title(next.no, next.drawTime, dateLong(next.dateIso))}
          </LtText>
          <WinningTiles size="sm" accessibilityLabel={C.next.notDrawn} style={styles.nextTiles} />
          <LtText role="meta" color={LT.ink2} style={styles.nextMeta}>
            {C.next.close(next.no, next.closeTime)}
          </LtText>
          <View style={[styles.spread, styles.nextMine]}>
            <LtText role="meta" color={LT.ink2} style={styles.flexText}>
              {heldNext.tickets.length ? C.next.hold(heldNext.tickets.length, next.no) : C.next.holdNone(next.no)}
            </LtText>
            {heldNext.tickets.length ? (
              <LtButton
                variant="ghost"
                size="sm"
                label={C.next.seeThem}
                accessibilityLabel={C.next.seeThemA11y}
                onPress={openTickets}
              />
            ) : null}
          </View>
        </LtCard>
      ) : null}

      {latest ? (
        <CheckNumber
          sheets={sheets}
          latestDraw={latest.drawNo}
          onCheckMine={openCheckTickets}
          onOpenTicket={openTicket}
        />
      ) : null}

      {sheets.length > 1 ? <EarlierResults draws={sheets.slice(1)} onOpenTicket={openTicket} /> : null}
    </LotteryScreen>
  );
}

const styles = StyleSheet.create({
  /** The board's `.lt-res .lt-main{padding-top:20px}`. */
  content: { paddingTop: 20 },
  loading: { gap: 16 },
  spread: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  nextTitle: { marginTop: 10 },
  nextTiles: { marginTop: 12 },
  nextMeta: { marginTop: 10 },
  nextMine: { marginTop: 12, paddingTop: 4, borderTopWidth: 1, borderTopColor: LT.line },
  flexText: { flex: 1 },
});
