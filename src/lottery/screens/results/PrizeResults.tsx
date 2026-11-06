import { memo, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { LtText } from "@/lottery/components/LtText";
import { WinningTiles } from "@/lottery/components/WinningTiles";
import { ks, rateLabel } from "@/lottery/data/format";
import { COLLAPSED_COUNT, groupsByKey, type PrizeGroup, type PrizeGroupKey, type PrizeSheet } from "@/lottery/data/prizes";
import { RESULTS_COPY } from "@/lottery/screens/results/copy";
import { MoreButton, NumberGrid } from "@/lottery/screens/results/parts";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";

const C = RESULTS_COPY.sheet;

/**
 * "Prize results" — the latest draw's WHOLE prize sheet (Results board
 * `lt-pzs`, owner 15 Oct 2026: prizes are various, not one winning number).
 * Thai structure, nine groups, 173 numbers; the gold marks rank them:
 *
 *   1st prize            the six big gold tiles (lg)
 *   Next to 1st (±1)     two gold-tint numbers
 *   2nd · 3rd            cream number cells, 3 across
 *   4th · 5th            a compact paper grid, 5 across, the first 10 until
 *                        "Show all 50 / 100" (folds again with "Show fewer")
 *   Digit prizes         three boxes; dots stand for the digits that do not
 *                        count (471••• · •••248 · ••••60)
 *
 * Every group head says the amount per ticket and how many numbers it has.
 * The amounts are the draw's own (the Thai prize at the draw's exchange
 * rate, named once under the lead). A screen reader hears each head as one
 * line and each group's numbers as one line, digit by digit.
 */
export const PrizeResults = memo(function PrizeResults({ sheet }: { sheet: PrizeSheet }) {
  const G = useMemo(() => groupsByKey(sheet), [sheet]);
  const nums = sheet.nums;
  const [open, setOpen] = useState<Partial<Record<PrizeGroupKey, boolean>>>({});
  const toggle = (key: PrizeGroupKey) => setOpen((cur) => ({ ...cur, [key]: !cur[key] }));

  return (
    <View style={styles.pzs}>
      <View style={styles.pzsHead}>
        <LtText role="title" accessibilityRole="header">
          {C.title}
        </LtText>
      </View>
      <LtText role="meta" color={LT.ink2} style={styles.lead}>
        {C.lead}
      </LtText>
      {sheet.rate > 0 ? (
        <LtText role="caption" style={styles.rate}>
          {C.rate(rateLabel(sheet.rate))}
        </LtText>
      ) : null}

      {/* 1st prize: the big gold tiles. */}
      <Group group={G.first} what={C.nNumbers(nums.first.length)} first>
        <WinningTiles
          number={nums.first[0]}
          size="lg"
          accessibilityLabel={C.firstA11y(nums.first[0] ?? "")}
          style={styles.below}
        />
      </Group>

      {/* Next to the 1st prize: one less and one more, gold-tinted. */}
      <Group group={G.nearFirst} what={C.nextWhat} whatA11y={C.nextWhatA11y}>
        <NumberList group={G.nearFirst} numbers={nums.nearFirst} variant="next" />
      </Group>

      {/* 2nd (5) and 3rd (10): cream cells, 3 across. */}
      <Group group={G.second} what={C.nNumbers(nums.second.length)}>
        <NumberList group={G.second} numbers={nums.second} variant="cell" />
      </Group>
      <Group group={G.third} what={C.nNumbers(nums.third.length)}>
        <NumberList group={G.third} numbers={nums.third} variant="cell" />
      </Group>

      {/* 4th (50) and 5th (100): the compact grid, folded to the first 10. */}
      {(["fourth", "fifth"] as const).map((key) => (
        <Group key={key} group={G[key]} what={C.nNumbers(nums[key].length)}>
          <CompactGrid group={G[key]} numbers={nums[key]} open={!!open[key]} onToggle={() => toggle(key)} />
        </Group>
      ))}

      {/* The digit prizes: three boxes. */}
      <View style={styles.pz}>
        <LtText role="kicker" accessibilityRole="header" style={styles.digitKicker}>
          {C.digitKicker}
        </LtText>
        <View style={styles.digitBoxes}>
          {(["front3", "back3", "back2"] as const).map((key) => (
            <View key={key} style={styles.digitBox}>
              <GroupHead group={G[key]} what={C.nNumbers(nums[key].length)} small />
              <View style={styles.digitNums}>
                {nums[key].map((n, i) => (
                  <DigitChip key={`${n}-${i}`} digits={n} start={key === "front3"} />
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
});

/** One prize group (board `lt-pz`): a hairline above (none on the 1st), the head, then its numbers. */
function Group({
  group,
  what,
  whatA11y,
  first = false,
  children,
}: {
  group: PrizeGroup;
  what: string;
  whatA11y?: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.pz, first && styles.pzFirst]}>
      <GroupHead group={group} what={what} whatA11y={whatA11y} first={first} />
      {children}
    </View>
  );
}

/**
 * The group head: name and amount on one line (the 1st prize larger, its
 * amount gold-text), "Per ticket · N numbers" under it.
 * Read as one header: "2nd prize. 2,000,000 Ks per ticket, 5 numbers."
 */
function GroupHead({
  group,
  what,
  whatA11y,
  first = false,
  small = false,
}: {
  group: PrizeGroup;
  what: string;
  whatA11y?: string;
  first?: boolean;
  small?: boolean;
}) {
  const amount = ks(group.amount);
  const size = first ? styles.sizeFirst : small ? styles.sizeSmall : null;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={C.headA11y(group.name, amount, whatA11y ?? what)}>
      <View style={styles.head}>
        <LtText role="title" style={[styles.name, size]}>
          {group.name}
        </LtText>
        <LtText role="h" color={first ? LT.goldText : LT.ink} numberOfLines={1} style={[styles.amount, size]}>
          {amount}
        </LtText>
      </View>
      <View style={styles.sub}>
        <LtText role="caption" style={styles.subText}>
          {C.perTicket(what)}
        </LtText>
      </View>
    </View>
  );
}

/**
 * Next to 1st (2 across, gold tint, 48 tall, Literata 24) or 2nd / 3rd (3
 * across, cream-1 cells 40 tall, Literata 20) — one accessible line for the group.
 */
function NumberList({
  group,
  numbers,
  variant,
}: {
  group: PrizeGroup;
  numbers: readonly string[];
  variant: "next" | "cell";
}) {
  const next = variant === "next";
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={C.listA11y(group.name, numbers)} style={styles.below}>
      <NumberGrid
        items={numbers}
        maxCols={next ? 2 : 3}
        cellMin={next ? 112 : 92}
        columnGap={8}
        rowGap={8}
        maxScale={1.3}
        renderCell={(n) => (
          <View style={[styles.cell, next && styles.cellNext]}>
            <LtText role="num" numberOfLines={1} maxFontSizeMultiplier={1.3} style={next ? styles.cellNextText : styles.cellText}>
              {n}
            </LtText>
          </View>
        )}
      />
    </View>
  );
}

/** 4th / 5th: the compact paper grid, 5 across, the first COLLAPSED_COUNT until "Show all". */
function CompactGrid({
  group,
  numbers,
  open,
  onToggle,
}: {
  group: PrizeGroup;
  numbers: readonly string[];
  open: boolean;
  onToggle: () => void;
}) {
  const shown = open ? numbers : numbers.slice(0, COLLAPSED_COUNT);
  const folds = numbers.length > COLLAPSED_COUNT;
  return (
    <>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={C.gridA11y(group.name, shown, numbers.length, open || !folds)}
        style={[styles.grid, styles.below]}
      >
        <NumberGrid
          items={shown}
          maxCols={5}
          cellMin={56}
          columnGap={4}
          rowGap={2}
          maxScale={1.3}
          renderCell={(n) => (
            <View style={styles.gridCell}>
              <LtText role="num" numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.gridText}>
                {n}
              </LtText>
            </View>
          )}
        />
      </View>
      {folds ? (
        <MoreButton
          open={open}
          label={open ? C.showFewer : C.showAll(numbers.length)}
          accessibilityLabel={
            open ? COMPONENT_COPY.results.showFewerA11y(group.name) : COMPONENT_COPY.results.showAllA11y(numbers.length, group.name)
          }
          onPress={onToggle}
          style={styles.more}
        />
      ) : null}
    </>
  );
}

/** A digit prize: the counting digits bold, dots for the ones that do not count. */
function DigitChip({ digits, start }: { digits: string; start: boolean }) {
  const dots = C.dots(6 - digits.length);
  return (
    <View
      style={styles.chip}
      accessible
      accessibilityRole="text"
      accessibilityLabel={start ? C.startsWith(digits) : C.endsWith(digits)}
    >
      {start ? null : (
        <LtText role="title" color={LT.ink3} maxFontSizeMultiplier={1.3} style={styles.chipDots}>
          {dots}
        </LtText>
      )}
      <LtText role="h" maxFontSizeMultiplier={1.3} style={styles.chipDigits}>
        {digits}
      </LtText>
      {start ? (
        <LtText role="title" color={LT.ink3} maxFontSizeMultiplier={1.3} style={styles.chipDots}>
          {dots}
        </LtText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** `.lt-pzs`: 20 below the card's last part, a hairline, 16 inside. */
  pzs: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: LT.line },
  pzsHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  lead: { marginTop: 4 },
  rate: { marginTop: 4 },
  pz: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: LT.line },
  pzFirst: { paddingTop: 0, borderTopWidth: 0 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  /** Literata 600 18/24 (the 1st prize 20/26). */
  name: { flexShrink: 1, minWidth: 0, fontSize: 18, lineHeight: 24 },
  /** Literata 700 18/24, tabular, never wrapped. */
  amount: { fontSize: 18, lineHeight: 24, flexShrink: 0 },
  sizeFirst: { fontSize: 20, lineHeight: 26 },
  sizeSmall: { fontSize: 16, lineHeight: 22 },
  sub: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 8,
    rowGap: 4,
    minHeight: 20,
    marginTop: 2,
  },
  subText: { flexShrink: 1 },
  below: { marginTop: 10 },
  /** `.lt-pznum`: cream-1, line-strong edge, radius 6, 40 tall. */
  cell: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.cream1,
    borderWidth: 1,
    borderColor: LT.lineStrong,
    borderRadius: LT_RADIUS.input,
  },
  /** `.lt-pznums--2`: 48 tall, gold tint, gold line. */
  cellNext: { height: 48, backgroundColor: LT.goldTint, borderColor: LT.goldLine },
  cellText: { fontSize: 20, lineHeight: 26 },
  cellNextText: { fontSize: 24, lineHeight: 28 },
  /** `.lt-pzgrid`: paper, line edge, radius 6, padding 8 / 6. */
  grid: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: LT.paper,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.input,
  },
  gridCell: { height: 28, alignItems: "center", justifyContent: "center" },
  /** Literata 600 14/20, +.02em. */
  gridText: { fontSize: 14, lineHeight: 20, letterSpacing: 0.28 },
  more: { marginTop: 8 },
  digitKicker: { marginBottom: 10 },
  digitBoxes: { gap: 8 },
  /** `.lt-pzx__box`: paper, line edge, radius 8, padding 12. */
  digitBox: {
    padding: 12,
    backgroundColor: LT.paper,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.button,
  },
  digitNums: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  /** `.lt-pzx__n`: 44 tall, gold tint, gold line, radius 6. */
  chip: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 12,
    backgroundColor: LT.goldTint,
    borderWidth: 1,
    borderColor: LT.goldLine,
    borderRadius: LT_RADIUS.input,
  },
  /** Literata 700 22/26, +.06em. */
  chipDigits: { fontSize: 22, lineHeight: 26, letterSpacing: 1.32 },
  /** The dots: ink-3, +.12em. */
  chipDots: { fontSize: 22, lineHeight: 26, letterSpacing: 2.64 },
});
