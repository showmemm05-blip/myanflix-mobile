import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { LtButton } from "@/lottery/components/LtButton";
import { LtText } from "@/lottery/components/LtText";
import { NumberWindow } from "@/lottery/components/NumberWindow";
import { DoubleRule } from "@/lottery/components/Ornaments";
import { StatusPill } from "@/lottery/components/Pills";
import { LtCard } from "@/lottery/components/Surfaces";
import { dateLong, ks, spaced } from "@/lottery/data/format";
import { groupsByKey, type PrizeGroup, type PrizeSheet } from "@/lottery/data/prizes";
import { DrawStripSkeleton } from "@/lottery/screens/draw/DrawStates";
import { DreamErrorBanner, DreamLoadingLine } from "@/lottery/screens/dreams/DreamStates";
import { HOME_COPY } from "@/lottery/screens/home/copy";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";

const C = HOME_COPY.results;

/**
 * 3 · LATEST RESULTS (Main.dc.html `.lt-lr`): the previous draw's sheet,
 * compact, on a gold-lined card — "Result published", "Previous draw" and
 * its date; the 1st prize amount in gold and its number in the ticket
 * number window's shape but in gold (winning only); the pair next to it;
 * one line of the three digit prizes; then "All results" (→ Results) and
 * "Check my tickets" (→ the ticket-by-ticket reveal for that draw) — seal
 * red only when signed in with tickets for it, else a plain secondary (and,
 * signed out, the way to sign in).
 *
 * The sheet is the newest published draw (GET /lottery/results); amounts are
 * the API's Ks per winning ticket. No published draw yet: "Waiting for
 * draw", "No results yet", the dashed empty window and when the first
 * results come (the current draw's time and date). While the list loads, a
 * skeleton; failed, Try again — this section alone, never the whole page.
 */
