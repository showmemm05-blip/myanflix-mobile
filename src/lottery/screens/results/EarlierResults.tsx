import { memo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { LtButton } from "@/lottery/components/LtButton";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { StatusPill } from "@/lottery/components/Pills";
import { Ticket, type TicketDraw } from "@/lottery/components/ticket/Ticket";
import { LT_COPY } from "@/lottery/copy";
import { dateShort, ks } from "@/lottery/data/format";
import {
  EARLIER_COLLAPSED_COUNT,
  matchNumber,
  type PrizeGroupKey,
  type PrizeSheet,
} from "@/lottery/data/prizes";
import type { TicketItem, TicketStatus } from "@/lottery/data/sample";
import { useDraw } from "@/lottery/hooks/useDraws";
import { useDrawTickets } from "@/lottery/hooks/useTickets";
import { DreamLoadingLine } from "@/lottery/screens/dreams/DreamStates";
import { RESULTS_COPY } from "@/lottery/screens/results/copy";
import { MoreButton, TurningChevron } from "@/lottery/screens/results/parts";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

const C = RESULTS_COPY.earlier;
const SHEET = RESULTS_COPY.sheet;

const DIGIT_GROUPS = ["front3", "back3", "back2"] as const;
/** Over this many numbers a group folds to its first EARLIER_COLLAPSED_COUNT (the board's `big`). */
const BIG = 10;

/**
 * "Earlier results" (Results board `lt-er`, round 2): one row per earlier
 * draw — the draw and its date, then its 1st prize in gold text with the Last
 * 2 digits under it — opening IN PLACE onto the draw's whole sheet in short
 * (one line per six-digit group, 4th and 5th showing their first four until
 * "Show all"; the three digit prizes side by side) and then "Your tickets for
 * Draw 22" (each ticket a 120pt picture with its number, ID and result, → the
 * ticket) or "You had no tickets for Draw 21.". One row open at a time; the
 * newest earlier draw starts open, as on the board.
 *
 * The sheets are the API's (GET /lottery/results); a row's tickets and its
 * draw (for the papers' picture and price) are read when it opens.
 */
export const EarlierResults = memo(function EarlierResults({
  draws,
  onOpenTicket,
}: {
  /** The earlier published draws' sheets, newest first. */
  draws: readonly PrizeSheet[];
  onOpenTicket: (ticketId: string) => void;
}) {
  const [open, setOpen] = useState<number | null>(draws[0]?.drawNo ?? null);
  const newest = draws[0];
  const oldest = draws[draws.length - 1];

  return (
    <View>
      <View style={styles.head}>
        <View style={styles.headTitle}>
          <LtText role="title" accessibilityRole="header">
            {C.title}
          </LtText>
        </View>
        {draws.length ? (
          <LtText role="micro" color={LT.ink3}>
            {C.range(newest.drawNo, oldest.drawNo)}
          </LtText>
        ) : null}
      </View>

      <View style={styles.list}>
        {draws.map((sheet, i) => (
          <ResultRow
            key={sheet.drawNo}
            sheet={sheet}
            divided={i > 0}
            expanded={open === sheet.drawNo}
            onToggle={() => setOpen((current) => (current === sheet.drawNo ? null : sheet.drawNo))}
            onOpenTicket={onOpenTicket}
          />
        ))}
      </View>
    </View>
  );
});

function ResultRow({
  sheet,
  divided,
  expanded,
  onToggle,
  onOpenTicket,
}: {
  sheet: PrizeSheet;
  divided: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpenTicket: (ticketId: string) => void;
}) {
  const drawNo = sheet.drawNo;
  const nums = sheet.nums;
  const first = nums.first[0] ?? "";
  const last2 = nums.back2.join(" ");
  const day = dateShort(sheet.dateIso);
  // The row's tickets and draw are asked for when it opens (one row at a time), then kept in the cache.
  const mine = useDrawTickets(expanded ? drawNo : undefined);
  const drawQuery = useDraw(expanded ? drawNo : undefined);
  const draw: TicketDraw = drawQuery.info ?? { no: drawNo, dateIso: sheet.dateIso, price: 0 };
  const tickets = mine.tickets;

  return (
    <View style={divided && styles.divided}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={C.rowA11y(drawNo, day, first, nums.back2[0] ?? "")}
        accessibilityHint={C.rowHint}
        style={({ pressed }) => [styles.row, (expanded || pressed) && styles.rowOn]}
      >
        <View style={styles.rowMain}>
          <LtText role="title" style={styles.rowDraw}>
            {COMPONENT_COPY.drawNo(drawNo)}
          </LtText>
          <LtText role="caption">{day}</LtText>
        </View>
        <View style={styles.rowEnd}>
          <LtText role="num" color={LT.goldText} numberOfLines={1}>
            {first}
          </LtText>
          <View style={styles.rowL2}>
            <LtText role="caption" numberOfLines={1}>
              {C.last2}
            </LtText>
            <LtText role="h" numberOfLines={1} style={styles.rowLast2}>
              {last2}
            </LtText>
          </View>
        </View>
        <TurningChevron open={expanded} from={90} to={-90} size={20} color={expanded ? LT.ink2 : LT.ink3} name="next" />
      </Pressable>

      {expanded ? (
        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <LtText role="kicker" accessibilityRole="header" style={styles.panelTitle}>
              {C.sheetLabel(drawNo)}
            </LtText>
          </View>

          <MiniSheet sheet={sheet} />

          <LtText role="kicker" accessibilityRole="header" style={styles.mineTitle}>
            {C.mine(drawNo)}
          </LtText>

          {mine.isPending ? (
            <DreamLoadingLine text={C.mineLoading} style={styles.mineState} />
          ) : mine.isError ? (
            <View style={styles.mineState}>
              <LtText role="meta" color={LT.err}>
                {C.mineError}
              </LtText>
              <LtButton variant="ghost" size="sm" label={C.retry} onPress={() => mine.refetch()} style={styles.retry} />
            </View>
          ) : tickets.length ? (
            <>
              {tickets.map((ticket) => {
                const status = ticketResult(sheet, ticket);
                return (
                  <Pressable
                    key={ticket.id}
                    onPress={() => onOpenTicket(ticket.id)}
                    accessibilityRole="button"
                    accessibilityLabel={COMPONENT_COPY.results.ticketA11y(ticket.number, ticket.id, LT_COPY.pills[status])}
                    accessibilityHint={C.ticketHint}
                    style={({ pressed }) => [styles.ticket, pressed && styles.ticketPressed]}
                  >
                    <Ticket draw={draw} number={ticket.number} ticketId={ticket.id} width={120} mode="thumb" />
                    <View style={styles.ticketMain}>
                      <LtText role="num">{ticket.number}</LtText>
                      <LtText role="micro" color={LT.ink2} tabular style={styles.ticketId}>
                        {ticket.id}
                      </LtText>
                      <StatusPill kind={status} />
                    </View>
                  </Pressable>
                );
              })}
              <View style={styles.panelFoot}>
                <LtText role="metaB" color={LT.ink2} tabular>
                  {C.foot(tickets.length, drawQuery.info ? ks(tickets.length * drawQuery.info.price) : null)}
                </LtText>
                {tickets.length === 1 ? (
                  <LtText role="micro" color={LT.ink3}>
                    {C.bought(tickets[0].boughtAt)}
                  </LtText>
                ) : null}
              </View>
            </>
          ) : (
            <View style={styles.none}>
              <LtIcon name="tickets" size={18} color={LT.ink3} />
              <LtText role="meta" color={LT.ink2} style={styles.noneText}>
                {C.none(drawNo)}
              </LtText>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

/** A ticket's result on this sheet (the sheet is published, so it is won or not won — never waiting). */
function ticketResult(sheet: PrizeSheet, ticket: TicketItem): TicketStatus {
  return matchNumber(sheet, ticket.number).length ? "won" : "notwon";
}

/**
 * The draw's sheet in short (board `lt-mini`): one line per six-digit group
 * — name (+ "· 50 numbers" for the long ones) and "400,000 Ks each", then its
 * numbers (the 1st prize bold gold-text) — the 4th and 5th folded to their
 * first four; then the three digit prizes side by side. Each line is read as
 * one sentence, digit by digit.
 */
function MiniSheet({ sheet }: { sheet: PrizeSheet }) {
  const [open, setOpen] = useState<Partial<Record<PrizeGroupKey, boolean>>>({});
  const sixDigit = sheet.groups.filter((g) => g.kind === "all");
  const digit = DIGIT_GROUPS.map((key) => sheet.groups.find((g) => g.key === key)).filter((g) => g !== undefined);

  return (
    <View style={styles.mini}>
      {sixDigit.map((group, i) => {
        const all = group.numbers;
        const big = all.length > BIG;
        const groupOpen = !!open[group.key];
        const shown = big && !groupOpen ? all.slice(0, EARLIER_COLLAPSED_COUNT) : all;
        const amount = ks(group.amount);
        const isFirst = group.key === "first";
        return (
          <View key={group.key} style={[styles.miniItem, i > 0 && styles.miniDivided]}>
            <View
              accessible
              accessibilityLabel={C.groupA11y(group.name, shown, all.length - shown.length, amount)}
            >
              <View style={styles.miniTop}>
                <LtText role="metaB" style={styles.miniName}>
                  {C.groupName(group.name, all.length, big)}
                </LtText>
                <LtText role="micro" color={LT.ink2} tabular>
                  {C.each(amount)}
                </LtText>
              </View>
              <View style={styles.miniNums}>
                {shown.map((n, i) => (
                  <LtText
                    key={`${n}-${i}`}
                    role={isFirst ? "h" : "title"}
                    color={isFirst ? LT.goldText : LT.ink}
                    style={styles.miniNum}
                  >
                    {n}
                  </LtText>
                ))}
              </View>
            </View>
            {big ? (
              <MoreButton
                size="xs"
                open={groupOpen}
                label={groupOpen ? SHEET.showFewer : SHEET.showAll(all.length)}
                accessibilityLabel={
                  groupOpen
                    ? COMPONENT_COPY.results.showFewerA11y(group.name)
                    : COMPONENT_COPY.results.showAllA11y(all.length, group.name)
                }
                onPress={() => setOpen((cur) => ({ ...cur, [group.key]: !cur[group.key] }))}
                style={styles.miniMore}
              />
            ) : null}
          </View>
        );
      })}

      {/* The digit prizes, side by side. */}
      <View style={[styles.miniItem, styles.miniDivided, styles.miniDigits]}>
        {digit.map((group) => {
          const amount = ks(group.amount);
          return (
            <View
              key={group.key}
              style={styles.miniDigit}
              accessible
              accessibilityLabel={C.digitA11y(group.name, group.numbers, amount)}
            >
              <LtText role="micro">{group.name}</LtText>
              <View style={styles.miniDigitNums}>
                {group.numbers.map((n, i) => (
                  <LtText key={`${n}-${i}`} role="title" style={styles.miniNum}>
                    {n}
                  </LtText>
                ))}
              </View>
              <LtText role="micro" color={LT.ink2} tabular>
                {C.each(amount)}
              </LtText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** lt-base `.lt-sec__head`: title left, the range right, 40 tall. */
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40 },
  headTitle: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  list: {
    marginTop: 12,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    overflow: "hidden",
    boxShadow: LT_SHADOW.s1,
  },
  divided: { borderTopWidth: 1, borderTopColor: LT.line },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 12,
  },
  rowOn: { backgroundColor: LT.cream },
  rowMain: { flex: 1, minWidth: 0 },
  /** Literata 600 16/20 (lt-base `.lt-prow__draw`). */
  rowDraw: { fontSize: 16, lineHeight: 20 },
  /** `.lt-xrow__end`: the 1st prize over "Last 2 digits 38", right-aligned. */
  rowEnd: { alignItems: "flex-end" },
  rowL2: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  /** Literata 700 13/16, +.04em. */
  rowLast2: { fontSize: 13, lineHeight: 16, letterSpacing: 0.52 },
  panel: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: LT.paper,
    borderTopWidth: 1,
    borderTopColor: LT.line,
  },
  panelHead: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 8,
    rowGap: 4,
  },
  panelTitle: { flexShrink: 1 },
  /** `.lt-mini`: white, line edge, radius 8, 10 below the head. */
  mini: {
    marginTop: 10,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.button,
  },
  miniItem: { paddingVertical: 8, paddingHorizontal: 12 },
  miniDivided: { borderTopWidth: 1, borderTopColor: LT.line },
  miniTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    columnGap: 8,
  },
  miniName: { flexShrink: 1 },
  /** Literata 15/22, +.04em; the board's 8pt word spacing becomes a 12pt gap between numbers. */
  miniNums: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, marginTop: 2 },
  miniNum: { fontSize: 15, lineHeight: 22, letterSpacing: 0.6 },
  miniMore: { marginTop: 4 },
  miniDigits: { flexDirection: "row", gap: 4 },
  miniDigit: { flex: 1, minWidth: 0 },
  miniDigitNums: { flexDirection: "row", flexWrap: "wrap", columnGap: 10 },
  mineTitle: { marginTop: 16 },
  mineState: { marginTop: 8 },
  /** The ghost button's text lines up with the line above it. */
  retry: { alignSelf: "flex-start", marginLeft: -14 },
  ticket: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    marginHorizontal: -6,
    padding: 6,
    borderRadius: LT_RADIUS.button,
  },
  ticketPressed: { backgroundColor: LT.cream },
  ticketMain: { flex: 1, minWidth: 0, alignItems: "flex-start", gap: 4 },
  ticketId: { letterSpacing: 0.24 },
  panelFoot: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    rowGap: 4,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: LT.line,
  },
  none: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  noneText: { flex: 1 },
});
