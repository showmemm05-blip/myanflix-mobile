/**
 * The Thai-style PRIZE TABLE and a published draw's prize SHEET — the pure
 * matching ported from the Results.dc.html and CheckTickets.dc.html board
 * scripts (owner, 15 Oct 2026), fed REAL sheets since phase 3 (2026-10-19):
 * the nine groups, their numbers and their Ks amounts come from
 * GET /lottery/results and GET /lottery/draws/:drawNo/results (the Thai
 * prize in Baht × the draw's exchange rate, worked out by the server at
 * publish). Nothing here fetches or saves; the hooks (hooks/useResults.ts)
 * hand a sheet in and every screen reads it the same way.
 *
 * ─── API for the screens ────────────────────────────────────────────────────
 *
 * Types
 *   PrizeGroupKey  the wire's nine keys (types/lottery.ts LotteryPrizeGroupKey)
 *   PrizeKind      "all" (all six digits) | "front3" | "back3" | "back2"
 *   PrizeGroupSpec { key, name, kind, count, digits, collapsible }   the fixed facts of a group
 *   PrizeGroup     PrizeGroupSpec + { amount (Ks per ticket), baht, numbers }   one group of one sheet
 *   PrizeSheet     { drawNo, dateIso, publishedAt, rate, groups, nums, first }
 *   PrizeWin       { group, matched, amount, start, length }
 *   DigitRange     { start, length }   (cells of the six-digit band to light gold)
 *
 * Table
 *   PRIZE_GROUPS: readonly PrizeGroupSpec[]            the nine groups, in board order
 *   PRIZE_GROUP: Record<PrizeGroupKey, PrizeGroupSpec> the same, by key
 *   PRIZE_GROUP_COUNT = 9
 *   COLLAPSED_COUNT = 10                               4th / 5th on Results: first 10 until "Show all"
 *   EARLIER_COLLAPSED_COUNT = 4                        4th / 5th in an earlier draw's panel
 *
 * Sheets
 *   sheetOf(result: LotteryDrawResult): PrizeSheet     the API's sheet in the screens' shape
 *   groupsByKey(sheet): Record<PrizeGroupKey, PrizeGroup>   the sheet's groups by key
 *
 * Matching (pure)
 *   matchNumber(sheet: PrizeSheet, number: string): PrizeWin[]      every prize, board order; amounts add up
 *   winsFromGroups(number, wonGroups): PrizeWin[]                   a ticket's own wonGroups (no sheet needed)
 *   prizeTotal(wins: readonly PrizeWin[]): number                   Ks for ONE ticket
 *   highlightRanges(wins: readonly PrizeWin[]): DigitRange[]        a six-digit win = [{0,6}] only
 *   highlightMask(wins: readonly PrizeWin[]): boolean[]             six booleans, true = gold cell
 *
 * A ticket can win in more than one group (e.g. 471598 = 3rd prize + First 3
 * digits); every group a number matches is listed and the amounts add up.
 * Six-digit groups need all six digits; First 3 / Last 3 / Last 2 compare the
 * start or the end. Every number is a six-digit STRING — never parse it.
 */
import { COMPONENT_COPY } from "@/lottery/components/copy";
import type { LotteryDrawResult, LotteryPrizeGroupKey } from "@/types/lottery";

export type PrizeGroupKey = LotteryPrizeGroupKey;
export type PrizeKind = "all" | "front3" | "back3" | "back2";

/** What never changes about a group: the boards' name, how it matches, how many numbers, their length. */
export interface PrizeGroupSpec {
  key: PrizeGroupKey;
  /**
   * "1st prize", "Next to 1st prize", … "Last 2 digits" — the boards' names
   * (also "Checking <name>…"), in the Lottery's language at the moment it is
   * read (components/copy.ts `prizeGroups`; Burmese "ပထမဆု" …).
   */
  name: string;
  kind: PrizeKind;
  /** How many numbers the group holds in every draw. */
  count: number;
  /** Digits each of its numbers has: 6, 3 or 2. */
  digits: 6 | 3 | 2;
  /** 4th and 5th: long lists that fold on Results. */
  collapsible: boolean;
}

