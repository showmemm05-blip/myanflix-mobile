import { useEffect, useRef } from "react";
import { AccessibilityInfo, StyleSheet, View, type ViewInstance } from "react-native";
import { useWallet } from "@/hooks/useWallet";
import { LotteryFooter } from "@/lottery/components/LotteryFooter";
import { LotteryScreen } from "@/lottery/components/LotteryScreen";
import { LtButton } from "@/lottery/components/LtButton";
import { LtEmpty } from "@/lottery/components/LtEmpty";
import { dateLong, ks } from "@/lottery/data/format";
import { useDraw } from "@/lottery/hooks/useDraws";
import { isPurchaseNotFound, usePurchase } from "@/lottery/hooks/usePurchases";
import type { LotteryDrawScreenProps } from "@/lottery/navigation/types";
import { DRAW_COPY } from "@/lottery/screens/draw/copy";
import { requestNumberFocus } from "@/lottery/screens/draw/numberFocus";
import { PurchaseVoucher, type VoucherRow } from "@/lottery/screens/draw/PurchaseVoucher";
import { DreamErrorBanner, DreamLoadingLine } from "@/lottery/screens/dreams/DreamStates";

const P = DRAW_COPY.printed;

/** After the push has settled, a screen reader is moved to the title (the board focuses it after the purchase). */
const FOCUS_DELAY_MS = 600;

/**
 * TICKETS BOUGHT (Printed.dc.html) — pushed in the Draw tab after a purchase
 * (from Draw, or from DreamTickets with Draw underneath), so the dock still
 * shows Draw. `purchaseId` is the purchase's ref: the one just made is in the
 * cache (useBuyTickets puts it there, with the balance right after it), so
 * the page opens at once; any other ref is fetched (GET /lottery/purchases/:ref).
 *
 * Top to bottom: the purchase voucher — one card, the slip ("2 tickets
 * bought", 581206 × 2, the draw) torn from its stub (voucher number, time,
 * tickets, amount paid, paid from the MyanFlix wallet, the balance right
 * after this purchase, when the result comes) — then See my tickets / Buy
 * another number. There is no "Your new tickets" print tray (owner, 27 Oct
 * 2026): the tickets are on My tickets.
 *
 * A purchase that cannot be found (not this customer's) shows a plain state
 * that leads back to the number; one that did not load, Try again.
 */
export function LotteryPrintedScreen({ navigation, route }: LotteryDrawScreenProps<"LotteryPrinted">) {
  const { purchaseId } = route.params;
  const query = usePurchase(purchaseId);
  const purchase = query.purchase;
  const drawQuery = useDraw(purchase?.drawNo);
  const draw = drawQuery.info;
  const wallet = useWallet();
  const titleRef = useRef<ViewInstance>(null);

  // The balance right after THIS purchase (the POST answer); a purchase opened later shows the wallet now.
  const balanceAfter = purchase?.balanceAfter ?? wallet.data?.balance;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      AccessibilityInfo.isScreenReaderEnabled().then((on) => {
        if (on && !cancelled && titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
      });
    }, FOCUS_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const seeTickets = () => navigation.navigate("LotteryTicketsTab", { screen: "LotteryTickets", pop: true });
  const buyAnother = () => {
    requestNumberFocus();
    navigation.popTo("LotteryDraw");
  };
  const footer = <LotteryFooter />;

  if (!purchase || !draw) {
    let state;
    if (query.isError && isPurchaseNotFound(query.error)) {
      state = (
        <LtEmpty
          title={P.missingTitle}
          text={P.missingText}
          action={<LtButton variant="primary" label={P.missingAction} onPress={() => navigation.popTo("LotteryDraw")} />}
        />
      );
    } else if (query.isError || drawQuery.isError) {
      state = (
        <DreamErrorBanner
          title={P.errorTitle}
          text={P.errorText}
          retryLabel={P.retry}
          onRetry={() => (query.isError ? query.refetch() : drawQuery.refetch())}
        />
      );
    } else {
      state = <DreamLoadingLine text={P.loading} />;
    }
    return (
      <LotteryScreen topBar={{ variant: "root" }} footer={footer}>
        <View>{state}</View>
      </LotteryScreen>
    );
  }

  const count = purchase.ticketIds.length;
  // The slip above the tear shows the numbers, so the stub does not repeat them.
  const rows: VoucherRow[] = [
    { term: P.rows.bought, value: purchase.at },
    { term: P.rows.tickets, value: P.each(count, ks(purchase.unitPrice)) },
  ];

  return (
    <LotteryScreen topBar={{ variant: "root" }} footer={footer}>
      <PurchaseVoucher
        draw={draw}
        count={count}
        lines={purchase.lines}
        titleRef={titleRef}
        voucherNo={purchase.ref}
        rows={rows}
        total={{ term: P.rows.paid, value: ks(purchase.total) }}
        box={[
          { term: P.rows.from, value: P.rows.wallet },
          { term: P.rows.balanceNow, value: balanceAfter === undefined ? "—" : ks(balanceAfter) },
        ]}
        note={P.published(draw.drawTime, dateLong(draw.dateIso))}
      />

      <View style={styles.actions}>
        <LtButton variant="primary" size="block" icon="tickets" label={P.seeTickets} onPress={seeTickets} />
        <LtButton variant="secondary" size="block" label={P.buyAnother} onPress={buyAnother} />
      </View>
    </LotteryScreen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 12 },
});
