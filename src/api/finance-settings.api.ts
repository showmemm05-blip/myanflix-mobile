import { apiClient } from "@/api/client";

export interface FinanceSettings {
  minDepositAmount: number;
  maxDepositAmount: number;
  minWithdrawalAmount: number;
  maxWithdrawalAmount: number;
}

export const financeSettingsApi = {
  getSettings() {
    return apiClient.get<FinanceSettings>("/finance-settings");
  },
};
