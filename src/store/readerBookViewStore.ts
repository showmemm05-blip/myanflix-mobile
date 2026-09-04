import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ReaderFitMode, ReaderPageMode } from "@/store/readerPrefsStore";

/**
 * Per-BOOK view memory for the page reader — remembered layout, fit, zoom
 * and rotation, keyed per user + book. A plain async module, not zustand:
 * PageReader loads once on mount (falling back to the global prefs) and
 * saves patches debounced. Server still owns last-position; this is purely
 * client-side (backend out of scope).
 */

export interface BookViewMemory {
  pageMode?: ReaderPageMode;
  fit?: Exclude<ReaderFitMode, "page">;
  /** Last committed zoom multiplier over the fitted size. */
  zoom?: number;
  rotation?: 0 | 90 | 180 | 270;
}

const SAVE_DEBOUNCE_MS = 500;

function bookViewKey(userId: string | null, bookId: string): string {
  return `myanflix-reader-book:v1:${userId ?? "anon"}:${bookId}`;
}

function sanitize(raw: unknown): BookViewMemory | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const out: BookViewMemory = {};
  if (value.pageMode === "scroll" || value.pageMode === "single" || value.pageMode === "double") {
    out.pageMode = value.pageMode;
  }
  if (value.fit === "width" || value.fit === "height" || value.fit === "screen") out.fit = value.fit;
  else if (value.fit === "page") out.fit = "screen"; // legacy id, one mapping everywhere
  if (typeof value.zoom === "number" && Number.isFinite(value.zoom)) {
    out.zoom = Math.min(3, Math.max(1, value.zoom));
  }
  if (value.rotation === 0 || value.rotation === 90 || value.rotation === 180 || value.rotation === 270) {
    out.rotation = value.rotation;
  }
  return out;
}

export async function loadBookView(userId: string | null, bookId: string): Promise<BookViewMemory | null> {
  try {
    const raw = await AsyncStorage.getItem(bookViewKey(userId, bookId));
    if (!raw) return null;
    return sanitize(JSON.parse(raw));
  } catch {
    return null;
  }
}

interface Pending {
  timer: ReturnType<typeof setTimeout>;
  patch: BookViewMemory;
}

/** One pending write per user+book; patches merge until the debounce fires. */
const pending = new Map<string, Pending>();

export function saveBookView(userId: string | null, bookId: string, patch: BookViewMemory): void {
  const key = bookViewKey(userId, bookId);
  const existing = pending.get(key);
  const merged = { ...(existing?.patch ?? {}), ...patch };
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    pending.delete(key);
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        const current = raw ? (sanitize(JSON.parse(raw)) ?? {}) : {};
        await AsyncStorage.setItem(key, JSON.stringify({ ...current, ...merged }));
      } catch {
        // Storage failure — view memory is a convenience, never worth a crash.
      }
    })();
  }, SAVE_DEBOUNCE_MS);
  pending.set(key, { timer, patch: merged });
}
