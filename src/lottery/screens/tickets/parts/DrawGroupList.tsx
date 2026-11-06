import { memo, useMemo } from "react";
import type { ViewInstance } from "react-native";
import type { DrawInfo, TicketItem } from "@/lottery/data/sample";
import { useSheetsByNo } from "@/lottery/hooks/useResults";
import { DrawGroup, type TicketGroupData } from "@/lottery/screens/tickets/parts/DrawGroup";

/** Ticket IDs rise with each sale (MFL-24-000097 < …184), so sorting by ID is buying order. */
function byId(a: TicketItem, b: TicketItem): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Tickets → one group per draw, newest draw first, tickets in buying order
 * inside it. A ticket whose draw is not in `draws` yet waits: it is counted
 * in `pendingDraws` (the page shows a card-shaped skeleton for it).
 */
export function ticketGroupsOf(
  tickets: readonly TicketItem[],
  draws: ReadonlyMap<number, DrawInfo>,
): { groups: TicketGroupData[]; pendingDraws: number } {
  const byDraw = new Map<number, TicketItem[]>();
  for (const t of tickets) {
    const list = byDraw.get(t.drawNo);
    if (list) list.push(t);
    else byDraw.set(t.drawNo, [t]);
  }
  const groups: TicketGroupData[] = [];
  let pendingDraws = 0;
  for (const [drawNo, list] of [...byDraw.entries()].sort((a, b) => b[0] - a[0])) {
    const draw = draws.get(drawNo);
    if (!draw) {
      pendingDraws++;
      continue;
    }
    groups.push({
      drawNo,
      draw,
      tickets: list.slice().sort(byId),
      buys: new Set(list.map((t) => t.purchaseRef)).size,
    });
  }
  return { groups, pendingDraws };
}

/**
 * The draw cards of My tickets AND of History's "Tickets" (shared, so the two
 * cannot drift apart): each published draw's sheet is read once
 * (useSheetsByNo) for the winning number and the gold win line; a card shows
 * without it until it lands. The cards sit straight in the caller's column
 * (no view of their own), so the column's gap spaces them.
 */
export const DrawGroupList = memo(function DrawGroupList({
  groups,
  newIds,
  onOpenTicket,
  onPurchases,
  registerRow,
}: {
  groups: readonly TicketGroupData[];
  /** Tickets bought in this session: their rows carry the New chip. */
  newIds: ReadonlySet<string>;
  onOpenTicket: (ticketId: string) => void;
  /** The card's foot link, "Purchases ›". */
  onPurchases: () => void;
  /** My tickets keeps each row's view, to scroll "Show the new tickets" to the first new one. */
  registerRow?: (ticketId: string, node: ViewInstance | null) => void;
}) {
  const publishedNos = useMemo(
    () => groups.filter((g) => g.draw.status === "published").map((g) => g.drawNo),
    [groups],
  );
  const sheets = useSheetsByNo(publishedNos);
  const withSheets = useMemo(
    () => groups.map((g) => (sheets.has(g.drawNo) ? { ...g, sheet: sheets.get(g.drawNo) } : g)),
    [groups, sheets],
  );
  return (
    <>
      {withSheets.map((group) => (
        <DrawGroup
          key={group.drawNo}
          group={group}
          newIds={newIds}
          onOpenTicket={onOpenTicket}
          onPurchases={onPurchases}
          registerRow={registerRow}
        />
      ))}
    </>
  );
});
