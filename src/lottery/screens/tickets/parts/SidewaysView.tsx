import { memo, useState } from "react";
import { Modal, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { LtButton } from "@/lottery/components/LtButton";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { StatusPill } from "@/lottery/components/Pills";
import { Ticket, type TicketDraw } from "@/lottery/components/ticket/Ticket";
import { TICKET_ASPECT } from "@/lottery/components/ticket/template";
import type { TicketItem } from "@/lottery/data/sample";
import { TICKET_VIEW_COPY } from "@/lottery/screens/tickets/copy";
import { LT } from "@/lottery/theme/tokens";

const C = TICKET_VIEW_COPY.side;

/** The white head and the hint strip (TicketView board `tv-side__head` 64 · `tv-side__hint` 52). */
const HEAD_H = 64;
const HINT_H = 52;
/** Side padding of the cream stage, and the least air above and below the ticket. */
const STAGE_PAD = 16;

/**
 * "Turn sideways" (TicketView board `tv-side` + lt-base `.lt-turn`): the
 * ticket full screen on cream, turned 90° so its long side runs down an
 * upright phone — ROTATE ONLY, never scaled (a transform scale would blur the
 * live layers): the ticket is simply drawn as long as the stage allows, i.e.
 * min(stage height, stage width × 1800/940) — about 680 on a 390 × 844 phone,
 * as on the board. The stage is MEASURED (a large OS text size makes the head
 * and the hint taller), so the ticket never runs under them. A phone already
 * held sideways gets the ticket the right way up at its widest instead.
 * Nothing is cropped either way.
 *
 * A full-screen Modal (its own window, over the dock): the phone's back key
 * and the Close button close it; it fades in (200ms, 120ms under reduced
 * motion — no movement at all).
 */
export const SidewaysView = memo(function SidewaysView({
  visible,
  ticket,
  draw,
  onClose,
}: {
  visible: boolean;
  ticket: TicketItem;
  draw: TicketDraw;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  /** The room inside the stage's padding, once measured. */
  const [room, setRoom] = useState({ w: 0, h: 0 });

  const padLeft = insets.left + STAGE_PAD;
  const padRight = insets.right + STAGE_PAD;
  const onStageLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    const next = { w: Math.max(0, w - padLeft - padRight), h: Math.max(0, h - STAGE_PAD * 2) };
    if (Math.abs(next.w - room.w) > 0.5 || Math.abs(next.h - room.h) > 0.5) setRoom(next);
  };

  const upright = height >= width;
  // The ticket's long side: down the stage when upright, across it when the phone is already sideways.
  const length = Math.floor(
    upright ? Math.min(room.h, room.w * TICKET_ASPECT) : Math.min(room.w, room.h * TICKET_ASPECT),
  );
  const depth = length / TICKET_ASPECT;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={["portrait", "portrait-upside-down", "landscape", "landscape-left", "landscape-right"]}
    >
      <Animated.View
        entering={FadeIn.duration(reduceMotion ? 120 : 200)}
        style={styles.screen}
        accessibilityViewIsModal
      >
        <View
          style={[
            styles.head,
            {
              minHeight: insets.top + HEAD_H,
              paddingTop: insets.top + 8,
              paddingLeft: insets.left + 16,
              paddingRight: insets.right + 12,
            },
          ]}
        >
          <View style={styles.titles}>
            <LtText role="title" accessibilityRole="header">
              {C.title}
            </LtText>
            <LtText role="micro" color={LT.ink3} tabular>
              {C.sub(ticket.drawNo, ticket.id)}
            </LtText>
          </View>
          {ticket.status === "won" ? <StatusPill kind="won" /> : null}
          <LtButton
            variant="secondary"
            size="sm"
            icon="close"
            label={C.close}
            accessibilityLabel={C.closeA11y}
            onPress={onClose}
          />
        </View>

        <View style={[styles.stage, { paddingLeft: padLeft, paddingRight: padRight }]} onLayout={onStageLayout}>
          {length <= 0 ? null : upright ? (
            // A box as tall as the turned ticket is long; the ticket is laid out flat, centred in it, then turned.
            <View style={[styles.turnBox, { height: length }]}>
              <Ticket
                draw={draw}
                number={ticket.number}
                ticketId={ticket.id}
                width={length}
                style={[
                  styles.turned,
                  { left: (room.w - length) / 2, top: (length - depth) / 2 },
                ]}
              />
            </View>
          ) : (
            <View style={styles.flat}>
              <Ticket draw={draw} number={ticket.number} ticketId={ticket.id} width={length} />
            </View>
          )}
        </View>

        <View style={[styles.hint, { minHeight: insets.bottom + HINT_H, paddingBottom: insets.bottom + 8 }]}>
          <LtIcon name="rotate" size={16} color={LT.ink3} />
          <LtText role="meta" color={LT.ink2} style={styles.hintText}>
            {C.hint}
          </LtText>
        </View>
      </Animated.View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: LT.paper },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 8,
    backgroundColor: LT.white,
    borderBottomWidth: 1,
    borderBottomColor: LT.line,
  },
  titles: { flex: 1, minWidth: 0 },
  stage: { flex: 1, justifyContent: "center", backgroundColor: LT.cream },
  /** No clipping: the turned paper fits the box exactly, and its shadow should show. */
  turnBox: { width: "100%" },
  /** Rotation is about the ticket's own centre, so the turned paper stays centred in the box. */
  turned: { position: "absolute", transform: [{ rotate: "90deg" }] },
  flat: { alignItems: "center" },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 8,
    paddingHorizontal: 16,
    backgroundColor: LT.white,
    borderTopWidth: 1,
    borderTopColor: LT.line,
  },
  hintText: { flexShrink: 1, textAlign: "center" },
});
