import { useCallback } from "react";
import { StackActions, useNavigation } from "@react-navigation/native";

/**
 * Leaves the Thai lottery app for the dark Lottery hub (the main dock's
 * Lottery tab): the "Lottery games" row of the "Leave the lottery?" sheet,
 * which the top bar's emblem chip opens (owner, 23 Oct 2026: the old bare
 * "‹ Lottery" link was tapped by accident, so leaving is a choice now).
 *
 * `popTo("Main", …)` (Subscribe.tsx uses the same action): the Lottery is a
 * ROOT screen above the tabs, so this pops it off the root stack and hands the
 * tabs the Lottery tab, whatever tab was showing underneath (the hub opens it,
 * but a later deep link might not). Dispatched from any screen inside the Lottery, the
 * action bubbles up to the root stack, the only navigator that knows "Main".
 * The phone's back key needs none of this: the Lottery's tab history first,
 * then out to whatever is underneath.
 */
export function useExitLottery(): () => void {
  const navigation = useNavigation();
  return useCallback(() => {
    navigation.dispatch(StackActions.popTo("Main", { screen: "LotteryTab" }));
  }, [navigation]);
}

/**
 * Leaves the Thai lottery app for MyanFlix itself — the main dock's Home tab
 * (movies, series and books): the Leave sheet's "Back to MyanFlix". The same
 * `popTo("Main", …)` as above, handed the Home tab; the inner `pop: true`
 * pops any title page still open on Home's stack, as useOpenWallet does for
 * the Wallet.
 */
export function useExitToMyanFlix(): () => void {
  const navigation = useNavigation();
  return useCallback(() => {
    navigation.dispatch(StackActions.popTo("Main", { screen: "HomeTab", params: { screen: "Home", pop: true } }));
  }, [navigation]);
}
