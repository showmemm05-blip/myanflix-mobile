import { memo, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { Countdown } from "@/lottery/components/Countdown";
import { DateStamp } from "@/lottery/components/DateStamp";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { DoubleRule, Guilloche } from "@/lottery/components/Ornaments";
import { StatusPill } from "@/lottery/components/Pills";
import { LtNote } from "@/lottery/components/Surfaces";
import { LT_COPY } from "@/lottery/copy";
import { dateLong, dayOf, group, monthShort } from "@/lottery/data/format";
import type { DrawInfo, DrawStatus } from "@/lottery/data/sample";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

/**
 * THE ONE DRAW CARD (lt-base 6.2b `lt-hero lt-buycard`; owner, 14 Oct 2026):
 * the draw and "your six-digit number" are one card, shared by Home, Draw and
 * Confirm. Top to bottom: the seal double rule and a guilloche corner;
 * "Current draw" + the status pill; "Draw 24" with its date stamp, the long
 * date and times; the countdown (open only); the facts line (the draw's own
 * price and per-number limit); then `children` — the number part (Draw's
 * window), set under a hairline — and the `action` (Home's red button).
 *
 * Paused, closed and not yet on sale (spec §3): no countdown and no number
 * part, the reason as a note instead; the caller passes "See your tickets" as
 * the action. `status` is the status the page acts on (data/draws.ts
 * saleStatus: a close time that has passed counts as closed at once).
 */
export const DrawCard = memo(function DrawCard({
  draw,
  status,
  nowMs,
  action,
  children,
  style,
}: {
  draw: DrawInfo;
  status: DrawStatus;
  /** The server's now (useLotteryNow), for the countdown. */
  nowMs: number;
  action?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const open = status === "open";
  const note =
    status === "paused"
      ? { kind: "warn" as const, icon: "pause" as const, text: LT_COPY.draw.pausedNote }
      : status === "scheduled"
        ? { kind: "plain" as const, icon: "clock" as const, text: LT_COPY.draw.scheduledNote(draw.no) }
        : status === "closed" || status === "published"
          ? { kind: "plain" as const, icon: "lock" as const, text: LT_COPY.draw.closedNote(draw.closeTime, draw.drawTime) }
          : null;
  return (
    <View style={[styles.card, style]}>
      <DoubleRule tone="seal" style={styles.rule} />
      <Guilloche width={200} height={48} pathWidth={360} style={styles.guilloche} />

      <View style={styles.row}>
        <View style={styles.kicker}>
          <LtText role="kicker">{LT_COPY.draw.kicker}</LtText>
        </View>
        <StatusPill kind={status} />
      </View>

      <View style={styles.when}>
        <View style={styles.head}>
          <LtText role="display" accessibilityRole="header">
            {COMPONENT_COPY.drawNo(draw.no)}
          </LtText>
          <DateStamp month={monthShort(draw.dateIso)} day={dayOf(draw.dateIso)} />
        </View>
        <LtText role="title" style={styles.gap4}>
          {dateLong(draw.dateIso)}
        </LtText>
        <LtText role="meta" color={LT.ink2} style={styles.gap4}>
          {COMPONENT_COPY.drawCard.times(draw.drawTime, draw.closeTime)}
        </LtText>
        {open && draw.salesCloseAt ? (
          <Countdown variant="card" drawNo={draw.no} salesCloseAt={draw.salesCloseAt} nowMs={nowMs} style={styles.countdown} />
        ) : null}
      </View>

      <View style={styles.facts}>
        <View style={styles.factsIcon}>
          <LtIcon name="tickets" size={16} color={LT.ink3} />
        </View>
        <LtText role="meta" color={LT.ink2} tabular style={styles.factsText}>
          <LtText role="metaB" tabular>{`${group(draw.price)} Ks`}</LtText>
          {` ${LT_COPY.draw.facts.price} · ${LT_COPY.draw.facts.most} `}
          <LtText role="metaB" tabular>{String(draw.maxPerNumber)}</LtText>
          {` ${LT_COPY.draw.facts.perNumber}`}
        </LtText>
      </View>

      {open && children ? <View style={styles.pick}>{children}</View> : null}
      {note ? (
        <LtNote kind={note.kind} icon={note.icon} style={styles.note} live>
          {note.text}
        </LtNote>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    boxShadow: LT_SHADOW.s2,
  },
  rule: { marginBottom: 14 },
  guilloche: { position: "absolute", top: 30, right: 0 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  kicker: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  when: { marginTop: 12 },
  head: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  gap4: { marginTop: 4 },
  countdown: { marginTop: 16 },
  facts: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12 },
  factsIcon: { marginTop: 2 },
  factsText: { flex: 1 },
  pick: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: LT.line },
  note: { marginTop: 16 },
  action: { marginTop: 16 },
});
