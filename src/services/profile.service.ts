import { usersApi } from "@/api/users.api";
import type { AppUser } from "@/types/user";

export const profileService = {
  getProfile(): Promise<AppUser> {
    return usersApi.getMe();
  },
};
