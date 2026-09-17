import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/store/authStore";

// No backend model for watchlist/favorites — purely client-side, same
// limitation as the web app's library-context.tsx.

/** The pre-v2, device-global key. Read once per user, then claimed (below). */
const LEGACY_KEY = "myanflix-watchlist";

/**
 * Per-user, like every other reader/pref namespace in this app
 * (readerPrefsStore, readerAnnotationsStore, readerBookViewStore all key on
 * the user id) — a second account on this device must not inherit, or
 * overwrite, the first one's favourites. Logout clears SecureStore and the
 * query cache but no AsyncStorage key, so the key itself has to do the work.
 */
function keyFor(): string {
  return `myanflix-watchlist:v2:${useAuthStore.getState().user?.id ?? "anon"}`;
}

async function readIds(): Promise<string[]> {
  try {
    const key = keyFor();
    let raw = await AsyncStorage.getItem(key);
    if (raw === null) {
      // One-time migration: the first account to look claims the pre-v2 list
      // (in practice the device's own owner) and removes it, so nobody else
      // inherits it afterwards. Copy BEFORE remove — a crash between the two
      // must not be able to lose the list.
      const legacy = await AsyncStorage.getItem(LEGACY_KEY);
      if (legacy !== null) {
        await AsyncStorage.setItem(key, legacy);
        await AsyncStorage.removeItem(LEGACY_KEY);
        raw = legacy;
      }
    }
    if (!raw) return [];
    // Same rule as the reader stores: a corrupt blob means "empty", never a
    // crash — and the array check matters because useToggleWatchlist calls
    // .includes() straight onto whatever comes back.
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

async function writeIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(keyFor(), JSON.stringify(ids));
}

export const watchlistService = {
  getIds: readIds,

  async add(movieId: string): Promise<string[]> {
    const ids = await readIds();
    if (ids.includes(movieId)) return ids;
    const next = [...ids, movieId];
    await writeIds(next);
    return next;
  },

  async remove(movieId: string): Promise<string[]> {
    const ids = await readIds();
    const next = ids.filter((id) => id !== movieId);
    await writeIds(next);
    return next;
  },
};
