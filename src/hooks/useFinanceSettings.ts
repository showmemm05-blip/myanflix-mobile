import { useQuery } from "@tanstack/react-query";
import { financeSettingsService } from "@/services/finance-settings.service";

export function useFinanceSettings() {
  return useQuery({
    queryKey: ["finance-settings"],
    queryFn: ({ signal }) => financeSettingsService.getSettings({ signal }),
  });
}
