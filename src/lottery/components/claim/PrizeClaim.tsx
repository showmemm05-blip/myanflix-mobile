import { useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LtButton } from "@/lottery/components/LtButton";
import { LtHelp } from "@/lottery/components/Surfaces";
import { PrizeClaimBlock } from "@/lottery/components/claim/PrizeClaimBlock";
import { RequestPaymentSheet } from "@/lottery/components/claim/RequestPaymentSheet";
import { CLAIM_COPY } from "@/lottery/components/claim/copy";
import { useDrawClaim } from "@/lottery/hooks/useClaims";
import { DreamLoadingLine } from "@/lottery/screens/dreams/DreamStates";
import { LT } from "@/lottery/theme/tokens";

const C = CLAIM_COPY;

export interface PrizeClaimProps {
  drawNo: number;
  /** Where the block sits (PrizeClaimBlock `place`). */
  place: "summary" | "ticket";
  /** Ticket view: the ticket under the block. */
  ticketNo?: string;
  /** ISO — when the results were published (the "90 days after …" clause). */
  publishedAt?: string | null;
  /** False while the screen does not yet know the customer won in this draw: nothing is asked for. */
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The prize-claim section a screen drops under a prize total: it reads the
 * draw's claim view (GET /lottery/claims/draws/:drawNo), shows a quiet
 * loading line or a one-line error with Try again inside the card while it
 * is not here, then the PrizeClaimBlock — and owns the Request payment sheet
 * the block's button opens. A draw with no prize of mine (status "none")
 * shows nothing at all.
 */
export function PrizeClaim({ drawNo, place, ticketNo, publishedAt, enabled = true, style }: PrizeClaimProps) {
  const query = useDrawClaim(drawNo, enabled);
  const [requestOpen, setRequestOpen] = useState(false);

  if (!enabled) return null;

  if (query.isPending) {
    return <DreamLoadingLine text={C.loading} style={[styles.slot, style]} />;
  }
  if (query.isError) {
    return (
      <View style={[styles.slot, styles.error, style]}>
        <LtHelp kind="err" text={C.errorText} live style={styles.errorText} />
        <LtButton variant="ghost" size="sm" label={C.retry} onPress={() => query.refetch()} />
      </View>
    );
  }
  const claim = query.data;
  if (claim.status === "none") return null;

  return (
    <>
      <PrizeClaimBlock
        claim={claim}
        place={place}
        ticketNo={ticketNo}
        publishedAt={publishedAt}
        onRequest={() => setRequestOpen(true)}
        style={style}
      />
      <RequestPaymentSheet visible={requestOpen} onClose={() => setRequestOpen(false)} claim={claim} />
    </>
  );
}

const styles = StyleSheet.create({
  /** The same gold hairline the block draws, so the card's shape does not jump when the block arrives. */
  slot: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: LT.goldLine },
  error: { flexDirection: "row", alignItems: "center", gap: 8 },
  errorText: { flex: 1 },
});
