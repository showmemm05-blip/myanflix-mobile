import { memo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { Ticket, type TicketDraw } from "@/lottery/components/ticket/Ticket";
import { THAI_TEMPLATE, TICKET_ASPECT } from "@/lottery/components/ticket/template";
import { spaced, ticketA11y } from "@/lottery/data/format";
import { foldPile, PILE_MAX, type TicketPile as TicketPileData } from "@/lottery/data/piles";
import type { TicketItem } from "@/lottery/data/sample";
import { ltCopy, type LtWiden } from "@/lottery/i18n";
import { LT, LT_EASE, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

/**
 * The pile's own words. A shared component, so they live here rather than in
 * one screen's copy.ts (the integration step may move them into LT_COPY).
 * English and Burmese (4 Nov 2026, lottery/i18n.ts): TICKET_PILE_COPY_EN and
 * its Burmese twin, wrapped by `ltCopy`.
 */
const TICKET_PILE_COPY_EN = {
  /** One paper as a button: "Ticket 2 of 3, 3 7 2 6 9 4, MFL-24-000184" (the board's `s.label`). */
  paperA11y: (pos: number, count: number, number: string, id: string, isNew: boolean) =>
    `Ticket ${pos} of ${count}, ${spaced(number)}, ${id}${isNew ? ", new" : ""}`,
  /** One paper as a picture (no `onOpenTicket`): its place, then the ticket's own label. */
  paperImageA11y: (pos: number, count: number, label: string) => `Ticket ${pos} of ${count}. ${label}`,
  /** A pile of one: just the ticket's own label (+ ", new"). */
  singleA11y: (label: string, isNew: boolean) => (isNew ? `${label} New.` : label),
  openHint: "Opens the ticket",
  more: (hidden: number) => `+${hidden} more`,
  moreA11y: (hidden: number) => `${hidden} more tickets with this number`,
  fewer: "Show fewer",
  badge: (count: number) => `×${count}`,
} as const;

const TICKET_PILE_COPY_MM: LtWiden<typeof TICKET_PILE_COPY_EN> = {
  // "Ticket 2 of 3" is the paper's place in the pile ("3 စောင်အနက် 2 စောင်မြောက်"), never a lottery number.
  paperA11y: (pos: number, count: number, number: string, id: string, isNew: boolean) =>
    `လက်မှတ် ${count} စောင်အနက် ${pos} စောင်မြောက်၊ ${spaced(number)}၊ ${id}${isNew ? "၊ အသစ်" : ""}`,
  paperImageA11y: (pos: number, count: number, label: string) => `လက်မှတ် ${count} စောင်အနက် ${pos} စောင်မြောက်။ ${label}`,
  singleA11y: (label: string, isNew: boolean) => (isNew ? `${label} အသစ်။` : label),
  openHint: "လက်မှတ်ကို ဖွင့်ပါမည်",
  more: (hidden: number) => `နောက်ထပ် ${hidden} စောင်`,
  moreA11y: (hidden: number) => `ဤဂဏန်းဖြင့် နောက်ထပ် လက်မှတ် ${hidden} စောင်`,
  fewer: "လျှော့ပြရန်",
  badge: (count: number) => `×${count}`,
};

export const TICKET_PILE_COPY = ltCopy(TICKET_PILE_COPY_EN, TICKET_PILE_COPY_MM);

const C = TICKET_PILE_COPY;

/** Share of a ticket's height each paper behind shows: the number, its digit words and both dates (board: 37%). */
export const PILE_STRIP_SHARE = 0.37;
/** The slim "+N more" / "Show fewer" strip: 36 seen, 44 to tap (8 more reach up over the strip above). */
const MORE_H = 36;
const MORE_REACH = 8;
const BADGE = 36;
/** The tag's bottom sits this far above the strip's lower edge (6 of paper under a 20-tall tag). */
const TAG_LIFT = 26;
/** The tag's right edge stays this far left of the QR (which starts at the template's qr.x). */
const TAG_QR_GAP = 4;

/** Strips the "+N more" strip lets out slide down 16 from under the one above (reduced motion: they just appear). */
const STRIP_IN = FadeInDown.duration(220)
  .easing(LT_EASE)
  .withInitialValues({ transform: [{ translateY: -16 }] });

export interface TicketPileProps {
  /** One number in one draw (data/piles.ts `pileTickets`); tickets in buying order, the last one is the front. */
  pile: TicketPileData;
  /** The pile's draw — what every paper prints and the spoken date. */
  draw: TicketDraw;
  /**
   * Opens one ticket: every strip and the front become their own button
   * ("Ticket 2 of 3, …"). Without it the papers are pictures, each read with
   * its ticket label (CheckTickets shows the pile that way).
   */
  onOpenTicket?: (ticketId: string) => void;
  /** Tickets bought in this session: their spoken labels end ", new". */
  newIds?: ReadonlySet<string>;
  /** Controlled fold for a pile of more than PILE_MAX; leave unset and the pile keeps its own. */
  open?: boolean;
  /** Starting fold when uncontrolled (the board's bigPile "open" lever). */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Drawn over each paper, inside a box exactly the ticket's size (W × W ÷
   * 1.915), never taking touches — e.g. CheckTickets' gold marks over the
   * matching digits of the number band (the band lies inside every strip).
   */
  renderPaperOverlay?: (ticket: TicketItem, size: { width: number; height: number }) => ReactNode;
  /** Tag a pile of one too ("1 · MFL-25-000123"): My tickets shows every number the same way (owner, 27 Oct 2026). */
  tagSingle?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * SAME NUMBER, ONE PILE — the cascade (Tickets.dc.html `tk-pile`, owner
 * 15 Oct 2026). Tickets with the same number in the same draw lie on one
 * pile, oldest at the top, the newest in front, whole. Each ticket behind is
 * a WHOLE Thai ticket pulled up under the next one, so only its top strip
 * shows — 37% of its height: the number, the digit words and both dates.
 * Nothing is cropped except by the next paper lying on it, and nothing is
 * scaled (each paper is a <Ticket width={W}>).
 *
 * Every paper carries the tag "1 · MFL-24-000097" over the left half's
 * printed heading (its right edge 4 left of the QR, never over the number
 * band); a seal "×3" sits on the pile's top-right corner. Over PILE_MAX (4)
 * tickets the pile folds: strips 1–3, one slim "+N more" strip that opens the
 * pile in place ("Show fewer" closes it), then the front.
 *
 * Geometry: the pile measures its own width W; a ticket is H = W ÷ 1.915
 * tall; a strip's box is 0.37 H tall and its whole ticket hangs out of it
 * (overflow visible), so the next paper — drawn later, so on top — starts
 * 37% down the one behind it and takes every touch below that line. A strip's
 * button is therefore exactly the paper you can see.
 *
 * The pile's caption, status and Won tint belong to the screen (My tickets
 * prints "372694 × 3 · 3,000 Ks" + one pill under it; CheckTickets its
 * result panel). A pile of one is just the ticket: no seal, and no tag unless
 * `tagSingle` (My tickets).
 */
export const TicketPile = memo(function TicketPile({
  pile,
  draw,
  onOpenTicket,
  newIds,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  renderPaperOverlay,
  tagSingle = false,
  style,
}: TicketPileProps) {
  const reduceMotion = useReducedMotion();
  const [W, setW] = useState(0);
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const open = openProp ?? ownOpen;
  const fold = foldPile(pile, open);
  const H = W / TICKET_ASPECT;

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (Math.abs(next - W) > 0.5) setW(next);
  };

  const toggle = () => {
    const next = !open;
    if (openProp === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };

  // Until the width is known, hold the pile's height (strips + front; the slim strip is left out) so nothing jumps.
  const heightHold: ViewStyle | undefined =
    W > 0 ? undefined : { aspectRatio: TICKET_ASPECT / (fold.strips.length * PILE_STRIP_SHARE + 1) };

  return (
    <View onLayout={onLayout} style={[styles.pile, heightHold, style]}>
      {W > 0 ? (
        <>
          {fold.strips.map((ticket, i) => (
            <Paper
              key={ticket.id}
              ticket={ticket}
              draw={draw}
              pos={i + 1}
              count={pile.count}
              W={W}
              H={H}
              strip
              first={i === 0}
              enter={open && fold.folds && i >= PILE_MAX - 1 && !reduceMotion}
              isNew={!!newIds?.has(ticket.id)}
              onOpenTicket={onOpenTicket}
              renderPaperOverlay={renderPaperOverlay}
            />
          ))}
          {fold.folds ? (
            <Pressable
              onPress={toggle}
              hitSlop={{ top: MORE_REACH }}
              accessibilityRole="button"
              accessibilityLabel={open ? C.fewer : C.moreA11y(fold.hidden)}
              accessibilityState={{ expanded: open }}
              style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
            >
              <View style={styles.moreEdge} pointerEvents="none" />
              <LtText role="buttonSm" color={LT.indigo} tabular maxFontSizeMultiplier={1.3} numberOfLines={1}>
                {open ? C.fewer : C.more(fold.hidden)}
              </LtText>
              <View style={open ? styles.chevronUp : undefined}>
                <LtIcon name="down" size={16} color={LT.indigo} />
              </View>
            </Pressable>
          ) : null}
          <Paper
            ticket={fold.front}
            draw={draw}
            pos={pile.count}
            count={pile.count}
            W={W}
            H={H}
            strip={false}
            first={pile.count === 1}
            enter={false}
            isNew={!!newIds?.has(fold.front.id)}
            onOpenTicket={onOpenTicket}
            renderPaperOverlay={renderPaperOverlay}
            tagSingle={tagSingle}
          />
          {pile.count > 1 ? (
            <View
              style={styles.badge}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <View style={styles.badgeRing} />
              <LtText role="h" color={LT.white} style={styles.badgeText} maxFontSizeMultiplier={1}>
                {C.badge(pile.count)}
              </LtText>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
});

interface PaperProps {
  ticket: TicketItem;
  draw: TicketDraw;
  /** 1-based place in buying order (the tag's red figure). */
  pos: number;
  count: number;
  W: number;
  H: number;
  /** A paper behind: its box is the visible strip only; the rest hangs under the next paper. */
  strip: boolean;
  /** The top paper casts no shadow upwards. */
  first: boolean;
  /** Let out by "+N more": slides down from under the strip above. */
  enter: boolean;
  isNew: boolean;
  onOpenTicket?: (ticketId: string) => void;
  renderPaperOverlay?: TicketPileProps["renderPaperOverlay"];
  /** A pile of one still carries its tag. */
  tagSingle?: boolean;
}

/** One ticket of the pile: the whole paper, its tag, and (as a button) the tap that opens it. */
function Paper({
  ticket,
  draw,
  pos,
  count,
  W,
  H,
  strip,
  first,
  enter,
  isNew,
  onOpenTicket,
  renderPaperOverlay,
  tagSingle,
}: PaperProps) {
  const boxHeight = strip ? H * PILE_STRIP_SHARE : H;
  const tagPlace: ViewStyle = {
    top: H * PILE_STRIP_SHARE - TAG_LIFT,
    right: W * (1 - THAI_TEMPLATE.qr.x) + TAG_QR_GAP,
  };

  // The paper itself is artwork: the box around it carries the one spoken label.
  const paper = (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Ticket
        draw={draw}
        number={ticket.number}
        ticketId={ticket.id}
        width={W}
        style={first ? undefined : styles.upShadow}
      />
      {renderPaperOverlay ? (
        <View style={[styles.overlay, { width: W, height: H }]} pointerEvents="none">
          {renderPaperOverlay(ticket, { width: W, height: H })}
        </View>
      ) : null}
    </View>
  );

  const tag = (pressed: boolean) => (
    <View
      style={[styles.tag, tagPlace, pressed && styles.tagPressed]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LtText role="microB" color={LT.seal} tabular maxFontSizeMultiplier={1.15} numberOfLines={1}>
        {String(pos)}
      </LtText>
      <LtText role="micro" color={LT.ink2} maxFontSizeMultiplier={1.15}>
        ·
      </LtText>
      <LtText role="micro" color={LT.ink} tabular maxFontSizeMultiplier={1.15} numberOfLines={1}>
        {ticket.id}
      </LtText>
    </View>
  );

  const box: ViewStyle = { width: W, height: boxHeight };
  const single = count === 1;
  const tagged = !single || !!tagSingle;
  const own = ticketA11y(ticket.drawNo, draw.dateIso, ticket.id, ticket.number);
  const body = onOpenTicket ? (
    <Pressable
      onPress={() => onOpenTicket(ticket.id)}
      accessibilityRole="button"
      accessibilityLabel={single ? C.singleA11y(own, isNew) : C.paperA11y(pos, count, ticket.number, ticket.id, isNew)}
      accessibilityHint={C.openHint}
      style={box}
    >
      {({ pressed }) => (
        <>
          {paper}
          {tagged ? tag(pressed) : null}
        </>
      )}
    </Pressable>
  ) : (
    <View
      style={box}
      accessible
      accessibilityRole="image"
      accessibilityLabel={single ? C.singleA11y(own, isNew) : C.paperImageA11y(pos, count, own)}
    >
      {paper}
      {tagged ? tag(false) : null}
    </View>
  );

  if (!enter) return body;
  return <Animated.View entering={STRIP_IN}>{body}</Animated.View>;
}

const styles = StyleSheet.create({
  /** Overflow stays visible: the seal reaches 9 past the corner and each strip's paper hangs below its box. */
  pile: { position: "relative", width: "100%" },
  upShadow: { boxShadow: LT_SHADOW.pileUp },
  overlay: { position: "absolute", left: 0, top: 0 },
  /** White paper label with a hairline (lt-base tag radius 4); Franklin 12/16, the position in seal red. */
  tag: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 3,
    minHeight: 20,
    paddingHorizontal: 5,
    borderRadius: LT_RADIUS.tag,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.lineStrong,
    boxShadow: LT_SHADOW.s1,
  },
  tagPressed: { backgroundColor: LT.cream, borderColor: LT.field },
  /** "+N more" / "Show fewer": a slim strip of folded paper edges between the strips and the front. */
  more: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
    minHeight: MORE_H,
    paddingTop: 6,
    paddingHorizontal: 12,
    borderRadius: LT_RADIUS.ticket,
    backgroundColor: LT.ticketPaper,
    boxShadow: LT_SHADOW.pileMore,
  },
  morePressed: { backgroundColor: LT.indigoPress },
  /** The folded edges: two hairlines 4 down, 8 in from each side. */
  moreEdge: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 4,
    height: 5,
    borderTopWidth: 1,
    borderTopColor: LT.lineStrong,
    borderBottomWidth: 1,
    borderBottomColor: LT.line,
  },
  chevronUp: { transform: [{ rotate: "180deg" }] },
  /** The seal: count of papers in the pile, on its top-right corner (decorative; the screen's caption says it). */
  badge: {
    position: "absolute",
    top: -9,
    right: -9,
    zIndex: 3,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.seal,
    boxShadow: LT_SHADOW.pileSeal,
  },
  badgeRing: {
    position: "absolute",
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: BADGE / 2,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: LT.whiteVeil,
  },
  /** Literata 700 15, lining tabular (the `h` role's face at the seal's size). */
  badgeText: { fontSize: 15, lineHeight: 18, includeFontPadding: false },
});
