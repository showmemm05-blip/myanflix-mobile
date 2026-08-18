import type { AccessType } from "@/types/movie";

export function hasAccess(accessType: AccessType, isSubscribed: boolean): boolean {
  return accessType === "FREE" || isSubscribed;
}
