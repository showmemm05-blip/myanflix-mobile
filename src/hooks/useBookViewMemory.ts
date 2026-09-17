import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { PAGE_ZOOM_MAX, PAGE_ZOOM_MIN } from "@/components/books/PageZoomView";
import type { PageRotation } from "@/components/books/PageSheet";
import { loadBookView, saveBookView } from "@/store/readerBookViewStore";
import { useReaderPrefsStore, type ReaderFitMode, type ReaderPageMode } from "@/store/readerPrefsStore";

/** Every zoom that reaches state goes through this — steppers, pinch and the restored value alike. */
export function clampZoom(value: number): number {
  return Math.min(PAGE_ZOOM_MAX, Math.max(PAGE_ZOOM_MIN, Math.round(value * 100) / 100));
}

interface BookViewMemory {
  pageMode: ReaderPageMode;
  effFit: Exclude<ReaderFitMode, "page">;
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  rotation: PageRotation;
  setRotation: Dispatch<SetStateAction<PageRotation>>;
}

/**
 * The page reader's per-book view memory — the load/merge/save cycle against
 * readerBookViewStore, kept next to the store it guards rather than inside the
 * layout component.
 *
 * Per-book memory LAYERS over the global prefs, mirroring the web reader:
 * opening a book with a remembered layout must not silently rewrite the
 * default every other book inherits. An explicit edit in the settings sheet
 * writes the global store — and clears the override here, so the sheet's
 * choice takes effect immediately in this book too.
 */
export function useBookViewMemory(userId: string | null, bookId: string): BookViewMemory {
  const fitMode = useReaderPrefsStore((s) => s.fitMode);
  const storedPageMode = useReaderPrefsStore((s) => s.pageMode);

  const [viewOverride, setViewOverride] = useState<{
    pageMode?: ReaderPageMode;
    fit?: ReaderFitMode;
  }>({});

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState<PageRotation>(0);
  const memoryReadyRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void loadBookView(userId, bookId).then((memory) => {
      if (cancelled) return;
      setViewOverride({
        ...(memory?.pageMode ? { pageMode: memory.pageMode } : {}),
        ...(memory?.fit ? { fit: memory.fit } : {}),
      });
      if (typeof memory?.zoom === "number" && Number.isFinite(memory.zoom)) {
        setZoom(clampZoom(memory.zoom));
      }
      // Strict: a JSON round-trip turns undefined into null, and a null that
      // slips into rotation state renders "nulldeg" — a crash on every open
      // of this book until storage is cleared.
      if (
        memory?.rotation === 0 ||
        memory?.rotation === 90 ||
        memory?.rotation === 180 ||
        memory?.rotation === 270
      ) {
        setRotation(memory.rotation);
      }
      memoryReadyRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [userId, bookId]);

  // A store change after mount can only come from the settings sheet — that
  // explicit choice beats the remembered layout.
  const prevStoreView = useRef({ pageMode: storedPageMode, fit: fitMode });
  useEffect(() => {
    if (
      prevStoreView.current.pageMode !== storedPageMode ||
      prevStoreView.current.fit !== fitMode
    ) {
      prevStoreView.current = { pageMode: storedPageMode, fit: fitMode };
      setViewOverride({});
    }
  }, [storedPageMode, fitMode]);

  const pageMode = viewOverride.pageMode ?? storedPageMode;

  const overriddenFit = viewOverride.fit ?? fitMode;
  const effFit = overriddenFit === "page" ? "screen" : overriddenFit;
  useEffect(() => {
    if (!memoryReadyRef.current) return;
    saveBookView(userId, bookId, { pageMode, fit: effFit, zoom, rotation });
  }, [userId, bookId, pageMode, effFit, zoom, rotation]);

  return { pageMode, effFit, zoom, setZoom, rotation, setRotation };
}
