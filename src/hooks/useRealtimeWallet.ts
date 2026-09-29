import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { connectSocket, disconnectSocket } from "@/services/socket";
import { tokenStore } from "@/services/token-store";
import { useAuthStore } from "@/store/authStore";
import type { Wallet } from "@/types/wallet";
import type { DepositStatus } from "@/types/deposit";
import type { WithdrawalStatus } from "@/types/withdrawal";

interface DepositUpdatedPayload {
  id: string;
  status: DepositStatus;
  amount: number;
  paymentMethod: string;
  reference: string;
  rejectionReason?: string | null;
}

interface WithdrawalUpdatedPayload {
  id: string;
  status: WithdrawalStatus;
  amount: number;
  accountType: string;
  accountName: string;
  accountNumber: string;
  rejectionReason?: string | null;
}

interface WalletBalanceUpdatedPayload {
  balance: number;
}

/**
 * Mounted once at the root while authenticated (mirrors the web app's
 * RealtimeWalletListener) — connects the shared Socket.IO client and keeps
 * deposit status / wallet balance live-updated instead of only refreshing
 * whenever the Wallet screen happens to remount.
 */
export function useRealtimeWallet() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      return;
    }

    let activeSocket: Socket | null = null;
    let cancelled = false;

    const handleBalanceUpdated = ({ balance }: WalletBalanceUpdatedPayload) => {
      queryClient.setQueryData<Wallet | undefined>(["wallet"], (prev) => (prev ? { ...prev, balance } : prev));
    };

    const handleDepositUpdated = (_payload: DepositUpdatedPayload) => {
      queryClient.invalidateQueries({ queryKey: ["deposits"] });
      queryClient.invalidateQueries({ queryKey: ["wallet", "transactions"] });
    };

    const handleWithdrawalUpdated = (_payload: WithdrawalUpdatedPayload) => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["wallet", "transactions"] });
    };

    // An admin activated, deactivated, edited or removed one of our business
    // accounts: the deposit picker must show the new list at once. The
    // event carries nothing — the list is refetched.
    const handlePaymentAccountsChanged = () => {
      queryClient.invalidateQueries({ queryKey: ["payment-accounts"] });
    };

    (async () => {
      // SecureStore REJECTS (it does not return null) when a value cannot be
      // decrypted, and this IIFE is floating — nothing downstream would catch
      // it, so it would surface as an unhandled rejection at app root. Live
      // updates are a nicety: degrade to "no socket", which is the same
      // outcome as an unauthenticated session.
      let token: string | null = null;
      try {
        token = await tokenStore.getAccessToken();
      } catch {
        return;
      }
      if (!token || cancelled) return;
      activeSocket = connectSocket(token);
      activeSocket.on("wallet.balanceUpdated", handleBalanceUpdated);
      activeSocket.on("deposit.updated", handleDepositUpdated);
      activeSocket.on("withdrawal.updated", handleWithdrawalUpdated);
      activeSocket.on("payment-accounts.changed", handlePaymentAccountsChanged);
    })();

    return () => {
      cancelled = true;
      activeSocket?.off("wallet.balanceUpdated", handleBalanceUpdated);
      activeSocket?.off("deposit.updated", handleDepositUpdated);
      activeSocket?.off("withdrawal.updated", handleWithdrawalUpdated);
      activeSocket?.off("payment-accounts.changed", handlePaymentAccountsChanged);
    };
  }, [isAuthenticated, queryClient]);
}
