import { financeSettingsApi } from "@/api/finance-settings.api";
import type { RequestSignalOptions } from "@/types/api";

export const financeSettingsService = {
  getSettings(options: RequestSignalOptions = {}) {
    return financeSettingsApi.getSettings(options);
  },
};
