import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { withdrawalCodeService } from "@/services/withdrawal-code.service";
import { ApiError } from "@/utils/errors";
import { WITHDRAWAL_CODE_ERROR, type WithdrawalCodeStatus } from "@/types/withdrawal-code";

/**
 * The account's withdrawal-code status. Only the status is ever cached, never
 * a code: React Query keeps a mutation's VARIABLES (the typed codes) on the
 * mutation object in its MutationCache, for `gcTime` after nothing observes
 * it any more — 5 minutes by default. Every mutation that carries a code
 * therefore sets `gcTime: 0` (FORGET_AT_ONCE), so a finished one is dropped
 * the moment its screen moves on instead of lingering in memory.
 *
 * logout() clears the whole query cache, so one account's status can never
 * show for the next.
 */
export const WITHDRAWAL_CODE_STATUS_KEY = ["withdrawalCode", "status"] as const;

/** Mutation option for anything whose variables hold a code. */
export const FORGET_AT_ONCE = { gcTime: 0 } as const;

const fetchStatus = (signal?: AbortSignal) => withdrawalCodeService.getStatus({ signal });

/** The Profile row's "Create code" / "Change code". */
export function useWithdrawalCodeStatus(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: WITHDRAWAL_CODE_STATUS_KEY,
    queryFn: ({ signal }) => fetchStatus(signal),
    enabled: options.enabled ?? true,
  });
}

/**
 * A fresh status read for a decision that must not trust a cached one — the
 * withdraw Submit (create a code or enter it?) and opening the Profile sheet.
 * No retry: the answer gates a tap, and three silent attempts would leave the
 * button busy for seconds before saying anything.
 */
export function useFetchWithdrawalCodeStatus() {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      queryClient.fetchQuery({
        queryKey: WITHDRAWAL_CODE_STATUS_KEY,
        queryFn: ({ signal }) => fetchStatus(signal),
        staleTime: 0,
        retry: false,
      }),
    [queryClient],
  );
}

const storeStatus = (queryClient: QueryClient) => (status: WithdrawalCodeStatus) =>
  queryClient.setQueryData(WITHDRAWAL_CODE_STATUS_KEY, status);

/**
 * A refused code changes what the server holds (the wrong-try count, the
 * lock, or — on NOT_SET / ALREADY_SET — whether there is a code at all), so
 * the cached status is re-read after any coded refusal.
 *
 * What a WRONG or LOCKED answer already says (tries left, when the lock
 * opens) is written into the cached status first. invalidateQueries only
 * re-reads a status something is watching, and the withdraw flow watches
 * none — it reads the cache when coming back from "Forgot code?", which must
 * show the lock this answer just reported, not the unlocked status read at
 * Submit.
 */
export function refreshStatusAfterCodedError(queryClient: QueryClient, err: unknown) {
  if (!(err instanceof ApiError) || !err.code?.startsWith("WITHDRAWAL_CODE_")) return;
  const { code, lockedUntil, triesLeft } = err;
  if (code === WITHDRAWAL_CODE_ERROR.LOCKED && typeof lockedUntil === "string") {
    queryClient.setQueryData<WithdrawalCodeStatus>(WITHDRAWAL_CODE_STATUS_KEY, (prev) =>
      prev ? { ...prev, hasCode: true, lockedUntil, triesLeft: 0 } : prev,
    );
  } else if (code === WITHDRAWAL_CODE_ERROR.WRONG && typeof triesLeft === "number") {
    queryClient.setQueryData<WithdrawalCodeStatus>(WITHDRAWAL_CODE_STATUS_KEY, (prev) =>
      prev ? { ...prev, hasCode: true, lockedUntil: null, triesLeft } : prev,
    );
  }
  void queryClient.invalidateQueries({ queryKey: WITHDRAWAL_CODE_STATUS_KEY });
}

export function useCreateWithdrawalCode() {
  const queryClient = useQueryClient();
  return useMutation({
    ...FORGET_AT_ONCE,
    mutationFn: ({ code, confirm }: { code: string; confirm: string }) => withdrawalCodeService.create(code, confirm),
    onSuccess: storeStatus(queryClient),
    onError: (err) => refreshStatusAfterCodedError(queryClient, err),
  });
}

/** Change step 1 — counts toward the same 5-try lock as a withdrawal. */
export function useVerifyWithdrawalCode() {
  const queryClient = useQueryClient();
  return useMutation({
    ...FORGET_AT_ONCE,
    mutationFn: (code: string) => withdrawalCodeService.verify(code),
    onSuccess: storeStatus(queryClient),
    onError: (err) => refreshStatusAfterCodedError(queryClient, err),
  });
}

export function useChangeWithdrawalCode() {
  const queryClient = useQueryClient();
  return useMutation({
    ...FORGET_AT_ONCE,
    mutationFn: ({ currentCode, newCode, confirm }: { currentCode: string; newCode: string; confirm: string }) =>
      withdrawalCodeService.change(currentCode, newCode, confirm),
    onSuccess: storeStatus(queryClient),
    onError: (err) => refreshStatusAfterCodedError(queryClient, err),
  });
}

export function useRequestWithdrawalCodeReset() {
  return useMutation({
    mutationFn: () => withdrawalCodeService.requestReset(),
  });
}

export function useVerifyWithdrawalCodeReset() {
  return useMutation({
    ...FORGET_AT_ONCE,
    mutationFn: (otpCode: string) => withdrawalCodeService.verifyReset(otpCode),
  });
}

/** Sets the new code; the server also clears the lock and the wrong-try count. */
export function useConfirmWithdrawalCodeReset() {
  const queryClient = useQueryClient();
  return useMutation({
    ...FORGET_AT_ONCE,
    mutationFn: ({ resetToken, newCode, confirm }: { resetToken: string; newCode: string; confirm: string }) =>
      withdrawalCodeService.confirmReset(resetToken, newCode, confirm),
    onSuccess: storeStatus(queryClient),
    onError: (err) => refreshStatusAfterCodedError(queryClient, err),
  });
}
