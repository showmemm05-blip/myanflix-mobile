import { useCallback } from "react";
import { StackActions, useNavigation } from "@react-navigation/native";

/**
 * Leaves the Thai lottery app for the MyanFlix wallet (the main dock's Wallet
 * tab) — the Leave sheet's "Wallet" row, and Confirm's "Deposit with KBZPay /
 * WavePay" when the wallet is short. `openDeposit` opens the Deposit sheet on
 * arrival, as Subscribe's "Add money" does.
 *
 * The Lottery is a ROOT screen above the tabs, so this pops it off the root
 * stack and hands the tabs the Wallet tab (useExitLottery does the same with
 * the Lottery tab). The tickets already bought are safe; the next visit to
 * the Lottery starts at the hub.
 */
export function useOpenWallet(): (options?: { openDeposit?: boolean }) => void {
  const navigation = useNavigation();
  return useCallback(
    (options = {}) => {
      navigation.dispatch(
        StackActions.popTo("Main", {
          screen: "WalletTab",
          params: { screen: "Wallet", params: options.openDeposit ? { openDeposit: true } : undefined, pop: true },
        }),
      );
    },
    [navigation],
  );
}
