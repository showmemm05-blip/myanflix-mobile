import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useReducedMotion } from "react-native-reanimated";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ThemedText } from "@/components/ui/ThemedText";
import { ReaderTopBar } from "@/components/books/ReaderTopBar";
import { ReaderFooter } from "@/components/books/ReaderFooter";
import { ReaderContentsSheet } from "@/components/books/ReaderContentsSheet";
import { ReaderSettingsSheet } from "@/components/books/ReaderSettingsSheet";
import { ReaderSearchSheet, type ReaderSearchResult } from "@/components/books/ReaderSearchSheet";
import { BlockActionsSheet } from "@/components/books/BlockActionsSheet";
import { ReaderDim } from "@/components/books/ReaderDim";
import { ReaderKeepAwake } from "@/components/books/ReaderKeepAwake";
import { RichText, containsMyanmar, pmPlainBlocks } from "@/components/books/RichText";
import { HIGHLIGHT_COLORS, READER_THEMES, highlightAlpha } from "@/components/books/readerThemes";
import { useReaderFonts } from "@/components/books/readerFonts";
import { Skeleton } from "@/components/common/Skeleton";
import { useChapter, useContents } from "@/hooks/useBooks";
import { useReadingProgressSaver, type ReadingPosition } from "@/hooks/useReadingProgressSaver";
import { useLanguage } from "@/localization/LanguageProvider";
import {
  useReaderAnnotationsStore,
  type ReaderBookmark,
  type ReaderHighlight,
} from "@/store/readerAnnotationsStore";
import {
  READER_LINE_HEIGHTS,
  READER_MAX_WIDTH,
  READER_PADDING_H,
  useReaderPrefsStore,
} from "@/store/readerPrefsStore";
import { composeChapterDoc, sectionIdAtDepth } from "@/utils/chapterSections";
import { estimateReadingMinutesForBlocks } from "@/utils/readingTime";
import { theme, withAlpha } from "@/theme";
import type { BookChapterSummary, BookDetail, BookEdition, BookSectionSummary } from "@/types/book";

interface Props {
  book: BookDetail;
  edition: BookEdition;
  /** Sorted by `order`. */
  chapters: BookChapterSummary[];
  initialChapterId: string;
  /** A section of the initial chapter to land on (validated by BookReader). */
  initialSectionId?: string;
  onClose: () => void;
}

/** How long the bars stay up before fading into the page. */
const CHROME_HIDE_MS = 2500;
/** A bookmark "matches" the current position within this scroll-depth window. */
const BOOKMARK_PCT_WINDOW = 0.02;
/** How long a jumped-to block keeps its tint (solid — no pulse, RM-safe). */
const FLASH_MS = 2000;

/**
 * The written-book reader — ProseMirror chapters set like print on the
 * reader's chosen page colour. Chapter switching is local state; the route
 * never re-pushes.
 */
