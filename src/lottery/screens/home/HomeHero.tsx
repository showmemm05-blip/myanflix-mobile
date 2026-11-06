import { memo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { Countdown } from "@/lottery/components/Countdown";
import { DateStamp } from "@/lottery/components/DateStamp";
import { LtButton } from "@/lottery/components/LtButton";
import { LtIcon, type LtIconName } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { DoubleRule, Guilloche } from "@/lottery/components/Ornaments";
import { StatusPill } from "@/lottery/components/Pills";
import { LtNote, type LtNoteKind } from "@/lottery/components/Surfaces";
import { Ticket } from "@/lottery/components/ticket/Ticket";
import { dateLong, dateMy, dayOf, ks, monthShort, pad, spaced } from "@/lottery/data/format";
import { SAMPLE_HOME_HERO, type DrawInfo, type DrawStatus } from "@/lottery/data/sample";
import { HOME_COPY } from "@/lottery/screens/home/copy";
import { LT, LT_RADIUS, LT_SHADOW, LT_SPACE } from "@/lottery/theme/tokens";

/**
 * The board's stage at 390pt: 164 tall, leaning 4pt past the card's inside
 * on each side (332 wide), two 264pt tickets — back left at −5°, front at
 * +3°. Where the card is narrower (a 360 or 320 phone) the whole stage is
 * drawn smaller by giving the tickets a smaller WIDTH, never a transform
 * scale (which would blur their live text); the spec never crops a ticket.
 */
const STAGE_W = 332;
const STAGE_H = 164;
const TICKET_W = 264;
const STAGE_BLEED = 4;
const CARD_PAD = 16;
const CARD_LINE = 1;

const FAN = [
  { key: "back", ticket: SAMPLE_HOME_HERO.back, left: 2, top: 10, rotate: "-5deg" },
  { key: "front", ticket: SAMPLE_HOME_HERO.front, left: 58, top: 14, rotate: "3deg" },
] as const;

/**
 * 1 · THE HERO — the current draw, the one big thing (Main.dc.html
 * `.lt-hero.lt-buycard.lt-hh`, 22 Oct 2026): the seal double rule and a
 * guilloche corner; "Current draw" + the status pill; "Draw 24" (Literata 44)
 * with its date stamp; the long date, the Burmese date as the ticket prints
 * it, "Draw at 2:00 PM · Sales close 1:00 PM"; then the status box — open:
 * the countdown (a timer, ticking on the server's clock); closed: when the
 * results come; not yet open: that sales have not opened; paused and
 * published (not on the board) the same way; two tickets of THIS draw fanned
 * on the card (its own frame and picture; the numbers are the board's sample
 * ones — decoration, read once as one sentence); the caption; the price line;
 * and ONE seal action: "Choose numbers" (→ Draw) while open, else "See
 * results" (→ Results) with a quiet "My tickets" under it while signed in
 * (the board's `auth.in` lever; a guest sees only "See results").
 */
export const HomeHero = memo(function HomeHero({
  draw,
  status,
  nowMs,
  signedIn,
  onChoose,
  onResults,
  onTickets,
}: {
  draw: DrawInfo;
  /** The status the page acts on (data/draws.ts saleStatus). */
  status: DrawStatus;
  /** The server's now (useLotteryNow), for the countdown. */
  nowMs: number;
  signedIn: boolean;
  onChoose: () => void;
  onResults: () => void;
  onTickets: () => void;
}) {
  const copy = HOME_COPY.hero;
  const open = status === "open";
  const { width: windowWidth } = useWindowDimensions();
  // The content column (the phone's width, or 560 on a tablet) minus the card's padding and line, plus the bleed.
  const column = Math.min(windowWidth, LT_SPACE.contentMax) - 2 * LT_SPACE.gutter;
  const room = column - 2 * (CARD_PAD + CARD_LINE) + 2 * STAGE_BLEED;
  const fit = Math.min(1, room / STAGE_W);
  const ticketWidth = Math.floor(TICKET_W * fit);
  const idOf = (seq: string) => `MFL-${pad(draw.no, 2)}-${seq}`;

  return (
    <View style={styles.card}>
      <DoubleRule tone="seal" style={styles.rule} />
      <Guilloche width={200} height={48} pathWidth={360} style={styles.guilloche} />

      <View style={styles.row}>
        <LtText role="kicker" style={styles.kicker}>
          {copy.kicker}
        </LtText>
        <StatusPill kind={status} label={open ? copy.openPill : undefined} />
      </View>

      <View style={styles.when}>
        <View style={styles.head}>
          <LtText role="displayL" accessibilityRole="header" style={styles.drawNo}>
            {COMPONENT_COPY.drawNo(draw.no)}
          </LtText>
          <DateStamp month={monthShort(draw.dateIso)} day={dayOf(draw.dateIso)} />
        </View>
        <LtText role="title" style={styles.gap4}>
          {dateLong(draw.dateIso)}
        </LtText>
        <LtText role="meta" color={LT.ink2} style={styles.gap2}>
          {dateMy(draw.dateIso)}
        </LtText>
        <LtText role="meta" color={LT.ink2} style={styles.gap4}>
          {copy.times(draw.drawTime, draw.closeTime)}
        </LtText>
        {open && draw.salesCloseAt ? (
          <Countdown variant="card" drawNo={draw.no} salesCloseAt={draw.salesCloseAt} nowMs={nowMs} style={styles.box} />
        ) : (
          <StateNote draw={draw} status={status} />
        )}
      </View>

      {/* Two sample tickets of this draw, fanned (the board's numbers); read once as one sentence. */}
      <View
        style={[styles.stage, { width: STAGE_W * fit, height: STAGE_H * fit }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={copy.stageA11y(draw.no, spaced(FAN[1].ticket.number), spaced(FAN[0].ticket.number))}
      >
        <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {FAN.map((item) => (
            <View
              key={item.key}
              style={[
                styles.fanned,
                { width: ticketWidth, left: item.left * fit, top: item.top * fit, transform: [{ rotate: item.rotate }] },
              ]}
            >
              <Ticket draw={draw} number={item.ticket.number} ticketId={idOf(item.ticket.seq)} width={ticketWidth} />
            </View>
          ))}
        </View>
      </View>
      <LtText role="caption" style={styles.caption}>
        {copy.caption}
      </LtText>

      <View style={styles.facts}>
        <View style={styles.factsIcon}>
          <LtIcon name="tickets" size={16} color={LT.ink3} />
        </View>
        <LtText role="meta" color={LT.ink2} tabular style={styles.factsText}>
          <LtText role="metaB" tabular>
            {ks(draw.price)}
          </LtText>
          {copy.factsRest}
        </LtText>
      </View>

      <View style={styles.action}>
        {open ? (
          <LtButton variant="primary" size="block" label={copy.choose} iconRight="next" onPress={onChoose} />
        ) : (
          <>
            <LtButton variant="primary" size="block" label={copy.seeResults} iconRight="next" onPress={onResults} />
            {signedIn ? (
              <LtButton variant="ghost" size="block" label={copy.myTickets} onPress={onTickets} style={styles.quiet} />
            ) : null}
          </>
        )}
      </View>
    </View>
  );
});

/**
 * The status box when the draw is not open for sale (`.lt-note`): a bold
 * lead and one sentence — closed (lock), not yet open (clock, info tint),
 * paused (warn) and published (check, info tint). Polite live region, so a
 * sale that closes while the page is open is announced.
 */
function StateNote({ draw, status }: { draw: DrawInfo; status: DrawStatus }) {
  const copy = HOME_COPY.hero;
  let kind: LtNoteKind = "plain";
  let icon: LtIconName = "lock";
  let bold: string = copy.closedBold;
  let rest: string = copy.closedRest(draw.closeTime, draw.drawTime);
  if (status === "scheduled") {
    kind = "info";
    icon = "clock";
    bold = copy.scheduledBold;
    rest = copy.scheduledRest(draw.no);
  } else if (status === "paused") {
    kind = "warn";
    icon = "pause";
    bold = copy.pausedBold;
    rest = copy.pausedRest;
  } else if (status === "published") {
    kind = "info";
    icon = "check";
    bold = copy.publishedBold;
    rest = copy.publishedRest(draw.no);
  }
  return (
    <LtNote kind={kind} icon={icon} style={styles.box} live>
      <LtText role="meta" color={LT.ink2}>
        <LtText role="buttonSm">{bold}</LtText>
        {rest}
      </LtText>
    </LtNote>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    paddingVertical: 20,
    paddingHorizontal: CARD_PAD,
    backgroundColor: LT.white,
    borderWidth: CARD_LINE,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    boxShadow: LT_SHADOW.s2,
  },
  rule: { marginBottom: 14 },
  guilloche: { position: "absolute", top: 30, right: 0 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  kicker: { flexShrink: 1 },
  when: { marginTop: 12 },
  head: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  /** `.lt-hh .lt-display-l{line-height:48px}` — the role's own; kept explicit so the stamp lines up with the baseline. */
  drawNo: { flexShrink: 1 },
  gap2: { marginTop: 2 },
  gap4: { marginTop: 4 },
  /** The countdown or the note, 16 under the times. */
  box: { marginTop: 16 },
  stage: { marginTop: 16, alignSelf: "center" },
  fanned: { position: "absolute" },
  caption: { marginTop: 8 },
  facts: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12 },
  factsIcon: { marginTop: 2 },
  factsText: { flex: 1 },
  action: { marginTop: 16 },
  quiet: { marginTop: 4 },
});
