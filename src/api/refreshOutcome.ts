/**
 * What one POST /auth/refresh attempt says about the session — kept free of
 * axios, SecureStore and React Native so the rule can be checked on its own.
 *
 * The distinction that matters (audit H-20): only the SERVER refusing the
 * refresh token ends the session. Before this, every failure — a timeout on a
 * weak signal, no network, a DNS error, a 502 while the backend was being
 * redeployed — was read as "session dead", the tokens were deleted and the
 * user was thrown back to the sign-in screen, which costs a password AND an
 * SMS code to get past. Now:
 *
 * - "refreshed"   — a new token pair; the caller stores it and retries.
 * - "rejected"    — the server answered 400/401/403 (or an explicit
 *                   `success:false` envelope): the refresh token is really
 *                   dead. Sign out.
 * - "unreachable" — anything else: no response at all, a 5xx, a 429, or a body
 *                   that is not our envelope (a captive portal's HTML page).
 *                   Keep the tokens; the request fails as "offline" and React
 *                   Query retries it later.
 */
export type RefreshOutcome =
  | { kind: "refreshed"; accessToken: string; refreshToken: string }
  | { kind: "rejected" }
  | { kind: "unreachable" };

/**
 * A failed refresh call. `status` is the HTTP status of the response, or null
 * when there was no response at all (timeout, no network, DNS, TLS).
 */
export function classifyRefreshFailure(status: number | null): RefreshOutcome {
  // 400 counts too, as on the website (lib/auth/session-errors.ts): the
  // backend's DTO check refused the stored token's very shape, so the same
  // token will never be accepted. Kept as "unreachable" it would park the app
  // on the offline screen at every launch instead of the sign-in screen.
  if (status === 400 || status === 401 || status === 403) return { kind: "rejected" };
  return { kind: "unreachable" };
}

/** A 2xx refresh response, whatever its body turned out to be. */
export function classifyRefreshBody(body: unknown): RefreshOutcome {
  if (!body || typeof body !== "object") return { kind: "unreachable" };
  const envelope = body as { success?: unknown; data?: unknown };
  if (envelope.success === false) return { kind: "rejected" };
  const data = envelope.data as { accessToken?: unknown; refreshToken?: unknown } | undefined;
  if (
    envelope.success === true &&
    data &&
    typeof data.accessToken === "string" &&
    data.accessToken &&
    typeof data.refreshToken === "string" &&
    data.refreshToken
  ) {
    return { kind: "refreshed", accessToken: data.accessToken, refreshToken: data.refreshToken };
  }
  return { kind: "unreachable" };
}
