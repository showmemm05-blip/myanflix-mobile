import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { LtButton } from "@/lottery/components/LtButton";
import { LtSheet } from "@/lottery/components/LtSheet";
import { LtText } from "@/lottery/components/LtText";
import { useLtToast } from "@/lottery/components/LtToast";
import { LtHelp, LtNote } from "@/lottery/components/Surfaces";
import { CLAIM_COPY } from "@/lottery/components/claim/copy";
import { dateShort, ks } from "@/lottery/data/format";
import { groupName } from "@/lottery/data/prizes";
import { claimRefusalOf, useRequestClaim } from "@/lottery/hooks/useClaims";
import { ltLanguage } from "@/lottery/i18n";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";
import type { LotteryDrawClaim } from "@/types/lottery";

const C = CLAIM_COPY.sheet;

export interface RequestPaymentSheetProps {
  visible: boolean;
  /** Closed without sending (X, scrim, drag, back key, Not now), or by the sheet itself once the request went through. */
  onClose: () => void;
  /** The draw's claim view — its amount and winning tickets are what the request covers. */
  claim: LotteryDrawClaim;
}

/**
 * THE REQUEST PAYMENT SHEET (PrizeClaim board `.pc-sheet`, lt-base 6.13):
 * the amount in display size, what it is for ("Your prize for 3 winning
 * tickets in Draw 2 · Sat 17 Oct 2026. One request covers all of them."),
 * one row per winning ticket (number · ticket ID · prize group · Ks), the
 * total, the 24-hour note, then "Not now" | "Request payment".
 *
 * Sending posts ONE claim for the draw (hooks/useClaims useRequestClaim).
 * While it sends the sheet is locked (no scrim, drag, X, back key or Not now
 * — refused in LtSheet itself, so a live scrim is never stranded) and the
 * button says "Sending…". On success the sheet closes and the page's toast
 * says "Request sent …"; the block under it turns to Requested from the
 * answer. A refusal (already requested, rejected, expired, nothing to claim)
 * shows one plain line above the buttons and the request cannot be sent
 * again from here — the block behind re-reads the server's truth. A lost
 * answer, or a publish whose last chunks are still settling (409
 * LOTTERY_DRAW_STATE on a published draw), shows "Try again" and keeps the
 * button: the same request may simply be sent again.
 */
export function RequestPaymentSheet({ visible, onClose, claim }: RequestPaymentSheetProps) {
  const request = useRequestClaim(claim.drawNo);
  const toast = useLtToast();
  /** The plain line above the buttons (a refusal, or a lost answer). */
  const [line, setLine] = useState<string | null>(null);
  /** The server refused for good: sending again is pointless, the button goes quiet. */
  const [settled, setSettled] = useState(false);
  /** The answer was lost, or the refusal is a passing one: the same request may simply be tried again. */
  const [retryable, setRetryable] = useState(false);

  // Every opening starts fresh (React's pattern for state that follows a prop).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setLine(null);
      setSettled(false);
      setRetryable(false);
    }
  }

  const busy = request.isPending;
  const total = ks(claim.prizeKs);

  const send = () => {
    if (busy || settled) return;
    setLine(null);
    request.mutate(undefined, {
      onSuccess: () => {
        onClose();
        toast.show(CLAIM_COPY.toast.sent);
      },
      onError: (err) => {
        const why = claimRefusalOf(err);
        if (!why) {
          setRetryable(true);
          setLine(C.lost);
          return;
        }
        setLine(C.refused(why));
        // A publish still settling is over in a moment; everything else the server refused stays refused.
        const passing = why.kind === "notPublished" || why.kind === "other";
        setRetryable(why.kind === "notPublished");
        if (!passing) setSettled(true);
      },
    });
  };

  return (
    <LtSheet
      visible={visible}
      onClose={onClose}
      title={C.title}
      dismissible={!busy}
      closeLabel={C.closeA11y}
      footer={
        <>
          <LtButton variant="ghost" label={C.notNow} onPress={onClose} disabled={busy} style={styles.notNow} />
          <LtButton
            variant="primary"
            icon="send"
            label={retryable ? C.tryAgain : C.send}
            busy={busy}
            busyLabel={C.sending}
            disabled={settled}
            accessibilityHint={settled && line ? line : undefined}
            onPress={send}
            style={styles.send}
          />
        </>
      }
    >
      <View style={styles.amountRow}>
        <LtText role="display" numberOfLines={1} adjustsFontSizeToFit style={styles.amount}>
          {total}
        </LtText>
      </View>
      <LtText role="meta" color={LT.ink2} style={styles.forLine}>
        {C.forLine(claim.wonTickets, claim.drawNo, dateShort(claim.thaiDrawDate))}
      </LtText>

      {claim.tickets.length ? (
        <View style={styles.list} accessibilityLabel={C.listA11y}>
          {claim.tickets.map((t, i) => {
            // The wire's names are English ("First prize"): Burmese shows the boards' own names (data/prizes.ts) instead.
            const groups = t.wonGroups.map((g) => (ltLanguage() === "en" ? g.name : groupName(g.key, g.name))).join(" + ");
            return (
              <View
                key={t.ticketNo}
                style={[styles.row, i > 0 && styles.divided]}
                accessible
                accessibilityLabel={C.rowA11y(t.number, t.ticketNo, groups, ks(t.ks))}
              >
                <View style={styles.rowMain}>
                  <LtText role="num" style={styles.rowNum} numberOfLines={1}>
                    {t.number}
                  </LtText>
                  <LtText role="caption" numberOfLines={1}>
                    {groups ? `${t.ticketNo} · ${groups}` : t.ticketNo}
                  </LtText>
                </View>
                <LtText role="title" tabular style={styles.rowKs} numberOfLines={1}>
                  {ks(t.ks)}
                </LtText>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.total} accessible accessibilityLabel={`${C.total} ${total}`}>
        <LtText role="metaB" color={LT.ink2}>
          {C.total}
        </LtText>
        <LtText role="h" style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit>
          {total}
        </LtText>
      </View>

      <LtNote kind="info" style={styles.note}>
        <LtText role="meta" color={LT.ink2}>
          <LtText role="metaB" color={LT.ink}>
            {C.noteLead}
          </LtText>
          {C.noteRest}
        </LtText>
      </LtNote>

      {line ? <LtHelp kind="err" text={line} live style={styles.line} /> : null}
    </LtSheet>
  );
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  amount: { flexShrink: 1 },
  forLine: { marginTop: 4 },
  /** `.lt-list` + `.pc-sheet__row`: a white list card, one 56pt row per ticket. */
  list: {
    marginTop: 14,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    overflow: "hidden",
    boxShadow: LT_SHADOW.s1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  divided: { borderTopWidth: 1, borderTopColor: LT.line },
  rowMain: { flex: 1, minWidth: 0 },
  /** Literata 600 18/24, +.06em (`.pc-sheet__num`). */
  rowNum: { fontSize: 18, lineHeight: 24 },
  /** Literata 600 16/20 (`.pc-sheet__ks`). */
  rowKs: { fontSize: 16, lineHeight: 20, flexShrink: 0 },
  total: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LT.line,
  },
  totalValue: { flexShrink: 1, textAlign: "right" },
  note: { marginTop: 14 },
  line: { marginTop: 12 },
  notNow: { flex: 1 },
  send: { flex: 2 },
});
