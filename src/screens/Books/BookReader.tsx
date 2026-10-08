import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChapterReader } from "@/screens/Books/ChapterReader";
import { PageReader } from "@/screens/Books/PageReader";
import { useReaderFonts } from "@/components/books/readerFonts";
import { READER_THEMES } from "@/components/books/readerThemes";
import { Skeleton } from "@/components/common/Skeleton";
import { useBook, useChapters, useReadingProgress } from "@/hooks/useBooks";
import { useLanguage } from "@/localization/LanguageProvider";
import { useAuthStore } from "@/store/authStore";
import { useReaderAnnotationsStore } from "@/store/readerAnnotationsStore";
import { useReaderPrefsStore } from "@/store/readerPrefsStore";
import { pickEdition } from "@/utils/bookLanguages";
import { theme, withAlpha } from "@/theme";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "BookReader">;

/**
 * The full-screen reading surface (registered like Player). Route params are
 * HINTS, validated against the loaded book: a stale edition or chapter id
 * falls through to the preferred language → the bookmark → the first READY
 * chapter — never a 404, and never chapter 1 before the bookmark has loaded.
 */
export function BookReaderScreen({ route, navigation }: Props) {
  const { bookId, editionId, chapterId, sectionId, pageNumber } = route.params;
  const { t } = useLanguage();
  const readingLanguage = useReaderPrefsStore((s) => s.readingLanguage);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const loadAnnotations = useReaderAnnotationsStore((s) => s.loadAnnotations);

  // Per-user prefs are already hydrated for the current user before any book
  // screen can mount — RootNavigator owns that now, because BookDetails reads
  // and writes readingLanguage too and this screen was arming storage too late.

  // The open book's client-side bookmarks/highlights (AsyncStorage-backed).
  useEffect(() => {
    void loadAnnotations(userId, bookId);
  }, [loadAnnotations, userId, bookId]);

  // Lazy-load the reader font packs here (NOT App.tsx — cold start unchanged).
  // Non-blocking: RichText keeps the always-loaded sans faces until true.
  useReaderFonts();

  const bookQuery = useBook(bookId);
  const book = bookQuery.data ?? null;

  const edition = useMemo(() => {
    if (!book) return null;
    return book.editions.find((candidate) => candidate.id === editionId) ?? pickEdition(book.editions, readingLanguage);
  }, [book, editionId, readingLanguage]);

  const chaptersQuery = useChapters(bookId, edition?.id);
  const progressQuery = useReadingProgress(bookId, edition?.id);

  const chapters = useMemo(
    () => [...(chaptersQuery.data ?? [])].sort((a, b) => a.order - b.order),
    [chaptersQuery.data],
  );

  // WAIT for the bookmark to settle before choosing the opening chapter — a
  // signed-in reader must never be defaulted to chapter 1 prematurely.
  const progressSettled = progressQuery.isSuccess || progressQuery.isError;

  const initialChapterId = useMemo(() => {
    if (!edition || !chaptersQuery.isSuccess || !progressSettled) return null;
    const exists = (id: string | null | undefined) => !!id && chapters.some((chapter) => chapter.id === id);
    if (exists(chapterId)) return chapterId as string;
    const bookmark = progressQuery.data;
    if (bookmark && bookmark.editionId === edition.id && exists(bookmark.chapterId)) {
      return bookmark.chapterId as string;
    }
    return chapters.find((chapter) => chapter.status === "READY")?.id ?? null;
  }, [edition, chaptersQuery.isSuccess, progressSettled, chapters, chapterId, progressQuery.data]);

  // Param page number outranks the bookmark; the bookmark's page applies only
  // when its chapter is the one actually opening.
  const initialPageNumber = useMemo(() => {
    if (!initialChapterId) return undefined;
    if (pageNumber && chapterId === initialChapterId) return pageNumber;
    const bookmark = progressQuery.data;
    if (bookmark && bookmark.chapterId === initialChapterId && bookmark.pageNumber) return bookmark.pageNumber;
    return undefined;
  }, [initialChapterId, pageNumber, chapterId, progressQuery.data]);

  // A section hint only counts when it belongs to the chapter actually opening.
  const initialSectionId = useMemo(() => {
    if (!sectionId || !initialChapterId || chapterId !== initialChapterId) return undefined;
    const chapter = chapters.find((candidate) => candidate.id === initialChapterId);
    return chapter?.sections?.some((section) => section.id === sectionId) ? sectionId : undefined;
  }, [sectionId, initialChapterId, chapterId, chapters]);

  /**
   * "Continue reading" lands where the reader stopped INSIDE the chapter, not
   * at its top (audit H-31). The save stores a whole-book percentage —
   * (chapter index + depth) / chapter count × 100, the same formula on web and
   * mobile — so the chapter-local depth is recovered by inverting it. Only when
   * the bookmark's chapter is the one opening (whether the route named it, as
   * BookDetails' Continue button does, or the bookmark chose it), and never
   * over a section link. Near the very top or bottom there is nothing to
   * restore.
   */
  const initialDepth = useMemo(() => {
    if (!edition || !initialChapterId || initialSectionId) return undefined;
    const bookmark = progressQuery.data;
    if (!bookmark || bookmark.editionId !== edition.id || bookmark.chapterId !== initialChapterId) return undefined;
    const index = chapters.findIndex((chapter) => chapter.id === initialChapterId);
    if (index < 0 || chapters.length === 0) return undefined;
    const depth = Math.min(1, Math.max(0, (bookmark.progress / 100) * chapters.length - index));
    return depth > 0.01 && depth < 0.99 ? depth : undefined;
  }, [edition, initialChapterId, initialSectionId, progressQuery.data, chapters]);

  const close = () => navigation.goBack();

  if (bookQuery.isError || chaptersQuery.isError) {
    return (
      <View style={styles.center}>
        <EmptyState
          fill={false}
          message={t.books.reader.loadError}
          icon="cloud-offline-outline"
          tone={theme.colors.danger}
          actionLabel={t.common.retry}
          onAction={() => (bookQuery.isError ? bookQuery.refetch() : chaptersQuery.refetch())}
        />
        <Button title={t.common.close} variant="ghost" onPress={close} />
      </View>
    );
  }

  if (bookQuery.isSuccess && book === null) {
    return (
      <View style={styles.center}>
        <EmptyState fill={false} title={t.books.notFoundTitle} message={t.books.notFoundBody} icon="book-outline" />
        <Button title={t.common.close} variant="ghost" onPress={close} />
      </View>
    );
  }

  if (!book || !edition || !chaptersQuery.isSuccess || !progressSettled) {
    // Marquee: loading is a skeleton, never a spinner — a page being set, in
    // the reader's own page colour so the reader does not flash in after it.
    return <ReaderOpeningSkeleton label={t.common.loading} />;
  }

  if (chapters.length === 0 || !initialChapterId) {
    return (
      <View style={styles.center}>
        <EmptyState fill={false} message={t.books.reader.emptyBook} icon="book-outline" />
        <Button title={t.common.close} variant="ghost" onPress={close} />
      </View>
    );
  }

  // key={edition.id} — a different language is a different book: chapters,
  // bookmark and local reading state all restart.
  return book.type === "EDITOR" ? (
    <ChapterReader
      key={edition.id}
      book={book}
      edition={edition}
      chapters={chapters}
      initialChapterId={initialChapterId}
      initialSectionId={initialSectionId}
      initialDepth={initialDepth}
      onClose={close}
    />
  ) : (
    <PageReader
      key={edition.id}
      book={book}
      edition={edition}
      chapters={chapters}
      initialChapterId={initialChapterId}
      initialPageNumber={initialPageNumber}
      onClose={close}
    />
  );
}

/** The opening of a chapter, still being set: overline, title, then lines of text. */
function ReaderOpeningSkeleton({ label }: { label: string }) {
  const insets = useSafeAreaInsets();
  const readerTheme = useReaderPrefsStore((s) => s.readerTheme);
  const colors = READER_THEMES[readerTheme];
  const ink = { backgroundColor: withAlpha(colors.ink, 0.1) };
  return (
    <View
      style={[styles.page, { backgroundColor: colors.bg, paddingTop: insets.top + 96 }]}
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <View style={styles.opening}>
        <Skeleton width={80} height={11} radius="xs" style={ink} />
        <Skeleton width={200} height={26} radius="sm" style={ink} />
        <Skeleton width={56} height={12} radius="xs" style={ink} />
      </View>
      <View style={styles.lines}>
        {Array.from({ length: 9 }).map((_, index) => (
          <Skeleton key={index} height={14} radius="xs" width={index % 4 === 3 ? "62%" : "100%"} style={ink} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 20 },
  opening: { alignItems: "center", gap: theme.spacing.sm },
  lines: { gap: theme.spacing.md, marginTop: 34 },
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.md,
    padding: theme.layout.screenPadding,
  },
});
