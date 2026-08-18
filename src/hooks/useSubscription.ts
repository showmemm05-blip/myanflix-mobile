import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subscriptionsService } from "@/services/subscriptions.service";

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ["subscription", "plans"],
    queryFn: () => subscriptionsService.getPlans(),
  });
}

export function useSubscriptionStatus() {
  return useQuery({
    queryKey: ["subscription", "me"],
    queryFn: () => subscriptionsService.getStatus(),
  });
}

export function useSubscribe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => subscriptionsService.subscribe(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["movie"] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
    },
  });
}