export const LatestResults = memo(function LatestResults({
  sheet,
  loading,
  failed,
  nextLine,
  hasTickets,
  signedIn,
  onRetry,
  onAll,
  onCheck,
}: {
  /** The newest published sheet; null while there is none. */
  sheet: PrizeSheet | null;
  loading: boolean;
  failed: boolean;
  /** No results yet: when the first ones come. */
  nextLine: string;
  /** The customer holds tickets for `sheet`'s draw. */
  hasTickets: boolean;
  signedIn: boolean;
  onRetry: () => void;
  onAll: () => void;
  onCheck: () => void;
}) {
  if (loading && !sheet) {
    return (
      <View style={styles.loading}>
        <DreamLoadingLine text={C.loading} />
        <DrawStripSkeleton />
      </View>
    );
  }
  if (failed && !sheet) {
    return <DreamErrorBanner title={C.errorTitle} text={C.errorText} retryLabel={C.retry} onRetry={onRetry} />;
  }
  if (!sheet) {
    return (
      <LtCard>
        <DoubleRule tone="gold" style={styles.rule} />
        <View style={styles.row}>
          <LtText role="kicker">{C.kicker}</LtText>
          <StatusPill kind="waiting" />
        </View>
        <LtText role="title" accessibilityRole="header" style={styles.title}>
          {C.none.title}
        </LtText>
        <NumberWindow tone="gold" value="" accessibilityLabel={C.none.windowA11y} style={styles.window} />
        <LtText role="meta" color={LT.ink2} style={styles.emptyLine}>
          {nextLine}
        </LtText>
        <View style={styles.actions}>
          <LtButton variant="secondary" size="md" label={C.all} onPress={onAll} style={styles.action} />
        </View>
      </LtCard>
    );
  }

  const g = groupsByKey(sheet);
  const first = sheet.first;
  const firstAmount = ks(g.first.amount);
  const [nearA = "", nearB = ""] = sheet.nums.nearFirst;
  const nearAmount = ks(g.nearFirst.amount);

  return (
    <LtCard tone="gold">
      <DoubleRule tone="gold" style={styles.rule} />
      <View style={styles.row}>
        <LtText role="kicker">{C.kicker}</LtText>
        <StatusPill kind="published" />
      </View>
      <LtText role="title" accessibilityRole="header" style={styles.title}>
        {C.title}
      </LtText>
      <LtText role="meta" color={LT.ink2} style={styles.date}>
        {dateLong(sheet.dateIso)}
      </LtText>

      {/* 1st prize: the head reads the whole sentence; the gold window under it is the picture of the number. */}
      <View style={styles.first}>
        <View style={styles.head} accessible accessibilityLabel={C.firstA11y(spaced(first), firstAmount)}>
          <LtText role="title" style={styles.name} numberOfLines={1}>
            {C.first}
          </LtText>
          <LtText role="h" color={LT.goldText} style={styles.amount} numberOfLines={1}>
            {firstAmount}
          </LtText>
        </View>
        <View style={styles.window} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <NumberWindow tone="gold" value={first} />
        </View>
      </View>

      <View style={styles.next} accessible accessibilityLabel={C.nextA11y(spaced(nearA), spaced(nearB), nearAmount)}>
        <View style={styles.head}>
          <LtText role="title" style={[styles.name, styles.nameSm]} numberOfLines={1}>
            {C.next}
          </LtText>
          <LtText role="h" style={[styles.amount, styles.amountSm]} numberOfLines={1}>
            {nearAmount}
          </LtText>
        </View>
        <View style={styles.pair}>
          {[nearA, nearB].map((number, i) => (
            <View key={i} style={styles.pairCell}>
              <LtText role="num" style={styles.pairDigits} maxFontSizeMultiplier={1.2} numberOfLines={1}>
                {number}
              </LtText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.strip}>
        <DigitCell label={C.front3} group={g.front3} spoken={C.front3A11y} />
        <DigitCell label={C.back3} group={g.back3} spoken={C.back3A11y} />
        <DigitCell label={C.back2} group={g.back2} spoken={C.back2A11y} />
      </View>

      <View style={styles.actions}>
        <LtButton variant="secondary" size="md" label={C.all} onPress={onAll} style={styles.action} />
        <LtButton
          variant={signedIn && hasTickets ? "primary" : "secondary"}
          size="md"
          label={C.check}
          accessibilityLabel={signedIn ? C.checkA11y : C.checkSignIn}
          onPress={onCheck}
          style={[styles.action, styles.actionWide]}
        />
      </View>
    </LtCard>
  );
});

/** One digit prize (`.lt-lr__strip > li`): FIRST 3 · "471 · 905" · "40,000 Ks" — read as one line. */
function DigitCell({
  label,
  group,
  spoken,
}: {
  label: string;
  group: PrizeGroup;
  spoken: (numbers: string, amount: string) => string;
}) {
  const amount = ks(group.amount);
  return (
    <View style={styles.cell} accessible accessibilityLabel={spoken(group.numbers.map(spaced).join(C.or), amount)}>
      <LtText role="kicker" numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {label}
      </LtText>
      <LtText role="num" style={styles.cellValue} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {group.numbers.join(" · ")}
      </LtText>
      <LtText role="micro" color={LT.goldText} tabular numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.cellAmount}>
        {amount}
      </LtText>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { gap: 12 },
  rule: { marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { marginTop: 8 },
  date: { marginTop: 2 },
  first: { marginTop: 16 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  name: { flexShrink: 1 },
  /** Literata 700 20/26 (`.lt-lr__amt`). */
  amount: { fontSize: 20, lineHeight: 26 },
  nameSm: { fontSize: 16, lineHeight: 22 },
  amountSm: { fontSize: 16, lineHeight: 22 },
  /** The window keeps the number window's own 360 cap; the card's inside is narrower on every phone. */
  window: { marginTop: 10 },
  next: { marginTop: 14 },
  pair: { flexDirection: "row", gap: 8, marginTop: 8 },
  pairCell: {
    flex: 1,
    minWidth: 0,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.goldTint,
    borderWidth: 1,
    borderColor: LT.goldLine,
    borderRadius: LT_RADIUS.input,
  },
  /** Literata 600 24/28, .06em; the left pad cancels the trailing letter-space so the digits sit centred. */
  pairDigits: { fontSize: 24, lineHeight: 28, paddingLeft: 24 * 0.06 },
  strip: { flexDirection: "row", gap: 8, marginTop: 12 },
  cell: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: LT.goldTint,
    borderWidth: 1,
    borderColor: LT.goldLine,
    borderRadius: LT_RADIUS.input,
  },
  /** Literata 600 16/22, .04em. */
  cellValue: { marginTop: 2, fontSize: 16, lineHeight: 22, letterSpacing: 16 * 0.04, paddingLeft: 16 * 0.04 },
  cellAmount: { marginTop: 2 },
  emptyLine: { marginTop: 14 },
  actions: { flexDirection: "row", gap: 8, marginTop: 16 },
  /** Both actions fill the row (1 : 1.35), each with the board's 10pt side padding so the words fit. */
  action: { flex: 1, paddingHorizontal: 10 },
  actionWide: { flex: 1.35 },
});
