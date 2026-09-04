import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Client-side annotations for the OPEN book — bookmarks and paragraph
 * highlights (a note is a highlight with note text; there is no third
 * entity). Backend is out of scope: everything persists to AsyncStorage
 * keyed per user + book, same shape and key family as the web reader, so a
 * later server sync maps 1:1.
 */

export type HighlightColor = "yellow" | "green" | "blue" | "pink";

export interface ReaderBookmark {
  id: string;
  editionId: string;
  chapterId: string;
  /** Page books: the bookmarked page. */
  pageNumber?: number;
  /** Text books: scroll depth 0–1 within the chapter. */
  pct?: number;
  /** First words at the position, for the list row. */
  excerpt?: string;
  createdAt: string;
}

export interface ReaderHighlight {
  id: string;
  editionId: string;
  chapterId: string;
  /** Index of the top-level block in the chapter's ProseMirror doc. */
  blockIndex: number;
  /** Reserved for sub-paragraph ranges (web); mobile highlights whole blocks. */
  start?: number;
  end?: number;
  /** <= 240 chars of the block's text. */
  excerpt: string;
  color: HighlightColor;
  /** <= 2000 chars. Presence of text makes this row a "note". */
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

export const BOOKMARK_CAP = 200;
export const HIGHLIGHT_CAP = 500;
export const EXCERPT_MAX = 240;
export const NOTE_MAX = 2000;

interface AnnotationsBlob {
  version: 1;
  bookmarks: ReaderBookmark[];
  highlights: ReaderHighlight[];
}

interface ReaderAnnotationsState {
  /** Key parts of the blob currently loaded; null until loadAnnotations ran. */
  userId: string | null;
  bookId: string | null;
  loaded: boolean;
  bookmarks: ReaderBookmark[];
  highlights: ReaderHighlight[];
  /** Hydrates the store for one user+book; call on reader mount. */
  loadAnnotations: (userId: string | null, bookId: string) => Promise<void>;
  /** False when the 200-bookmark cap refuses the write (show annotationLimit). */
  addBookmark: (bookmark: Omit<ReaderBookmark, "id" | "createdAt">) => boolean;
  removeBookmark: (id: string) => void;
  /** False when the 500-highlight cap refuses the write (show annotationLimit). */
  addHighlight: (
    highlight: Omit<ReaderHighlight, "id" | "createdAt" | "excerpt"> & { excerpt: string },
  ) => boolean;
  updateHighlight: (id: string, patch: Partial<Pick<ReaderHighlight, "color" | "note">>) => void;
  removeHighlight: (id: string) => void;
}

function annotationsKey(userId: string | null, bookId: string): string {
  return `myanflix-reader-annos:v1:${userId ?? "anon"}:${bookId}`;
}

/** No crypto.randomUUID in Hermes — a hex id is plenty for device-local rows. */
export function randomAnnotationId(): string {
  let out = "";
  for (let i = 0; i < 4; i += 1) {
    out += Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, "0");
  }
  return out;
}

function sanitizeList<T extends { id?: unknown }>(value: unknown): T[] {
  return Array.isArray(value)
    ? (value.filter((row) => row && typeof row === "object" && typeof (row as T).id === "string") as T[])
    : [];
}

/** Write-through — every mutation lands on disk; failures stay in memory only. */
function persist(state: Pick<ReaderAnnotationsState, "userId" | "bookId" | "bookmarks" | "highlights">) {
  if (!state.bookId) return;
  const blob: AnnotationsBlob = { version: 1, bookmarks: state.bookmarks, highlights: state.highlights };
  AsyncStorage.setItem(annotationsKey(state.userId, state.bookId), JSON.stringify(blob)).catch(() => {});
}

export const useReaderAnnotationsStore = create<ReaderAnnotationsState>()((set, get) => ({
  userId: null,
  bookId: null,
  loaded: false,
  bookmarks: [],
  highlights: [],

  loadAnnotations: async (userId, bookId) => {
    // Clear first so a slow read never shows the previous book's rows.
    set({ userId, bookId, loaded: false, bookmarks: [], highlights: [] });
    let bookmarks: ReaderBookmark[] = [];
    let highlights: ReaderHighlight[] = [];
    try {
      const raw = await AsyncStorage.getItem(annotationsKey(userId, bookId));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AnnotationsBlob>;
        bookmarks = sanitizeList<ReaderBookmark>(parsed.bookmarks);
        highlights = sanitizeList<ReaderHighlight>(parsed.highlights);
      }
    } catch {
      // Corrupt blob — start empty rather than crash; the next write replaces it.
    }
    // Another book may have started loading meanwhile — last call wins.
    const current = get();
    if (current.bookId !== bookId || current.userId !== userId) return;
    set({ loaded: true, bookmarks, highlights });
  },

  addBookmark: (bookmark) => {
    const state = get();
    if (state.bookmarks.length >= BOOKMARK_CAP) return false; // NEVER silently evict.
    const row: ReaderBookmark = {
      ...bookmark,
      excerpt: bookmark.excerpt?.slice(0, EXCERPT_MAX),
      id: randomAnnotationId(),
      createdAt: new Date().toISOString(),
    };
    const bookmarks = [...state.bookmarks, row];
    set({ bookmarks });
    persist({ ...state, bookmarks });
    return true;
  },

  removeBookmark: (id) => {
    const state = get();
    const bookmarks = state.bookmarks.filter((row) => row.id !== id);
    set({ bookmarks });
    persist({ ...state, bookmarks });
  },

  addHighlight: (highlight) => {
    const state = get();
    if (state.highlights.length >= HIGHLIGHT_CAP) return false; // NEVER silently evict.
    const row: ReaderHighlight = {
      ...highlight,
      excerpt: highlight.excerpt.slice(0, EXCERPT_MAX),
      note: highlight.note?.slice(0, NOTE_MAX),
      id: randomAnnotationId(),
      createdAt: new Date().toISOString(),
    };
    const highlights = [...state.highlights, row];
    set({ highlights });
    persist({ ...state, highlights });
    return true;
  },

  updateHighlight: (id, patch) => {
    const state = get();
    const highlights = state.highlights.map((row) =>
      row.id === id
        ? {
            ...row,
            ...patch,
            note: patch.note !== undefined ? patch.note?.slice(0, NOTE_MAX) : row.note,
            updatedAt: new Date().toISOString(),
          }
        : row,
    );
    set({ highlights });
    persist({ ...state, highlights });
  },

  removeHighlight: (id) => {
    const state = get();
    const highlights = state.highlights.filter((row) => row.id !== id);
    set({ highlights });
    persist({ ...state, highlights });
  },
}));
