import { apiClient } from "@/api/client";
import type { RequestSignalOptions } from "@/types/api";
import type {
  WithdrawalCodeResetRequested,
  WithdrawalCodeResetVerified,
  WithdrawalCodeStatus,
} from "@/types/withdrawal-code";

const BASE = "/users/me/withdrawal-code";

/**
 * The signed-in account's own withdrawal code. Every route answers a wrong or
 * refused code with a coded 400/409/423 (never 401, which would end the
 * session) — see utils/errors.ts ApiError.code. The codes travel in the body
 * only; nothing here logs or keeps them.
 */
export const withdrawalCodeApi = {
  getStatus(options: RequestSignalOptions = {}) {
    return apiClient.get<WithdrawalCodeStatus>(BASE, options);
  },

  /** The first code. `confirm` is the "Enter it again" entry; the server checks they match. */
  create(code: string, confirm: string) {
    return apiClient.post<WithdrawalCodeStatus>(BASE, { code, confirm });
  },

  /** "Is this my current code?" — Change step 1. Counts toward the 5-try lock. */
  verify(code: string) {
    return apiClient.post<WithdrawalCodeStatus>(`${BASE}/verify`, { code });
  },

  change(currentCode: string, newCode: string, confirm: string) {
    return apiClient.put<WithdrawalCodeStatus>(BASE, { currentCode, newCode, confirm });
  },

  /** "Forgot code?": texts "MyanFlix: 482 913" to the account phone. */
  requestReset() {
    return apiClient.post<WithdrawalCodeResetRequested>(`${BASE}/reset/request`, {});
  },

  /** Spends the SMS code and returns the token reset/confirm needs. */
  verifyReset(otpCode: string) {
    return apiClient.post<WithdrawalCodeResetVerified>(`${BASE}/reset/verify`, { otpCode });
  },

  confirmReset(resetToken: string, newCode: string, confirm: string) {
    return apiClient.post<WithdrawalCodeStatus>(`${BASE}/reset/confirm`, { resetToken, newCode, confirm });
  },
};