/** One group of one draw's sheet: the spec plus what the draw paid and listed. */
export interface PrizeGroup extends PrizeGroupSpec {
  /** Ks per winning ticket in this draw (the Thai prize × the draw's rate). */
  amount: number;
  /** The Thai prize per ticket, in Baht. */
  baht: number;
  /** The group's numbers, as the source listed them. */
  numbers: readonly string[];
}

/**
 * A group's spec with its `name` read from the copy each time (an enumerable
 * getter, so a spread — sheetOf, winsFromGroups — copies the name in the
 * language of that moment; the Lottery remounts its tabs when the language
 * changes, so every sheet is built again).
 */
function named(spec: Omit<PrizeGroupSpec, "name">): PrizeGroupSpec {
  return Object.defineProperty({ ...spec }, "name", {
    get: () => COMPONENT_COPY.prizeGroups[spec.key],
    enumerable: true,
  }) as PrizeGroupSpec;
}

/** The nine groups in the boards' order (owner, 15 Oct 2026); the keys are the wire's, the names components/copy.ts `prizeGroups`. */
export const PRIZE_GROUPS: readonly PrizeGroupSpec[] = [
  named({ key: "first", kind: "all", count: 1, digits: 6, collapsible: false }),
  named({ key: "nearFirst", kind: "all", count: 2, digits: 6, collapsible: false }),
  named({ key: "second", kind: "all", count: 5, digits: 6, collapsible: false }),
  named({ key: "third", kind: "all", count: 10, digits: 6, collapsible: false }),
  named({ key: "fourth", kind: "all", count: 50, digits: 6, collapsible: true }),
  named({ key: "fifth", kind: "all", count: 100, digits: 6, collapsible: true }),
  named({ key: "front3", kind: "front3", count: 2, digits: 3, collapsible: false }),
  named({ key: "back3", kind: "back3", count: 2, digits: 3, collapsible: false }),
  named({ key: "back2", kind: "back2", count: 1, digits: 2, collapsible: false }),
];

export const PRIZE_GROUP = Object.fromEntries(PRIZE_GROUPS.map((g) => [g.key, g])) as Record<
  PrizeGroupKey,
  PrizeGroupSpec
>;
export const PRIZE_GROUP_COUNT = PRIZE_GROUPS.length;
/** Results' latest sheet: 4th / 5th show their first two rows of five until "Show all 50 / 100". */
export const COLLAPSED_COUNT = 10;
/** An earlier draw's panel: 4th / 5th show their first four until "Show all". */
export const EARLIER_COLLAPSED_COUNT = 4;

/** The boards' name for a group key; the wire's own name for a key the boards do not know. */
export function groupName(key: string, wireName?: string | null): string {
  return (PRIZE_GROUP as Record<string, PrizeGroupSpec | undefined>)[key]?.name ?? wireName ?? key;
}

export interface PrizeSheet {
  drawNo: number;
  /** The draw's calendar date, "YYYY-MM-DD". */
  dateIso: string;
  /** ISO — when the result was published (prizes awarded; each is paid once the winner's claim is confirmed). */
  publishedAt: string;
  /** Ks per Baht for this draw. */
  rate: number;
  /** The nine groups in board order, each with this draw's amount and numbers. */
  groups: readonly PrizeGroup[];
  /** Every group's numbers by key (the same lists as `groups`). */
  nums: Readonly<Record<PrizeGroupKey, readonly string[]>>;
  /** The 1st prize number ("" when the sheet has none — never on a published draw). */
  first: string;
}

/**
 * The API's sheet in the screens' shape: always all nine groups in board
 * order (a group the wire left out is empty with no amount, so a screen
 * never reads an undefined list), the wire's amounts and numbers kept as
 * sent.
 */
export function sheetOf(result: LotteryDrawResult): PrizeSheet {
  const byKey = new Map(result.groups.map((g) => [g.key, g]));
  const groups: PrizeGroup[] = PRIZE_GROUPS.map((spec) => {
    const wire = byKey.get(spec.key);
    return {
      ...spec,
      amount: wire?.ks ?? 0,
      baht: wire?.baht ?? 0,
      numbers: wire?.numbers ?? [],
    };
  });
  const nums = Object.fromEntries(groups.map((g) => [g.key, g.numbers])) as Record<PrizeGroupKey, readonly string[]>;
  return {
    drawNo: result.drawNo,
    dateIso: result.thaiDrawDate,
    publishedAt: result.publishedAt,
    rate: result.rate,
    groups,
    nums,
    first: nums.first[0] ?? "",
  };
}

