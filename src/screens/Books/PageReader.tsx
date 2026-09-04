import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useReducedMotion } from "react-native-reanimated";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ThemedText } from "@/components/ui/ThemedText";
import { ReaderTopBar } from "@/components/books/ReaderTopBar";
import { ReaderFooter } from "@/components/books/ReaderFooter";
import { ReaderContentsSheet } from "@/components/books/ReaderContentsSheet";
import { ReaderSettingsSheet, type ReaderPagesControls } from "@/components/books/ReaderSettingsSheet";
import { ReaderDim } from "@/components/books/ReaderDim";
import { ReaderKeepAwake } from "@/components/books/ReaderKeepAwake";
import { PageSheet, FOLIO_HEIGHT, type PageRotation } from "@/components/books/PageSheet";
import { PageThumbGrid } from "@/components/books/PageThumbGrid";
import { PageZoomView, PAGE_ZOOM_MAX, PAGE_ZOOM_MIN } from "@/components/books/PageZoomView";
import { READER_THEMES } from "@/components/books/readerThemes";
import { Skeleton } from "@/components/common/Skeleton";
import { useChapterPages, useContents } from "@/hooks/useBooks";
import { useReadingProgressSaver, type ReadingPosition } from "@/hooks/useReadingProgressSaver";
import { useLanguage } from "@/localization/LanguageProvider";
import { useAuthStore } from "@/store/authStore";
import { useReaderAnnotationsStore, type ReaderBookmark } from "@/store/readerAnnotationsStore";
import { loadBookView, saveBookView } from "@/store/readerBookViewStore";
import { PAGE_BACKGROUND_COLOR, useReaderPrefsStore, type ReaderPageMode, type ReaderFitMode } from "@/store/readerPrefsStore";
import { sectionIdAtPage } from "@/utils/chapterSections";
import { theme, withAlpha } from "@/theme";
import type { BookChapterSummary, BookDetail, BookEdition, BookPage, BookSectionSummary } from "@/types/book";

interface Props {
  book: BookDetail;
  edition: BookEdition;
  /** Sorted by `order`. */
  chapters: BookChapterSummary[];
  initialChapterId: string;
  /** Applies to the INITIAL chapter only (param > bookmark, resolved by BookReader). */
  initialPageNumber?: number;
  onClose: () => void;
}

/** Vertical air between sheets. Part of every item's exact height. */
const GAP = 16;
/** The list contentContainer's top padding — also baked into layout offsets above. */
const LIST_TOP_PADDING = 96;
/** Real images mount only within this many items of the current page — ~5 decoded pages max. */
const RENDER_WINDOW = 2;
const CHROME_HIDE_MS = 2500;
/** Bar allowance a paged sheet leaves for the (overlaying, auto-hiding) chrome. */
const PAGED_V_ALLOWANCE = 140;
const ZOOM_STEP = 0.25;
/** How long the cap-refusal notice stays up. */
const NOTICE_MS = 3000;

function clampZoom(value: number): number {
  return Math.min(PAGE_ZOOM_MAX, Math.max(PAGE_ZOOM_MIN, Math.round(value * 100) / 100));
}

/** Largest index whose offset is at or above the viewport midpoint. */
function findItemAt(offsets: number[], y: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] <= y) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * The scanned-book reader — ONE chapter of pre-rendered page images at a
 * time, in three layouts sharing one placeholder contract (only ±2 items
 * around the current one hold decoded images):
 *
 * - scroll: the original windowed vertical list — every item's height is
 *   exact from the manifest so the scroll length is honest from first paint;
 * - single: a horizontal paged list, one sheet per screen, pinch-zoomable;
 * - double: the same list as spreads [1],[2,3],[4,5]… in landscape, falling
 *   back to single-page behaviour in portrait (the label stays "Spread").
 *
 * Fit/rotation/background/direction come from readerPrefsStore; the per-book
 * layout memory (pageMode/fit/zoom/rotation) restores from
 * readerBookViewStore on mount and saves debounced on change.
 */
