import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "myanflix-watchlist";

// No backend model for watchlist/favorites — purely client-side, same
// limitation as the web app's library-context.tsx.
async function readIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

async function writeIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
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