export function ChapterReader({ book, edition, chapters, initialChapterId, initialSectionId, onClose }: Props) {
  const { t } = useLanguage();
  const r = t.books.reader;
  const { height: viewportHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  /* -------- settings -------- */
  const readerTheme = useReaderPrefsStore((s) => s.readerTheme);
  const textScale = useReaderPrefsStore((s) => s.textScale);
  const fontFamily = useReaderPrefsStore((s) => s.fontFamily);
  const lineHeight = useReaderPrefsStore((s) => s.lineHeight);
  const width = useReaderPrefsStore((s) => s.width);
  const margins = useReaderPrefsStore((s) => s.margins);
  const textAlign = useReaderPrefsStore((s) => s.textAlign);
  const showChapterTitle = useReaderPrefsStore((s) => s.showChapterTitle);
  const brightness = useReaderPrefsStore((s) => s.brightness);
  const keepAwake = useReaderPrefsStore((s) => s.keepAwake);
  const autoHideChrome = useReaderPrefsStore((s) => s.autoHideChrome);
  const fullscreen = useReaderPrefsStore((s) => s.fullscreen);
  const textSelection = useReaderPrefsStore((s) => s.textSelection);
  const colors = READER_THEMES[readerTheme];
  // Until the lazy packs land, keep rendering the always-loaded sans faces.
  const readerFontsLoaded = useReaderFonts();
  const activeFontFamily = readerFontsLoaded ? fontFamily : "sans";

  const [chapterId, setChapterId] = useState(initialChapterId);
  const chapterIndex = Math.max(
    0,
    chapters.findIndex((chapter) => chapter.id === chapterId),
  );
  const chapter = chapters[chapterIndex];
  const chapterQuery = useChapter(book.id, edition.id, chapterId);
  const contentsQuery = useContents(book.id, edition.id);
  // ONE composed document: chapter blocks, then each section under its
  // heading. With no sections this IS chapter.content (identity), so every
  // existing book keeps its block indices, highlights and minutes unchanged.
  const composed = useMemo(
    () =>
      composeChapterDoc({
        content: chapterQuery.data?.content ?? null,
        sections: chapterQuery.data?.sections ?? [],
      }),
    [chapterQuery.data],
  );
  const content = composed.doc;

  const saver = useReadingProgressSaver(book.id, edition.id);
  const lastPositionRef = useRef<ReadingPosition | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  /* -------- chrome visibility -------- */
  const [chromeVisible, setChromeVisible] = useState(true);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    // Auto-hide off (or OS reduce-motion): the idle timer NEVER arms — the
    // bars toggle only by an explicit tap.
    if (!autoHideChrome || reduceMotion) return;
    hideTimerRef.current = setTimeout(() => setChromeVisible(false), CHROME_HIDE_MS);
  }, [autoHideChrome, reduceMotion]);
  useEffect(() => {
    armHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [armHideTimer]);

  const toggleChrome = useCallback(() => {
    setChromeVisible((visible) => {
      if (!visible) armHideTimer();
      return !visible;
    });
  }, [armHideTimer]);

  /* -------- annotations -------- */
  const bookmarks = useReaderAnnotationsStore((s) => s.bookmarks);
  const highlights = useReaderAnnotationsStore((s) => s.highlights);
  const addBookmark = useReaderAnnotationsStore((s) => s.addBookmark);
  const removeBookmark = useReaderAnnotationsStore((s) => s.removeBookmark);

  /** Long-press target; the sheet keeps its last target while closing. */
  const [blockTarget, setBlockTarget] = useState<{ blockIndex: number; text: string } | null>(null);
  const [blockSheetOpen, setBlockSheetOpen] = useState(false);

  /** Search-jump / note-jump tint, painted through the highlight map. */
  const [flashBlock, setFlashBlock] = useState<number | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashBlockAt = useCallback((blockIndex: number) => {
    setFlashBlock(blockIndex);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    // One-shot cleanup; the tint is solid (no pulse), so RM needs no branch.
    flashTimerRef.current = setTimeout(() => setFlashBlock(null), FLASH_MS);
  }, []);
  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  const barsVisible =
    chromeVisible || contentsOpen || settingsOpen || searchOpen || blockSheetOpen;

  /* -------- progress -------- */
  /** Plain text per top-level block of the composed doc — the jump/search/bookmark index space. */
  const blockTexts = useMemo(() => (content ? pmPlainBlocks(content) : []), [content]);
  /** Chapter-local scroll depth 0–1 (int-% state drives the bar and the bookmark toggle). */
  const depthRef = useRef(0);
  const [chapterPercent, setChapterPercent] = useState(0);
  const contentHeightRef = useRef(0);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      // Never measure the skeleton — only real content taller than half a screen counts.
      if (!chapterQuery.isSuccess || contentSize.height < layoutMeasurement.height * 0.5) return;
      const depth = Math.max(
        0,
        Math.min(1, (contentOffset.y + layoutMeasurement.height) / contentSize.height),
      );
      depthRef.current = depth;
      setChapterPercent(Math.round(depth * 100));
      const progress = Math.max(0, Math.min(100, ((chapterIndex + depth) / chapters.length) * 100));
      // The key is OMITTED (not null) when unknown, so section-less books PATCH the identical body.
      const sectionId = sectionIdAtDepth(composed.anchors, depth, blockTexts.length);
      const position: ReadingPosition = { chapterId, progress, ...(sectionId ? { sectionId } : {}) };
      lastPositionRef.current = position;
      saver.save(position);
    },
    [chapterQuery.isSuccess, chapterIndex, chapters.length, chapterId, saver, composed.anchors, blockTexts.length],
  );

  const goToChapter = useCallback(
    (nextChapterId: string) => {
      saver.forceSave(lastPositionRef.current ?? undefined);
      // The turn itself is a position — see PageReader.goToChapter.
      const nextIndex = chapters.findIndex((c) => c.id === nextChapterId);
      const entryPosition: ReadingPosition = {
        chapterId: nextChapterId,
        progress: Math.max(
          0,
          Math.min(100, (Math.max(nextIndex, 0) / Math.max(chapters.length, 1)) * 100),
        ),
      };
      lastPositionRef.current = entryPosition;
      saver.save(entryPosition);
      setChapterId(nextChapterId);
      depthRef.current = 0;
      setChapterPercent(0);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      setChromeVisible(true);
      armHideTimer();
    },
    [saver, chapters, armHideTimer],
  );

  /* -------- jumps (bookmarks / notes / search / sections) -------- */
  const performJump = useCallback(
    (target: { pct?: number; blockIndex?: number; sectionId?: string; flash?: boolean }) => {
      const contentHeight = contentHeightRef.current;
      if (contentHeight <= 0) return;
      // A section jump resolves to its heading's block index AT JUMP TIME, so a
      // cross-chapter section jump waits for the content like block jumps do.
      const blockIndex =
        target.blockIndex ??
        (target.sectionId
          ? composed.anchors.find((anchor) => anchor.sectionId === target.sectionId)?.blockIndex
          : undefined);
      let y = 0;
      if (blockIndex != null) {
        // Approximate — blocks aren't uniform, but this lands within a screen.
        const count = Math.max(1, blockTexts.length);
        y = (blockIndex / count) * contentHeight - viewportHeight * 0.25;
      } else if (target.pct != null) {
        // Inverse of the depth formula: depth = (offset + viewport) / contentHeight.
        y = target.pct * contentHeight - viewportHeight;
      }
      scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: !reduceMotion });
      if (target.flash && blockIndex != null) flashBlockAt(blockIndex);
    },
    [blockTexts.length, composed.anchors, viewportHeight, reduceMotion, flashBlockAt],
  );

  /**
   * A jump into a not-yet-rendered chapter waits for its content to size.
   * Seeded with the route's section hint so opening a link lands on it.
   */
  const pendingJumpRef = useRef<
    { chapterId: string; pct?: number; blockIndex?: number; sectionId?: string; flash?: boolean } | null
  >(initialSectionId ? { chapterId: initialChapterId, sectionId: initialSectionId, flash: true } : null);

  const jumpTo = useCallback(
    (target: { chapterId: string; pct?: number; blockIndex?: number; sectionId?: string; flash?: boolean }) => {
      if (!chapters.some((candidate) => candidate.id === target.chapterId)) return;
      if (
        target.chapterId === chapterId &&
        chapterQuery.isSuccess &&
        contentHeightRef.current > viewportHeight * 0.5
      ) {
        performJump(target);
        return;
      }
      pendingJumpRef.current = target;
      if (target.chapterId !== chapterId) goToChapter(target.chapterId);
    },
    [chapters, chapterId, chapterQuery.isSuccess, viewportHeight, performJump, goToChapter],
  );

  const handleContentSize = useCallback(
    (_width: number, height: number) => {
      contentHeightRef.current = height;
      const pending = pendingJumpRef.current;
      if (
        pending &&
        pending.chapterId === chapterId &&
        chapterQuery.isSuccess &&
        height > viewportHeight * 0.5
      ) {
        pendingJumpRef.current = null;
        performJump(pending);
      }
    },
    [chapterId, chapterQuery.isSuccess, viewportHeight, performJump],
  );

  /* -------- bookmark toggle -------- */
  const currentBookmark = useMemo(
    () =>
      bookmarks.find(
        (row) =>
          row.editionId === edition.id &&
          row.chapterId === chapterId &&
          row.pageNumber == null &&
          Math.abs((row.pct ?? 0) - chapterPercent / 100) < BOOKMARK_PCT_WINDOW,
      ),
    [bookmarks, edition.id, chapterId, chapterPercent],
  );

  const toggleBookmark = useCallback(() => {
    if (currentBookmark) {
      removeBookmark(currentBookmark.id);
      return;
    }
    const depth = depthRef.current;
    const blockIndex = Math.min(
      Math.max(blockTexts.length - 1, 0),
      Math.floor(depth * blockTexts.length),
    );
    const excerpt = blockTexts[blockIndex]?.slice(0, 120) || chapter?.title;
    const ok = addBookmark({ editionId: edition.id, chapterId, pct: depth, excerpt });
    if (!ok) Alert.alert(r.annotationLimit); // At cap: refuse loudly, never evict.
  }, [currentBookmark, removeBookmark, blockTexts, chapter?.title, addBookmark, edition.id, chapterId, r.annotationLimit]);

  /* -------- highlights painted onto blocks -------- */
  const highlightMap = useMemo(() => {
    const map: Record<number, string> = {};
    const alpha = highlightAlpha(readerTheme);
    for (const row of highlights) {
      if (row.editionId === edition.id && row.chapterId === chapterId) {
        map[row.blockIndex] = withAlpha(HIGHLIGHT_COLORS[row.color], alpha);
      }
    }
    if (flashBlock != null) map[flashBlock] = withAlpha(theme.colors.primary, 0.28);
    return map;
  }, [highlights, edition.id, chapterId, readerTheme, flashBlock]);

  const openBlockActions = useCallback((blockIndex: number, text: string) => {
    setBlockTarget({ blockIndex, text });
    setBlockSheetOpen(true);
  }, []);

  /* -------- est. reading time (memoized per chapter, cache-fed) -------- */
  const minutesCacheRef = useRef(new Map<string, number>());
  const chapterMinutes = useMemo(() => {
    if (!content) return null;
    const cached = minutesCacheRef.current.get(chapterId);
    if (cached != null) return cached;
    const minutes = estimateReadingMinutesForBlocks(blockTexts);
    minutesCacheRef.current.set(chapterId, minutes);
    return minutes;
  }, [content, chapterId, blockTexts]);

  const previousChapter = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
  const nextChapter = chapterIndex < chapters.length - 1 ? chapters[chapterIndex + 1] : null;

  const overlineText = r.chapterLabel.replace("{n}", String(chapter?.order ?? chapterIndex + 1));
  const footerLabel = r.chapterPercent
    .replace("{c}", String(chapterIndex + 1))
    .replace("{t}", String(chapters.length))
    .replace("{p}", String(chapterPercent));
  const isEmptyDoc =
    chapterQuery.isSuccess &&
    (content === null || !Array.isArray((content as { content?: unknown }).content) ||
      ((content as { content?: unknown[] }).content ?? []).length === 0);

  const columnMaxWidth = READER_MAX_WIDTH[width];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Immersive mode is expo-status-bar only — nav-bar hiding is native, parked. */}
      <StatusBar style={colors.barStyle} hidden={fullscreen} />
      <ReaderKeepAwake enabled={keepAwake} />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { minHeight: viewportHeight }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSize}
        scrollEventThrottle={48}
      >
        <Pressable
          onPress={toggleChrome}
          accessible={false}
          style={[
            styles.column,
            {
              maxWidth: columnMaxWidth ?? ("100%" as const),
              paddingHorizontal: READER_PADDING_H[margins],
            },
          ]}
        >
          {/* -------- chapter opening, set like print -------- */}
          {showChapterTitle && (
            <View style={styles.opening}>
              <ThemedText
                variant="overline"
                style={[
                  styles.overline,
                  { color: colors.muted },
                  // Tracking widens Latin overlines; Myanmar text must never be letter-spaced.
                  containsMyanmar(overlineText) && styles.noTracking,
                ]}
              >
                {overlineText}
              </ThemedText>
              <ThemedText variant="title" style={[styles.chapterTitle, { color: colors.ink }]}>
                {chapter?.title ?? ""}
              </ThemedText>
              {chapterMinutes != null && chapterMinutes > 0 && (
                <ThemedText variant="caption" tabular style={{ color: colors.muted }}>
                  {r.estMinutes.replace("{n}", String(chapterMinutes))}
                </ThemedText>
              )}
              <ThemedText variant="body" style={[styles.ornament, { color: colors.muted }]}>
                ❦
              </ThemedText>
            </View>
          )}

          {/* -------- body -------- */}
          {chapterQuery.isLoading ? (
            <View style={styles.skeletons}>
              {Array.from({ length: 9 }).map((_, index) => (
                <Skeleton key={index} height={14} radius="sm" width={index % 4 === 3 ? "62%" : "100%"} />
              ))}
            </View>
          ) : chapterQuery.isError ? (
            <EmptyState
              fill={false}
              message={r.loadError}
              icon="cloud-offline-outline"
              tone={theme.colors.danger}
              actionLabel={t.common.retry}
              onAction={() => chapterQuery.refetch()}
            />
          ) : isEmptyDoc ? (
            <ThemedText variant="body" style={[styles.emptyChapter, { color: colors.muted }]}>
              {r.emptyChapter}
            </ThemedText>
          ) : (
            <RichText
              content={content as Record<string, unknown>}
              textScale={textScale}
              colors={colors}
              fontFamily={activeFontFamily}
              lineHeight={READER_LINE_HEIGHTS[lineHeight]}
              textAlign={textAlign}
              selectable={textSelection}
              highlights={highlightMap}
              // Native selection and long-press highlighting conflict — one at a time.
              onLongPressBlock={textSelection ? undefined : openBlockActions}
              onPressBlock={toggleChrome}
            />
          )}

          {/* -------- end-of-chapter controls, in flow -------- */}
          {!chapterQuery.isLoading && (
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
          )}
        </Pressable>
      </ScrollView>

      <ReaderTopBar
        visible={barsVisible}
        colors={colors}
        title={book.title}
        onContents={() => setContentsOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onClose={onClose}
        onSearch={() => setSearchOpen(true)}
        onBookmark={toggleBookmark}
        bookmarked={!!currentBookmark}
      />
      <ReaderFooter visible={barsVisible} colors={colors} label={footerLabel} />

      <ReaderContentsSheet
        visible={contentsOpen}
        onClose={() => setContentsOpen(false)}
        chapters={chapters}
        chapterMinutes={minutesCacheRef.current}
        currentChapterId={chapterId}
        onSelect={goToChapter}
        editionId={edition.id}
        onSelectBookmark={(bookmark: ReaderBookmark) =>
          jumpTo({ chapterId: bookmark.chapterId, pct: bookmark.pct ?? 0 })
        }
        onSelectHighlight={(highlight: ReaderHighlight) =>
          jumpTo({ chapterId: highlight.chapterId, blockIndex: highlight.blockIndex, flash: true })
        }
        contents={contentsQuery.data}
        onSelectSection={(targetChapterId: string, section: BookSectionSummary) =>
          jumpTo({ chapterId: targetChapterId, sectionId: section.id, flash: true })
        }
      />
      <ReaderSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} mode="text" />
      <ReaderSearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        bookId={book.id}
        editionId={edition.id}
        chapters={chapters}
        onSelectResult={(result: ReaderSearchResult) =>
          jumpTo({ chapterId: result.chapterId, blockIndex: result.blockIndex, flash: true })
        }
      />
      {blockTarget && (
        <BlockActionsSheet
          visible={blockSheetOpen}
          onClose={() => setBlockSheetOpen(false)}
          editionId={edition.id}
          chapterId={chapterId}
          blockIndex={blockTarget.blockIndex}
          blockText={blockTarget.text}
        />
      )}

      {/* The dimmer renders LAST — above the bars, like a hardware dimmer. */}
      <ReaderDim brightness={brightness} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: 96,
    paddingBottom: 120,
  },
  column: {
    width: "100%",
    alignSelf: "center",
  },
  opening: { alignItems: "center", gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
  overline: { letterSpacing: 1.4, textAlign: "center" },
  noTracking: { letterSpacing: 0 },
  chapterTitle: { textAlign: "center" },
  ornament: { marginTop: theme.spacing.xs },
  skeletons: { gap: theme.spacing.md, paddingVertical: theme.spacing.md },
  emptyChapter: { textAlign: "center", paddingVertical: theme.spacing.xl },
  endControls: { marginTop: theme.spacing.xxl, gap: theme.spacing.sm, alignItems: "stretch" },
  endButton: { alignSelf: "stretch" },
  finished: { textAlign: "center", paddingVertical: theme.spacing.md },
});
