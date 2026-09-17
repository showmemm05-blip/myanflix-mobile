import { apiClient } from "@/api/client";
import type { RequestSignalOptions } from "@/types/api";

export interface FinanceSettings {
  minDepositAmount: number;
  maxDepositAmount: number;
  minWithdrawalAmount: number;
  maxWithdrawalAmount: number;
}

export const financeSettingsApi = {
  getSettings(options: RequestSignalOptions = {}) {
    return apiClient.get<FinanceSettings>("/finance-settings", options);
  },
};
