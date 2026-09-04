import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useSaveReadingProgress } from "@/hooks/useBooks";

export interface ReadingPosition {
  chapterId?: string;
  /** Omitted (never null) when the reader doesn't know the section — the body stays identical for section-less books. */
  sectionId?: string;
  pageNumber?: number;
  /** 0–100 across the WHOLE book, not the current chapter. */
  progress: number;
}

/** One PATCH per this window at most — trailing, so the newest position always wins. */
const SAVE_INTERVAL_MS = 8000;

/**
 * The reading-progress PATCH throttle both readers share. `save` is called on
 * every scroll/page change and coalesces to one trailing request per 8s;
 * `forceSave` flushes immediately (chapter change). Unmount and
 * app-backgrounding flush whatever is pending on their own — callers don't
 * wire those. Failures are silently swallowed (never toast mid-read); every
 * success lands in the cache via the foundation mutation's setQueryData.
 */
export function useReadingProgressSaver(bookId: string, editionId: string | undefined) {
  const mutation = useSaveReadingProgress(bookId, editionId);
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;
  const editionRef = useRef(editionId);
  editionRef.current = editionId;

  const pendingRef = useRef<ReadingPosition | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentAtRef = useRef(0);

  const send = useCallback((position: ReadingPosition) => {
    if (!editionRef.current) return;
    lastSentAtRef.current = Date.now();
    // react-query's mutate never throws; onError is simply unused — silence is the contract.
    mutateRef.current(position);
  }, []);

  /** Flush now. With no argument, sends whatever `save` last queued (if anything). */
  const forceSave = useCallback(
    (position?: ReadingPosition) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const target = position ?? pendingRef.current;
      pendingRef.current = null;
      if (target) send(target);
    },
    [send],
  );

  /** Queue a position — sent immediately if the window is clear, else trailing. */
  const save = useCallback(
    (position: ReadingPosition) => {
      pendingRef.current = position;
      if (timerRef.current) return;
      const elapsed = Date.now() - lastSentAtRef.current;
      if (elapsed >= SAVE_INTERVAL_MS) {
        pendingRef.current = null;
        send(position);
        return;
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending) send(pending);
      }, SAVE_INTERVAL_MS - elapsed);
    },
    [send],
  );

  // Backgrounding the app flushes the pending position.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") forceSave();
    });
    return () => subscription.remove();
  }, [forceSave]);

  // Unmount (goBack, beforeRemove teardown) flushes too.
  useEffect(() => () => forceSave(), [forceSave]);

  return { save, forceSave };
}
