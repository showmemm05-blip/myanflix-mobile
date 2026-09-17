import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subscriptionsService } from "@/services/subscriptions.service";
import { profileService } from "@/services/profile.service";
import { useAuthStore } from "@/store/authStore";

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ["subscription", "plans"],
    queryFn: ({ signal }) => subscriptionsService.getPlans({ signal }),
  });
}

export function useSubscriptionStatus() {
  return useQuery({
    queryKey: ["subscription", "me"],
    queryFn: ({ signal }) => subscriptionsService.getStatus({ signal }),
    // The most-mounted account query in the app — MovieDetails, SeriesDetails
    // and ProfileOverview all ask, and the first two are pushed over and over
    // while browsing. Only `useSubscribe` below can change the answer, and it
    // invalidates ["subscription"] on success (the only invalidation of that
    // prefix anywhere), so a cached copy can never go quietly wrong.
    staleTime: 5 * 60_000,
  });
}

export function useSubscribe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => subscriptionsService.subscribe(planId),
    /**
     * Only these three things moved.
     *
     * The catalogue did NOT: no Movie, Series or SeriesListItem carries a
     * per-user field, and the lock is `hasAccess(accessType, isSubscribed)`
     * computed on the device — so invalidating ["movie"] and ["series"] here
     * re-downloaded byte-identical JSON (a 100-row series page among it) in a
     * burst, at the exact moment the user is waiting for the Subscribe screen.
     *
     * The stored user DID: this purchase moved both `balance` and `totalSpent`
     * (the server aggregates PURCHASE + SUBSCRIPTION transactions into it), and
     * the auth store has no other way to learn that — it is filled once at boot
     * — so the profile's "Total spent" stayed a cold-start snapshot for the
     * rest of the session while the balance beside it visibly dropped. A failed
     * refresh must not fail a subscription that already succeeded.
     */
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      profileService.getProfile().then(useAuthStore.getState().setUser).catch(() => {});
    },
  });
}