export function PageReader({ book, edition, chapters, initialChapterId, initialPageNumber, onClose }: Props) {
  const { t } = useLanguage();
  const r = t.books.reader;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const readerTheme = useReaderPrefsStore((s) => s.readerTheme);
  const fitMode = useReaderPrefsStore((s) => s.fitMode);
  const storedPageMode = useReaderPrefsStore((s) => s.pageMode);
  const pageBackground = useReaderPrefsStore((s) => s.pageBackground);
  const pageDirection = useReaderPrefsStore((s) => s.pageDirection);
  const brightness = useReaderPrefsStore((s) => s.brightness);
  const keepAwake = useReaderPrefsStore((s) => s.keepAwake);
  const autoHideChrome = useReaderPrefsStore((s) => s.autoHideChrome);
  const fullscreen = useReaderPrefsStore((s) => s.fullscreen);
  const setPageMode = useReaderPrefsStore((s) => s.setPageMode);
  const setFitMode = useReaderPrefsStore((s) => s.setFitMode);
  /**
   * Per-book memory LAYERS over the global prefs, mirroring the web reader:
   * opening a book with a remembered layout must not silently rewrite the
   * default every other book inherits. An explicit edit in the settings
   * sheet writes the global store — and clears the override below, so the
   * sheet's choice takes effect immediately in this book too.
   */
  const [viewOverride, setViewOverride] = useState<{
    pageMode?: ReaderPageMode;
    fit?: ReaderFitMode;
  }>({});

  const colors = READER_THEMES[readerTheme];
  /** Stage colour behind/around the sheets; the sheet itself stays white. */
  const stageColor = PAGE_BACKGROUND_COLOR[pageBackground] ?? colors.bg;

  /* -------- per-book view memory: zoom + rotation local, mode/fit via prefs -------- */
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState<PageRotation>(0);
  const memoryReadyRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void loadBookView(userId, book.id).then((memory) => {
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
  }, [userId, book.id]);

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
    saveBookView(userId, book.id, { pageMode, fit: effFit, zoom, rotation });
  }, [userId, book.id, pageMode, effFit, zoom, rotation]);

  /* -------- chapter + pages -------- */
  const [chapterId, setChapterId] = useState(initialChapterId);
  const chapterIndex = Math.max(
    0,
    chapters.findIndex((chapter) => chapter.id === chapterId),
  );
  const chapter = chapters[chapterIndex];
  const chapterReady = chapter?.status === "READY";
  const pagesQuery = useChapterPages(book.id, edition.id, chapterReady ? chapterId : undefined);
  const pages = useMemo(() => pagesQuery.data ?? [], [pagesQuery.data]);
  const contentsQuery = useContents(book.id, edition.id);
  /** PDF sections are page anchors — [] for every existing chapter. */
  const chapterSections = chapter?.sections ?? [];

  const saver = useReadingProgressSaver(book.id, edition.id);
  const lastPositionRef = useRef<ReadingPosition | null>(null);

  /* -------- layout mode -------- */
  const rotatedQuarter = rotation === 90 || rotation === 270;
  const paged = pageMode !== "scroll";
  /** Spread needs landscape room; portrait quietly reads single (documented UX). */
  const doubleActive = pageMode === "double" && windowWidth > windowHeight;
  /** "Fit height" is meaningless while the list scrolls vertically. */
  const scrollFit = effFit === "height" ? "width" : effFit;

  /* -------- exact geometry, precomputed once per (pages, fit, rotation, width) -------- */
  const contentWidth = windowWidth - 2 * theme.spacing.md;
  const heightBudget = Math.max(240, windowHeight - 200);
  const layout = useMemo(() => {
    const boxes = pages.map((page) => {
      const base = page.width > 0 && page.height > 0 ? page.width / page.height : 0.7;
      const ratio = rotatedQuarter ? 1 / base : base; // quarter turns swap the aspect box
      const width = scrollFit === "screen" ? Math.min(contentWidth, heightBudget * ratio) : contentWidth;
      return { width, height: width / ratio };
    });
    const itemHeights = boxes.map((box) => box.height + FOLIO_HEIGHT + GAP);
    const offsets: number[] = [];
    // Offsets are in CONTENT coordinates, and the list's contentContainer
    // carries LIST_TOP_PADDING of its own — leave it out and every
    // scrollToIndex (resume, jump-to-page, prev/next) lands that many points
    // early, and the page counter flips before the page actually crosses the
    // midpoint. RN's getItemLayout contract includes leading padding.
    let acc = LIST_TOP_PADDING;
    for (const height of itemHeights) {
      offsets.push(acc);
      acc += height;
    }
    return { boxes, itemHeights, offsets };
  }, [pages, scrollFit, contentWidth, heightBudget, rotatedQuarter]);

  /* -------- paged geometry -------- */
  const pagedAvailH = Math.max(240, windowHeight - PAGED_V_ALLOWANCE) - FOLIO_HEIGHT;
  const fitBox = useCallback(
    (page: BookPage, availW: number) => {
      const base = page.width > 0 && page.height > 0 ? page.width / page.height : 0.7;
      const ratio = rotatedQuarter ? 1 / base : base;
      let width: number;
      if (effFit === "height") width = pagedAvailH * ratio;
      else if (effFit === "screen") width = Math.min(availW, pagedAvailH * ratio);
      else width = availW;
      return { width, height: width / ratio };
    },
    [effFit, rotatedQuarter, pagedAvailH],
  );

  /** Spread items: cover alone, then pairs — [1],[2,3],[4,5]… Single mode: one page each. */
  const spreads = useMemo(() => {
    if (!doubleActive) return pages.map((page) => [page]);
    const out: BookPage[][] = [];
    if (pages.length > 0) out.push([pages[0]]);
    for (let i = 1; i < pages.length; i += 2) out.push(pages.slice(i, i + 2));
    return out;
  }, [pages, doubleActive]);

  const itemIndexForPage = useCallback(
    (pageIdx: number) => (!doubleActive ? pageIdx : pageIdx === 0 ? 0 : Math.ceil(pageIdx / 2)),
    [doubleActive],
  );
  const firstPageOfItem = useCallback(
    (itemIdx: number) => (!doubleActive ? itemIdx : itemIdx === 0 ? 0 : itemIdx * 2 - 1),
    [doubleActive],
  );

  const listRef = useRef<FlatList<BookPage>>(null);
  const pagedListRef = useRef<FlatList<BookPage[]>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);

  /* -------- chrome -------- */
  const [chromeVisible, setChromeVisible] = useState(true);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpText, setJumpText] = useState("");
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    // autoHideChrome=false pins the bars until an explicit tap; under OS
    // reduce-motion the idle timer NEVER arms regardless of the setting.
    if (!autoHideChrome || reduceMotion) return;
    hideTimerRef.current = setTimeout(() => setChromeVisible(false), CHROME_HIDE_MS);
  }, [autoHideChrome, reduceMotion]);
  useEffect(() => {
    armHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [armHideTimer]);
  useEffect(() => {
    if (!autoHideChrome) setChromeVisible(true);
  }, [autoHideChrome]);
  const toggleChrome = useCallback(() => {
    setChromeVisible((visible) => {
      if (!visible) armHideTimer();
      return !visible;
    });
  }, [armHideTimer]);
  const barsVisible = chromeVisible || contentsOpen || settingsOpen || jumpOpen;

  /* -------- annotation-cap notice -------- */
  const [limitNotice, setLimitNotice] = useState(false);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showLimitNotice = useCallback(() => {
    setLimitNotice(true);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setLimitNotice(false), NOTICE_MS);
  }, []);
  useEffect(
    () => () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    },
    [],
  );

  /* -------- current page bookkeeping shared by every mode -------- */
  const commitPage = useCallback(
    (index: number) => {
      if (pages.length === 0) return;
      const clamped = Math.max(0, Math.min(pages.length - 1, index));
      if (clamped === currentIndexRef.current) return;
      currentIndexRef.current = clamped;
      setCurrentIndex(clamped);
      const progress = Math.max(
        0,
        Math.min(100, ((chapterIndex + (clamped + 1) / pages.length) / chapters.length) * 100),
      );
      // The key is OMITTED (not null) when unknown, so section-less books PATCH the identical body.
      const sectionId = sectionIdAtPage(chapterSections, clamped + 1);
      const position: ReadingPosition = {
        chapterId,
        pageNumber: clamped + 1,
        progress,
        ...(sectionId ? { sectionId } : {}),
      };
      lastPositionRef.current = position;
      saver.save(position);
    },
    [pages.length, chapterIndex, chapters.length, chapterId, saver, chapterSections],
  );

  const scrollToPageIndex = useCallback(
    (pageIdx: number, animated: boolean) => {
      if (paged) {
        pagedListRef.current?.scrollToIndex({ index: itemIndexForPage(pageIdx), animated });
      } else {
        listRef.current?.scrollToIndex({ index: pageIdx, animated });
      }
    },
    [paged, itemIndexForPage],
  );

  /* -------- scroll mode: MIDPOINT test over the exact offsets -------- */
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pages.length === 0) return;
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      const midpoint = contentOffset.y + layoutMeasurement.height / 2;
      commitPage(findItemAt(layout.offsets, midpoint));
    },
    [pages.length, layout.offsets, commitPage],
  );

  /* -------- paged modes: settle on the snapped item -------- */
  const handlePagedScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (spreads.length === 0 || windowWidth <= 0) return;
      const itemIdx = Math.max(
        0,
        Math.min(spreads.length - 1, Math.round(event.nativeEvent.contentOffset.x / windowWidth)),
      );
      commitPage(firstPageOfItem(itemIdx));
    },
    [spreads.length, windowWidth, commitPage, firstPageOfItem],
  );

  /* -------- resume, ONCE per mount -------- */
  const restoredRef = useRef(false);
  const [listReady, setListReady] = useState(false);
  useEffect(() => {
    if (restoredRef.current || !listReady || pages.length === 0) return;
    restoredRef.current = true;
    const target = initialPageNumber;
    if (target && target > 1 && target <= pages.length) {
      currentIndexRef.current = target - 1;
      setCurrentIndex(target - 1);
      requestAnimationFrame(() => {
        scrollToPageIndex(target - 1, false);
      });
    }
  }, [listReady, pages.length, initialPageNumber, scrollToPageIndex]);

  /* -------- deferred jumps (bookmarks landing in a different chapter) -------- */
  const pendingPageRef = useRef<number | null>(null);
  useEffect(() => {
    if (pendingPageRef.current == null || pages.length === 0) return;
    const idx = Math.max(0, Math.min(pages.length - 1, pendingPageRef.current - 1));
    pendingPageRef.current = null;
    currentIndexRef.current = idx;
    setCurrentIndex(idx);
    requestAnimationFrame(() => {
      scrollToPageIndex(idx, false);
    });
  }, [pages, scrollToPageIndex]);

  const goToPage = useCallback(
    (index: number) => {
      if (pages.length === 0) return;
      const clamped = Math.max(0, Math.min(pages.length - 1, index));
      commitPage(clamped);
      scrollToPageIndex(clamped, !reduceMotion);
    },
    [pages.length, commitPage, scrollToPageIndex, reduceMotion],
  );

  // Rotation / fit changes re-shape every box — keep the open page under the
  // reader instead of letting the new offsets land somewhere else.
  useEffect(() => {
    requestAnimationFrame(() => {
      if (currentIndexRef.current > 0) scrollToPageIndex(currentIndexRef.current, false);
    });
  }, [rotation, effFit, scrollToPageIndex]);

  const goToChapter = useCallback(
    (nextChapterId: string, entryPage = 1) => {
      saver.forceSave(lastPositionRef.current ?? undefined);
      // The turn itself is a position: without seeding the NEW chapter,
      // closing the reader before the first scroll resumes the chapter just left.
      const entryProgress = Math.max(
        0,
        Math.min(
          100,
          ((chapters.findIndex((c) => c.id === nextChapterId) + 0) / Math.max(chapters.length, 1)) * 100,
        ),
      );
      const entryPosition: ReadingPosition = {
        chapterId: nextChapterId,
        pageNumber: entryPage,
        progress: entryProgress,
      };
      lastPositionRef.current = entryPosition;
      saver.save(entryPosition);
      if (entryPage > 1) pendingPageRef.current = entryPage;
      setChapterId(nextChapterId);
      currentIndexRef.current = 0;
      setCurrentIndex(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      pagedListRef.current?.scrollToOffset({ offset: 0, animated: false });
      setChromeVisible(true);
      armHideTimer();
    },
    [saver, chapters, armHideTimer],
  );

  /* -------- bookmarks (client-side, per user + book) -------- */
  const bookmarks = useReaderAnnotationsStore((s) => s.bookmarks);
  const addBookmark = useReaderAnnotationsStore((s) => s.addBookmark);
  const removeBookmark = useReaderAnnotationsStore((s) => s.removeBookmark);
  const currentBookmark = bookmarks.find(
    (row) => row.editionId === edition.id && row.chapterId === chapterId && row.pageNumber === currentIndex + 1,
  );
  const toggleBookmark = useCallback(() => {
    if (currentBookmark) {
      removeBookmark(currentBookmark.id);
      return;
    }
    const ok = addBookmark({ editionId: edition.id, chapterId, pageNumber: currentIndexRef.current + 1 });
    if (!ok) showLimitNotice();
  }, [currentBookmark, removeBookmark, addBookmark, edition.id, chapterId, showLimitNotice]);

  const jumpToBookmark = useCallback(
    (bookmark: ReaderBookmark) => {
      const target = bookmark.pageNumber ?? 1;
      if (bookmark.chapterId === chapterId) {
        goToPage(target - 1);
      } else if (chapters.some((c) => c.id === bookmark.chapterId && c.status === "READY")) {
        goToChapter(bookmark.chapterId, target);
      }
    },
    [chapterId, chapters, goToPage, goToChapter],
  );

  /* -------- zoom + rotation controls (paged zoom; rotate everywhere) -------- */
  const zoomIn = useCallback(() => setZoom((value) => clampZoom(value + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setZoom((value) => clampZoom(value - ZOOM_STEP)), []);
  const zoomReset = useCallback(() => setZoom(1), []);
  const rotate = useCallback(() => setRotation((value) => (((value + 90) % 360) as PageRotation)), []);
  const commitZoom = useCallback((value: number) => setZoom(clampZoom(value)), []);
  // Scroll mode keeps the FlatList windowing contract — it "zooms" via fit
  // only, so the sheet's zoom row reads 1x and the steppers stand down.
  const noop = useCallback(() => {}, []);
  const pagesControls: ReaderPagesControls = {
    zoom: paged ? zoom : 1,
    onZoomIn: paged ? zoomIn : noop,
    onZoomOut: paged ? zoomOut : noop,
    onZoomReset: paged ? zoomReset : noop,
    onRotate: rotate,
  };

  const previousChapter = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
  const nextChapter = chapterIndex < chapters.length - 1 ? chapters[chapterIndex + 1] : null;

  /* -------- scroll-mode items -------- */
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<BookPage>) => {
      const box = layout.boxes[index];
      const near = Math.abs(index - currentIndex) <= RENDER_WINDOW;
      return (
        <Pressable onPress={toggleChrome} accessible={false} style={[styles.item, { height: layout.itemHeights[index] }]}>
          {near ? (
            <PageSheet
              url={item.url}
              width={box.width}
              height={box.height}
              pageNumber={item.pageNumber}
              rotation={rotation}
              stageColor={stageColor}
            />
          ) : (
            // The exact same box, empty — the placeholder rule is the memory contract.
            <View
              style={[
                styles.placeholder,
                { width: box.width, height: box.height + FOLIO_HEIGHT, backgroundColor: withAlpha(colors.ink, 0.04) },
              ]}
            />
          )}
        </Pressable>
      );
    },
    [layout, currentIndex, toggleChrome, colors.ink, rotation, stageColor],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<BookPage> | null | undefined, index: number) => ({
      length: layout.itemHeights[index] ?? 0,
      offset: layout.offsets[index] ?? 0,
      index,
    }),
    [layout],
  );

  /* -------- paged items (single sheet or spread inside one zoom surface) -------- */
  const currentItemIndex = itemIndexForPage(currentIndex);
  const renderPagedItem = useCallback(
    ({ item, index }: ListRenderItemInfo<BookPage[]>) => {
      const near = Math.abs(index - currentItemIndex) <= RENDER_WINDOW;
      // RTL flips the pair order too — [2,3] reads 3 then 2.
      const displayPages = pageDirection === "rtl" && item.length === 2 ? [item[1], item[0]] : item;
      const perPageAvailW =
        item.length === 2 ? (windowWidth - 3 * theme.spacing.md) / 2 : windowWidth - 2 * theme.spacing.md;
      const boxes = displayPages.map((page) => fitBox(page, perPageAvailW));
      const spreadWidth =
        boxes.reduce((sum, box) => sum + box.width, 0) + (boxes.length - 1) * theme.spacing.sm;
      const spreadHeight = Math.max(...boxes.map((box) => box.height)) + FOLIO_HEIGHT;
      return (
        <View style={{ width: windowWidth, height: "100%" }}>
          <PageZoomView
            boxWidth={windowWidth}
            boxHeight={windowHeight}
            contentWidth={spreadWidth}
            contentHeight={spreadHeight}
            zoom={zoom}
            onZoomCommit={commitZoom}
            onSingleTap={toggleChrome}
          >
            <View style={styles.spreadRow}>
              {displayPages.map((page, i) =>
                near ? (
                  <PageSheet
                    key={page.pageNumber}
                    url={page.url}
                    width={boxes[i].width}
                    height={boxes[i].height}
                    pageNumber={page.pageNumber}
                    rotation={rotation}
                    stageColor={stageColor}
                  />
                ) : (
                  // Same box, no decode — the RENDER_WINDOW contract holds in every mode.
                  <View
                    key={page.pageNumber}
                    style={[
                      styles.placeholder,
                      {
                        width: boxes[i].width,
                        height: boxes[i].height + FOLIO_HEIGHT,
                        backgroundColor: withAlpha(colors.ink, 0.04),
                      },
                    ]}
                  />
                ),
              )}
            </View>
          </PageZoomView>
        </View>
      );
    },
    [
      currentItemIndex,
      pageDirection,
      windowWidth,
      windowHeight,
      fitBox,
      zoom,
      commitZoom,
      toggleChrome,
      rotation,
      stageColor,
      colors.ink,
    ],
  );

  const getPagedItemLayout = useCallback(
    (_: ArrayLike<BookPage[]> | null | undefined, index: number) => ({
      length: windowWidth,
      offset: windowWidth * index,
      index,
    }),
    [windowWidth],
  );

  const endControls = (
    <View style={styles.endControls}>
      {previousChapter && (
        <Button
          title={previousChapter.title}
          icon="chevron-back"
          variant="outline"
          onPress={() => goToChapter(previousChapter.id)}
          disabled={previousChapter.status !== "READY"}
          accessibilityLabel={r.previousChapter}
          style={styles.endButton}
        />
      )}
      {nextChapter ? (
        <Button
          title={nextChapter.title}
          trailingIcon="chevron-forward"
          variant="outline"
          onPress={() => goToChapter(nextChapter.id)}
          disabled={nextChapter.status !== "READY"}
          accessibilityLabel={r.nextChapter}
          style={styles.endButton}
        />
      ) : (
        <ThemedText variant="caption" style={[styles.finished, { color: colors.muted }]}>
          {r.finished}
        </ThemedText>
      )}
    </View>
  );

  // Null while converting/empty/errored — a counter over zero pages reads
  // as "1 / 0", which is worse than no counter.
  const footerLabel =
    pages.length === 0
      ? null
      : paged && zoom > 1.001
        ? `${Math.min(currentIndex + 1, pages.length)} / ${pages.length} · ${Math.round(zoom * 100)}%`
        : `${Math.min(currentIndex + 1, pages.length)} / ${pages.length}`;

  const submitJump = useCallback(() => {
    const target = parseInt(jumpText, 10);
    setJumpOpen(false);
    setJumpText("");
    if (Number.isFinite(target) && target >= 1 && target <= pages.length) {
      goToPage(target - 1);
    }
  }, [jumpText, pages.length, goToPage]);

  const initialPagedIndex =
    spreads.length > 0 ? Math.min(itemIndexForPage(currentIndexRef.current), spreads.length - 1) : 0;

  return (
    <View style={[styles.container, { backgroundColor: stageColor }]}>
      <StatusBar style={colors.barStyle} hidden={fullscreen} />
      <ReaderKeepAwake enabled={keepAwake} />

      {!chapterReady ? (
        // Still converting — said INSIDE the reader so neighbour chapters stay one tap away.
        <View style={styles.centerState}>
          <ThemedText variant="body" style={{ color: colors.muted, textAlign: "center" }}>
            {r.stillConverting}
          </ThemedText>
          {endControls}
        </View>
      ) : pagesQuery.isLoading ? (
        <View style={styles.centerState}>
          <Skeleton width={contentWidth} height={Math.min(contentWidth * 1.4, heightBudget)} radius="sm" />
        </View>
      ) : pagesQuery.isError ? (
        <View style={styles.centerState}>
          <EmptyState
            fill={false}
            message={r.loadError}
            icon="cloud-offline-outline"
            tone={theme.colors.danger}
            actionLabel={t.common.retry}
            onAction={() => pagesQuery.refetch()}
          />
        </View>
      ) : pages.length === 0 ? (
        <View style={styles.centerState}>
          <ThemedText variant="body" style={{ color: colors.muted, textAlign: "center" }}>
            {r.emptyChapter}
          </ThemedText>
          {endControls}
        </View>
      ) : paged ? (
        <FlatList
          // Remount on layout-shape changes so initialScrollIndex re-lands on the page.
          key={`paged-${doubleActive ? "double" : "single"}-${pageDirection}`}
          ref={pagedListRef}
          data={spreads}
          horizontal
          pagingEnabled
          // RTL page turns: the list itself runs right-to-left.
          inverted={pageDirection === "rtl"}
          // Page swipes win only at 1x; zoomed, the pan inside PageZoomView owns the touches.
          scrollEnabled={zoom <= 1.001}
          keyExtractor={(item) => String(item[0].pageNumber)}
          renderItem={renderPagedItem}
          getItemLayout={getPagedItemLayout}
          initialScrollIndex={initialPagedIndex}
          onMomentumScrollEnd={handlePagedScrollEnd}
          onLayout={() => setListReady(true)}
          showsHorizontalScrollIndicator={false}
          windowSize={5}
          maxToRenderPerBatch={2}
        />
      ) : (
        <FlatList
          ref={listRef}
          data={pages}
          keyExtractor={(page) => String(page.pageNumber)}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          initialScrollIndex={Math.min(currentIndexRef.current, pages.length - 1)}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onLayout={() => setListReady(true)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={endControls}
          windowSize={5}
          maxToRenderPerBatch={4}
          removeClippedSubviews
        />
      )}

      <ReaderTopBar
        visible={barsVisible}
        colors={colors}
        title={book.title}
        onContents={() => setContentsOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onClose={onClose}
        onBookmark={pages.length > 0 ? toggleBookmark : undefined}
        bookmarked={!!currentBookmark}
      />
      <ReaderFooter
        visible={barsVisible}
        colors={colors}
        label={footerLabel}
        onPressLabel={pages.length > 0 ? () => setJumpOpen(true) : undefined}
        labelAccessibilityLabel={r.jumpToPage}
        onPrev={() => goToPage(paged ? firstPageOfItem(Math.max(0, currentItemIndex - 1)) : currentIndex - 1)}
        onNext={() => goToPage(paged ? firstPageOfItem(currentItemIndex + 1) : currentIndex + 1)}
        prevDisabled={pages.length === 0 || (paged ? currentItemIndex <= 0 : currentIndex <= 0)}
        nextDisabled={
          pages.length === 0 || (paged ? currentItemIndex >= spreads.length - 1 : currentIndex >= pages.length - 1)
        }
        prevAccessibilityLabel={r.previousPage}
        nextAccessibilityLabel={r.nextPage}
      />

      {limitNotice && (
        <View style={[styles.notice, { backgroundColor: withAlpha(colors.ink, 0.92) }]} pointerEvents="none">
          <ThemedText variant="caption" style={{ color: colors.bg, textAlign: "center" }}>
            {r.annotationLimit}
          </ThemedText>
        </View>
      )}

      <ReaderContentsSheet
        visible={contentsOpen}
        onClose={() => setContentsOpen(false)}
        chapters={chapters}
        currentChapterId={chapterId}
        onSelect={goToChapter}
        pdf
        editionId={edition.id}
        onSelectBookmark={jumpToBookmark}
        contents={contentsQuery.data}
        onSelectSection={(targetChapterId: string, section: BookSectionSummary) => {
          if (!section.startPage) return;
          if (targetChapterId === chapterId) goToPage(section.startPage - 1);
          else goToChapter(targetChapterId, section.startPage);
        }}
        extraTabs={
          pages.length > 0
            ? [
                {
                  id: "pages",
                  label: r.thumbnails,
                  content: (
                    <PageThumbGrid
                      pages={pages}
                      currentIndex={currentIndex}
                      onSelect={(index) => {
                        setContentsOpen(false);
                        goToPage(index);
                      }}
                    />
                  ),
                },
              ]
            : undefined
        }
      />
      <ReaderSettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        mode="pages"
        pagesControls={pagesControls}
      />

      {/* -------- jump to page: number pad + first/last + thumbnail grid -------- */}
      <BottomSheet
        visible={jumpOpen}
        onClose={() => setJumpOpen(false)}
        title={r.jumpToPage}
        showClose
        snapHeight={560}
        footer={<Button title={r.jumpToPage} fullWidth onPress={submitJump} />}
      >
        <TextInput
          style={styles.jumpInput}
          value={jumpText}
          onChangeText={setJumpText}
          keyboardType="number-pad"
          placeholder={`1 – ${pages.length}`}
          placeholderTextColor={theme.colors.textFaint}
          accessibilityLabel={r.jumpToPage}
          onSubmitEditing={submitJump}
        />
        <View style={styles.jumpQuickRow}>
          <Button
            title={r.firstPage}
            icon="play-back-outline"
            variant="outline"
            onPress={() => {
              setJumpOpen(false);
              setJumpText("");
              goToPage(0);
            }}
            style={styles.jumpQuick}
          />
          <Button
            title={r.lastPage}
            trailingIcon="play-forward-outline"
            variant="outline"
            onPress={() => {
              setJumpOpen(false);
              setJumpText("");
              goToPage(pages.length - 1);
            }}
            style={styles.jumpQuick}
          />
        </View>
        <View style={styles.jumpGrid}>
          <PageThumbGrid
            pages={pages}
            currentIndex={currentIndex}
            onSelect={(index) => {
              setJumpOpen(false);
              setJumpText("");
              goToPage(index);
            }}
          />
        </View>
      </BottomSheet>

      {/* The dimmer owns the whole screen — rendered last, above every bar. */}
      <ReaderDim brightness={brightness} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    paddingTop: LIST_TOP_PADDING,
    paddingBottom: 120,
  },
  item: { alignItems: "center" },
  placeholder: { borderRadius: 2 },
  spreadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.layout.screenPadding,
    gap: theme.spacing.lg,
  },
  endControls: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.sm,
    alignSelf: "stretch",
  },
  endButton: { alignSelf: "stretch" },
  finished: { textAlign: "center", paddingVertical: theme.spacing.md },
  notice: {
    position: "absolute",
    left: theme.spacing.xl,
    right: theme.spacing.xl,
    bottom: 96,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    zIndex: 20,
  },
  jumpInput: {
    minHeight: theme.layout.minTouch,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
    fontSize: 16,
    fontFamily: theme.font.regular,
    textAlign: "center",
  },
  jumpQuickRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  jumpQuick: { flex: 1 },
  jumpGrid: { flex: 1 },
});
