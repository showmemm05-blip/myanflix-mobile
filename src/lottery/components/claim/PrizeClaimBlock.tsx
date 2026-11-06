import { memo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useWallet } from "@/hooks/useWallet";
import { LtButton } from "@/lottery/components/LtButton";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { StatusPill } from "@/lottery/components/Pills";
import { useLtToast } from "@/lottery/components/LtToast";
import { CLAIM_COPY, claimWords } from "@/lottery/components/claim/copy";
import { LT_COPY } from "@/lottery/copy";
import { ks } from "@/lottery/data/format";
import { useOpenWallet } from "@/lottery/navigation/useOpenWallet";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";
import { ltStop } from "@/lottery/i18n";
import type { LotteryDrawClaim } from "@/types/lottery";

const C = CLAIM_COPY;

export interface PrizeClaimBlockProps {
  /** The draw's claim view (status other than "none": the screen hides the block for a draw with no prize). */
  claim: LotteryDrawClaim;
  /**
   * "summary": under Check my tickets' "You won" total (the board's `p`
   * sentence, the three steps under the button). "ticket": under one
   * ticket's prize on Ticket view (the `p2` sentence about this ticket).
   */
  place: "summary" | "ticket";
  /** Ticket view: the ticket under the block, so the words say whether the claim covers more than it. */
  ticketNo?: string;
  /** ISO — when the results were published (the "90 days after …" clause); without it the clause is left out. */
  publishedAt?: string | null;
  /** Opens the Request payment sheet (the block's one action while the prize is not requested). */
  onRequest: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * THE PRIZE-CLAIM BLOCK (PrizeClaim board `.pc-claim`, owner 24 Oct 2026):
 * under a prize total, over a gold hairline. One status row = the chip (icon
 * + word, never colour alone) on the left and the time or the deadline on
 * the right; then ONE headline, one or two plain sentences, the admin's
 * reason in a quoted box when rejected, and ONE action — Request payment ·
 * Open wallet · Contact support — or none (Requested, Expired). The same
 * block sits under Check my tickets' "You won" summary and under Ticket
 * view's prize card.
 *
 * States, from the ticket's `claimStatus` / the draw's claim view: not
 * requested → the Won pill, "Request by <day>", the seal-red button and the
 * three steps; requested → "Requested", "Sent <d Mon, h:mm AM>", the
 * two-step track (Request sent · Admin confirms), no action; paid → "Paid",
 * the time, "Open wallet"; rejected → "Rejected", the reason box, "Contact
 * support"; expired → "Expired", "Deadline <day>", no action.
 *
 * "Contact support": the Lottery has no support page yet, so it says
 * LT_COPY.previewOnly.
 */
export const PrizeClaimBlock = memo(function PrizeClaimBlock({
  claim,
  place,
  ticketNo,
  publishedAt,
  onRequest,
  style,
}: PrizeClaimBlockProps) {
  const openWallet = useOpenWallet();
  const toast = useLtToast();
  const balance = useWallet().data?.balance ?? null;
  const w = claimWords({ claim, publishedAt, ticketNo, balance });
  const summary = place === "summary";
  const total = ks(claim.prizeKs);

  return (
    <View style={[styles.block, style]}>
      <View style={styles.row}>
        <StatusPill kind={w.pill} />
        {w.when ? (
          <LtText role="micro" color={LT.ink3} tabular numberOfLines={1} style={styles.when}>
            {w.when}
          </LtText>
        ) : null}
      </View>

      <LtText role="title" accessibilityRole="header" style={styles.h}>
        {w.h}
      </LtText>
      <LtText role="meta" color={LT.ink2} style={styles.p}>
        {summary ? w.p : w.p2}
      </LtText>

      {w.reason ? (
        <View style={styles.reason} accessible accessibilityLabel={`${w.reason.title}${ltStop()} ${w.reason.text}`}>
          <LtText role="buttonSm" color={LT.err}>
            {w.reason.title}
          </LtText>
          {w.reason.text ? (
            <LtText role="meta" color={LT.ink2}>
              {w.reason.text}
            </LtText>
          ) : null}
        </View>
      ) : null}

      {claim.status === "requested" ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.track}>
            <View style={[styles.trackBar, styles.trackDone]} />
            <View style={styles.trackBar} />
          </View>
          <View style={styles.trackLabels}>
            <LtText role="micro" color={LT.indigo}>
              {C.track.sent}
            </LtText>
            <LtText role="micro" color={LT.ink3}>
              {C.track.confirms}
            </LtText>
          </View>
        </View>
      ) : null}

      {claim.status === "not_requested" ? (
        <>
          <LtButton
            variant="primary"
            size="block"
            icon="send"
            label={C.action.request(total)}
            accessibilityLabel={C.action.requestA11y(total, claim.drawNo)}
            accessibilityHint={C.action.requestHint}
            onPress={onRequest}
            style={styles.action}
          />
          {summary ? (
            <View style={styles.steps} accessible accessibilityLabel={C.steps.a11y}>
              <LtText role="micro" color={LT.ink3}>
                {C.steps.request}
              </LtText>
              <LtIcon name="arrow" size={14} color={LT.lineStrong} />
              <LtText role="micro" color={LT.ink3}>
                {C.steps.confirm}
              </LtText>
              <LtIcon name="arrow" size={14} color={LT.lineStrong} />
              <LtText role="micro" color={LT.ink3}>
                {C.steps.paid}
              </LtText>
            </View>
          ) : null}
        </>
      ) : null}

      {claim.status === "paid" ? (
        <LtButton
          variant="secondary"
          size="block"
          icon="wallet"
          label={C.action.openWallet}
          accessibilityLabel={C.action.openWalletA11y}
          onPress={() => openWallet()}
          style={styles.action}
        />
      ) : null}

      {claim.status === "rejected" ? (
        <LtButton
          variant="secondary"
          size="block"
          icon="chat"
          label={C.action.support}
          onPress={() => toast.show(LT_COPY.previewOnly, { kind: "warn" })}
          style={styles.action}
        />
      ) : null}

      {w.foot ? (
        <LtText role="micro" color={LT.ink3} style={styles.foot}>
          {w.foot}
        </LtText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  /** `.pc-claim`: 14 above, a gold hairline, 14 under it. */
  block: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: LT.goldLine },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 26 },
  when: { flexShrink: 1, textAlign: "right" },
  /** `.pc-claim__h`: Literata 600 18/24. */
  h: { marginTop: 10, fontSize: 18, lineHeight: 24 },
  p: { marginTop: 4 },
  /** `.pc-reason`: a white box, a 3pt seal-red left edge, the preset reason in bold over the note. */
  reason: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.errLine,
    borderLeftWidth: 3,
    borderLeftColor: LT.err,
    borderRadius: LT_RADIUS.input,
    gap: 2,
  },
  /** `.pc-track`: two 4pt bars, 1 of 2 done. */
  track: { flexDirection: "row", gap: 4, marginTop: 12 },
  trackBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: LT.indigoPress },
  trackDone: { backgroundColor: LT.indigo },
  trackLabels: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 4 },
  action: { marginTop: 12 },
  /** `.pc-steps`: the three steps with arrows between, wrapping on a narrow phone. */
  steps: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 6, rowGap: 4, marginTop: 10 },
  foot: { marginTop: 10 },
});
