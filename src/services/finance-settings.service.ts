import { financeSettingsApi } from "@/api/finance-settings.api";

export const financeSettingsService = {
  getSettings() {
    return financeSettingsApi.getSettings();
  },
};
