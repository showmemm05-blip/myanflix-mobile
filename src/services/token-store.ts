import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "myanflix_access_token";
const REFRESH_TOKEN_KEY = "myanflix_refresh_token";

// Plain in-memory pub-sub so api/client.ts can force a logout without
// importing the auth store directly (avoids a circular import between the
// two layers, same reasoning as the web app's token-store.ts).
type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function notifyUnauthorized() {
  unauthorizedListeners.forEach((listener) => listener());
}

/**
 * The decrypted access token, held in memory.
 *
 * `api/client.ts#request` reads it before EVERY call, and SecureStore is not a
 * plain file read — it goes over the bridge into SharedPreferences and then
 * AES-decrypts through the hardware keystore, so a screen that opens five
 * queries paid five native round trips for a value that had not changed.
 *
 * Three states, and the difference matters: `undefined` = never read, `null` =
 * read and there is none, a string = the live token. `setTokens` and `clear`
 * below are the ONLY writers of ACCESS_TOKEN_KEY in the app (auth.service and
 * the refresh in api/client.ts both go through them), so this cannot drift from
 * what is stored.
 *
 * The refresh token is deliberately NOT cached: it is read only when an access
 * token has already been rejected — a handful of times per session — so there
 * is nothing to save, and one fewer copy of the long-lived secret in memory.
 */
let accessTokenCache: string | null | undefined;

/**
 * Bumped by every write. A read that started before a `clear()` or a rotation
 * must NOT be allowed to publish what it found: SecureStore is async, so a
 * read in flight when the user logs out would otherwise resolve afterwards and
 * put the dead token back in the cache, where it would outlive the logout that
 * deleted it.
 */
let writeGeneration = 0;

export const tokenStore = {
  async getAccessToken(): Promise<string | null> {
    if (accessTokenCache !== undefined) return accessTokenCache;
    const generation = writeGeneration;
    const stored = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    // A write landed while this read was in flight — it is newer than what the
    // keystore just handed back, so it wins and the read is dropped. The cache
    // is never `undefined` here, because only a write can change `generation`.
    if (generation !== writeGeneration) return accessTokenCache ?? null;
    accessTokenCache = stored;
    return stored;
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  // This store keeps the two tokens and nothing else. There is deliberately no
  // cached user blob: authStore's contract is that the source of truth on cold
  // start is these tokens plus a fresh GET /users/me, so a serialised copy
  // would only ever be written, never read.
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    // Cache FIRST, before the awaits: a rotation revokes the previous refresh
    // token the instant the server answers, so from this line on the old access
    // token is dead and no concurrent request may still be handed it. If the
    // keystore write below then fails, the session still works for this run and
    // the next cold start simply finds no token.
    accessTokenCache = accessToken;
    writeGeneration += 1;
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
  },

  async clear(): Promise<void> {
    // Also first, and for a stronger reason than above: `useAuth.logout`'s
    // comment is that a rejected keystore delete must never turn "Log out" into
    // a no-op. Dropping the in-memory copy here is the one part of the wipe
    // that cannot fail, so even a throwing SecureStore leaves this process
    // unable to authenticate another request.
    accessTokenCache = null;
    writeGeneration += 1;
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      // Migration only: versions before this one wrote a user blob here that
      // nothing ever read back. Keep deleting it for one release so existing
      // installs do not leave it behind, then drop this line.
      SecureStore.deleteItemAsync("myanflix_user"),
    ]);
  },
};
