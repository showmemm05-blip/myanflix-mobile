import { apiClient } from "@/api/client";
import type { AppUser } from "@/types/user";

export const usersApi = {
  getMe() {
    return apiClient.get<AppUser>("/users/me");
  },
};
