export type UserRole = "SUPER_ADMIN" | "ADMIN" | "USER";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED";

/** "mm" everywhere — the web app inconsistently used "my" in one type and "mm" in its actual i18n system; don't repeat that. */
export type AppLanguage = "en" | "mm";

/** Shape returned by GET /users/me. */
export interface AppUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  balance: number;
  totalDeposited: number;
  totalSpent: number;
  moviesPurchased: number;
}

/** Shape returned inline by /auth/register and /auth/login (a smaller subset of AppUser). */
export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}