/** The sheet's nine groups by key (every key is present: sheetOf fills the missing ones). */
export function groupsByKey(sheet: PrizeSheet): Record<PrizeGroupKey, PrizeGroup> {
  return Object.fromEntries(sheet.groups.map((g) => [g.key, g])) as Record<PrizeGroupKey, PrizeGroup>;
}

export interface PrizeWin {
  group: PrizeGroup;
  /** The prize number or digits that matched: "058314", "471", "60". */
  matched: string;
  /** Ks for one ticket from this group (= group.amount). */
  amount: number;
  /** The matching cells of the six-digit band: 0/6 · 0/3 · 3/3 · 4/2. */
  start: number;
  length: number;
}

export interface DigitRange {
  start: number;
  length: number;
}

const RANGE: Record<PrizeKind, DigitRange> = {
  all: { start: 0, length: 6 },
  front3: { start: 0, length: 3 },
  back3: { start: 3, length: 3 },
  back2: { start: 4, length: 2 },
};

function partOf(number: string, kind: PrizeKind): string {
  const r = RANGE[kind];
  return number.slice(r.start, r.start + r.length);
}

/**
 * Every prize `number` wins on `sheet`, in the groups' order (CheckTickets
 * `match`). Empty = not won. A malformed number (not six digits) wins nothing.
 */
export function matchNumber(sheet: PrizeSheet, number: string): PrizeWin[] {
  if (!/^\d{6}$/.test(number)) return [];
  const wins: PrizeWin[] = [];
  for (const group of sheet.groups) {
    const part = partOf(number, group.kind);
    for (const n of group.numbers) {
      if (n === part) wins.push({ group, matched: n, amount: group.amount, ...RANGE[group.kind] });
    }
  }
  return wins;
}

/**
 * The prizes a ticket's own `wonGroups` (the API's verdict, no sheet
 * needed) say it won, in board order — what My tickets and TicketView show
 * for a published draw whose sheet is not on the page. The matched digits
 * are the ticket's own, cut to the group's kind; the amount is the Ks the
 * API paid for that group.
 */
export function winsFromGroups(
  number: string,
  wonGroups: readonly { key: string; name: string; ks: number }[] | null | undefined,
): PrizeWin[] {
  if (!wonGroups?.length || !/^\d{6}$/.test(number)) return [];
  const wins: PrizeWin[] = [];
  for (const spec of PRIZE_GROUPS) {
    for (const won of wonGroups) {
      if (won.key !== spec.key) continue;
      const matched = partOf(number, spec.kind);
      wins.push({
        group: { ...spec, amount: won.ks, baht: 0, numbers: [matched] },
        matched,
        amount: won.ks,
        ...RANGE[spec.kind],
      });
    }
  }
  return wins;
}

/** What ONE ticket with these wins is paid (the amounts add up). */
export function prizeTotal(wins: readonly PrizeWin[]): number {
  return wins.reduce((sum, w) => sum + w.amount, 0);
}

/**
 * The gold marks over the ticket's number band (CheckTickets `marks`): a
 * six-digit win lights all six and nothing else; otherwise one range per
 * digit-group win (First 3 = cells 0–2, Last 3 = 3–5, Last 2 = 4–5).
 */
export function highlightRanges(wins: readonly PrizeWin[]): DigitRange[] {
  if (wins.some((w) => w.group.kind === "all")) return [{ start: 0, length: 6 }];
  return wins.map((w) => ({ start: w.start, length: w.length }));
}

/** The same as six booleans (Results' check card lights cells one by one). */
export function highlightMask(wins: readonly PrizeWin[]): boolean[] {
  const mask = [false, false, false, false, false, false];
  for (const r of highlightRanges(wins)) for (let i = r.start; i < r.start + r.length; i++) mask[i] = true;
  return mask;
}
