import { memo, useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type ViewInstance } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { DoubleRule, Guilloche } from "@/lottery/components/Ornaments";
import { StatusPill } from "@/lottery/components/Pills";
import { ks } from "@/lottery/data/format";
import { CK_TIME } from "@/lottery/screens/checktickets/checkKit";
import { Confetti, CountUp } from "@/lottery/screens/checktickets/CheckMotion";
import { CHECK_COPY } from "@/lottery/screens/checktickets/copy";
import { LT, LT_EASE, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

const C = CHECK_COPY;

/** The page head with its guilloche band (`.ck-head`): the title, the draw and its date, published. */
export const CheckHead = memo(function CheckHead({
  drawNo,
  day,
  publishedAt,
}: {
  drawNo: number;
  /** "Saturday 24 October 2026". */
  day: string;
  /** "Sat 24 Oct 2026, 6:20 PM" (Myanmar time). */
  publishedAt?: string;
}) {
  return (
    <View style={styles.head}>
      <Guilloche width={200} height={48} pathWidth={360} style={styles.headBand} />
      <View style={styles.headTitle}>
        <LtText role="h" accessibilityRole="header">
          {C.head.title}
        </LtText>
      </View>
      <LtText role="meta" color={LT.ink2} style={styles.headSub}>
        {C.head.sub(drawNo, day)}
      </LtText>
      <View style={styles.headPub}>
        <StatusPill kind="published" />
        {publishedAt ? (
          <LtText role="micro" color={LT.ink2}>
            {C.head.published(publishedAt)}
          </LtText>
        ) : null}
      </View>
    </View>
  );
});

/**
 * The result, compact (`.ck-strip`): 1st prize · Last 2 digits in gold text,
 * then "All prizes ›" back to the whole sheet on Results. Each value is read
 * as one line, digit by digit.
 */
export const ResultStrip = memo(function ResultStrip({
  drawNo,
  values,
  onAllPrizes,
}: {
  drawNo: number;
  values: readonly { name: string; digits: string }[];
  onAllPrizes: () => void;
}) {
  return (
    <View style={styles.strip}>
      <View style={styles.stripValues}>
        {values.map((v, i) => (
          <View
            key={v.name}
            style={[styles.stripValue, i > 0 && styles.stripDivider]}
            accessible
            accessibilityLabel={C.strip.valueA11y(v.name, v.digits)}
          >
            <LtText role="micro" color={LT.ink3} numberOfLines={1}>
              {v.name}
            </LtText>
            <LtText role="num" color={LT.goldText} style={styles.stripNum} numberOfLines={1}>
              {v.digits}
            </LtText>
          </View>
        ))}
      </View>
      <Pressable
        onPress={onAllPrizes}
        accessibilityRole="link"
        accessibilityLabel={C.strip.allPrizesA11y(drawNo)}
        style={({ pressed }) => [styles.allPrizes, pressed && styles.allPrizesPressed]}
      >
        <LtText role="metaB" color={LT.indigo} numberOfLines={1}>
          {C.strip.allPrizes}
        </LtText>
        <LtIcon name="next" size={16} color={LT.indigo} />
      </Pressable>
    </View>
  );
});

/**
 * THE GOLD SUMMARY (`.ck-sum`), only once every ticket is checked: "3 of 4
 * tickets won", the total in display size, "Total prize for Draw 23" — and
 * under it, over a gold hairline, the PRIZE-CLAIM BLOCK (`claim`: Request
 * payment · Requested · Paid · Rejected · Expired; PrizeClaim board, 24 Oct
 * 2026 — prizes are paid by request, not at publish). At the end of an
 * animated run it rises in (360 ms), the total counts up from 0 (24 steps of
 * 50 ms) and a few gold papers fly; after Skip or under reduced motion it is
 * simply there. Nothing won: a calm grey card, "No prize this draw". The
 * words are one focus stop with one spoken line; the claim block keeps its
 * own stops (its button must stay reachable).
 */
export const CheckSummary = memo(function CheckSummary({
  drawNo,
  title,
  total,
  fresh,
  summaryRef,
  onPlaced,
  claim,
}: {
  drawNo: number;
  title: string;
  total: number;
  fresh: boolean;
  summaryRef: (node: ViewInstance | null) => void;
  onPlaced: (y: number, height: number) => void;
  /** The prize-claim section (components/claim/PrizeClaim) when something was won; null otherwise. */
  claim?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const play = fresh && !reduceMotion;
  const none = total === 0;
  const p = useSharedValue(play ? 0 : 1);

  useEffect(() => {
    if (play) p.value = withTiming(1, { duration: CK_TIME.rise, easing: LT_EASE });
  }, [play, p]);
  const rise = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 10 }] }));

  const onLayout = (event: LayoutChangeEvent) => onPlaced(event.nativeEvent.layout.y, event.nativeEvent.layout.height);

  return (
    <Animated.View style={rise} onLayout={onLayout}>
      <View style={[styles.sum, none ? styles.sumNone : styles.sumGold]}>
        <View
          ref={summaryRef}
          accessible
          accessibilityRole="summary"
          accessibilityLabel={C.summary.a11y(drawNo, title, ks(total))}
        >
          <DoubleRule tone="gold" style={styles.rule} />
          <View style={styles.spread}>
            <LtText role="kicker" style={styles.flexText} numberOfLines={1}>
              {C.summary.kicker(drawNo)}
            </LtText>
          </View>
          <LtText role="title" style={styles.sumTitle}>
            {title}
          </LtText>
          <CountUp
            role="display"
            value={total}
            format={ks}
            steps={CK_TIME.sumSteps}
            play={play && !none}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={styles.sumValue}
          />
          <LtText role="meta" color={LT.ink2} style={styles.sumLine}>
            {C.summary.total(drawNo)}
          </LtText>
        </View>
        {none ? null : claim}
        {play && !none ? <Confetti bottom={44} rise={0.45} life={CK_TIME.sumConfettiLife} /> : null}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  head: { position: "relative" },
  /** `.ck-head__g`: the band hangs 6 above the head and runs to the screen edge (−16). */
  headBand: { position: "absolute", top: -6, right: -16 },
  headTitle: { flexDirection: "row", alignItems: "center", gap: 10 },
  headSub: { marginTop: 4 },
  headPub: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 10, rowGap: 6, marginTop: 8 },
  /** A flat card with the gold line (`lt-card--flat lt-card--gold ck-strip`). */
  strip: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 6,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.goldLine,
    borderRadius: LT_RADIUS.card,
    boxShadow: LT_SHADOW.s1,
  },
  stripValues: { flexDirection: "row", alignItems: "stretch", gap: 16, flexShrink: 1, minWidth: 0 },
  stripValue: { minWidth: 0 },
  stripDivider: { paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: LT.line },
  stripNum: { marginTop: 2 },
  allPrizes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 44,
    marginLeft: "auto",
    paddingHorizontal: 8,
    borderRadius: LT_RADIUS.button,
  },
  allPrizesPressed: { backgroundColor: LT.indigoPress },
  sum: {
    overflow: "hidden",
    padding: 16,
    borderWidth: 1,
    borderRadius: LT_RADIUS.card,
  },
  sumGold: { backgroundColor: LT.goldTint, borderColor: LT.goldEdge, boxShadow: LT_SHADOW.wonRing },
  sumNone: { backgroundColor: LT.mist, borderColor: LT.line, boxShadow: LT_SHADOW.s1 },
  rule: { marginBottom: 14 },
  spread: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  flexText: { flex: 1, minWidth: 0 },
  sumTitle: { marginTop: 8 },
  sumValue: { marginTop: 4 },
  sumLine: { marginTop: 2 },
});
