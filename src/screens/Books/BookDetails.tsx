import { useCallback, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimatedRef, useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
// Deep subpath, NOT `from "date-fns"`. Metro does not tree-shake, so the root
// barrel pulls all 304 date-fns modules (165 KB minified) plus its locale
// bundles in for this one `format` call. Keep the subpath.
import { format } from "date-fns/format";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { FadeInView } from "@/components/ui/FadeInView";
import { IconButton } from "@/components/ui/IconButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ThemedText } from "@/components/ui/ThemedText";
import { TopBar } from "@/components/layout/TopBar";
import { GlassBarBackground, GlassScrollFeed, GlassTarget, useGlassBar } from "@/components/layout/GlassBar";
import { Chip } from "@/components/common/Chip";
import { KeyboardLiftScrollView } from "@/components/common/KeyboardLiftScrollView";
import { ProgressTrack } from "@/components/common/ProgressTrack";
import { Skeleton } from "@/components/common/Skeleton";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { AuthorPortrait } from "@/components/books/AuthorPortrait";
import { BookCover, bookCorners } from "@/components/books/BookCover";
import { BookRail } from "@/components/books/BookRail";
import { CHAPTER_TEXT_INSET, CHAPTER_THUMB_WIDTH, ChapterRow } from "@/components/books/ChapterRow";
import { ExpandableText } from "@/components/books/ExpandableText";
import { LanguagePanel } from "@/components/books/LanguagePanel";
import { containsMyanmar } from "@/components/books/RichText";
import { useBook, useBooksList, useChapters, useContents, useReadingProgress } from "@/hooks/useBooks";
import { useDockClearance } from "@/hooks/useDockClearance";
import { useLanguage } from "@/localization/LanguageProvider";
import { useReaderPrefsStore } from "@/store/readerPrefsStore";
import { pickEdition } from "@/utils/bookLanguages";
import { clamp } from "@/utils/format";
import { theme, withAlpha } from "@/theme";
import type { SearchStackParamList } from "@/navigation/types";
import type { Book, BookChapterSummary, BookContents, BookEdition, BookSectionSummary } from "@/types/book";

/** One group of the chapter list: the unparted chapters (part null) or a part with its chapters. */
interface ChapterGroup {
  part: BookContents["parts"][number] | null;
  chapters: BookChapterSummary[];
}

type Props = NativeStackScreenProps<SearchStackParamList, "BookDetails">;

/** Books by the same author on the "More by …" shelf. */
const MORE_BY_LIMIT = 12;
/** The 8pt top margin + 44pt control row of the pinned bar, then 12pt of air to the cover. */
const HERO_TOP = theme.spacing.sm + theme.layout.minTouch + 12;
/** The round Start / Continue button straddling the hero's foot. */
const FAB = 72;
/**
 * How far the round CTA hangs below the hero art (its middle on the art's
 * edge, 2pt up). The hero view itself is this much taller than its art, so
 * the WHOLE button lies inside its parent — Android never delivers a touch to
 * the part of a child outside its parent's bounds.
 */
const FAB_DROP = FAB / 2 - 2;

/** Scrims over the hero art (BookDetail.dc.html). */
const TOP_SCRIM = [withAlpha(theme.colors.background, 0.7), withAlpha(theme.colors.background, 0)] as const;
const FOOT_SCRIM = [
  withAlpha(theme.colors.background, 0),
  withAlpha(theme.colors.background, 0.86),
  theme.colors.background,
] as const;

/** 150pt on the 390pt board; narrower phones get a proportionally smaller book. */
function useCoverWidth(): number {
  const { width } = useWindowDimensions();
  return Math.round(Math.min(150, (width - 2 * theme.layout.screenPadding) * 0.42));
}

/**
 * One book, organised around language: choosing an edition re-points the
 * chapter list AND the bookmark, and persists as the cross-book preference.
 *
 * Marquee (BookDetail.dc.html): the cover stands on its own blurred art with
 * the format and counts beside it, the title and a link to the author under
 * it, and a round white Start / Continue button on the hero's foot; then the
 * reading position, categories, summary, languages, chapters, more by the
 * same author, and the comments.
 */
export function BookDetailsScreen({ route, navigation }: Props) {
  const { bookId } = route.params;
  const { t } = useLanguage();
  const r = t.books.reader;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const dockClearance = useDockClearance();
  const coverWidth = useCoverWidth();
  // The glass bar (components/layout/GlassBar): the back button floats over
  // the hero, transparent at the top, frosted once the page scrolls under it
  // — it replaces the solid ground that used to fade in there.
  const glass = useGlassBar();
  const scrollRef = useAnimatedRef<ScrollView>();
  const readingLanguage = useReaderPrefsStore((s) => s.readingLanguage);
  const setReadingLanguage = useReaderPrefsStore((s) => s.setReadingLanguage);

  const bookQuery = useBook(bookId);
  const book = bookQuery.data ?? null;

  const [selectedEditionId, setSelectedEditionId] = useState<string | null>(null);
  const selectedEdition = useMemo(() => {
    if (!book) return null;
    return (
      book.editions.find((edition) => edition.id === selectedEditionId) ??
      pickEdition(book.editions, readingLanguage)
    );
  }, [book, selectedEditionId, readingLanguage]);

  const chaptersQuery = useChapters(bookId, selectedEdition?.id);
  const contentsQuery = useContents(bookId, selectedEdition?.id);
  const progressQuery = useReadingProgress(bookId, selectedEdition?.id);
  const progress = progressQuery.data ?? null;

  // More by the same author — GET /books?authorId, the author page's own query.
  const authorId = book?.authorRef?.id ?? book?.authorId ?? undefined;
  const moreByQuery = useBooksList({ authorId, limit: MORE_BY_LIMIT }, { enabled: !!authorId });
  const moreBy = useMemo(
    () => (moreByQuery.data?.items ?? []).filter((candidate) => candidate.id !== bookId),
    [moreByQuery.data, bookId],
  );

  /** Reading order — what the bookmark's whole-book percentage is measured against. */
  const ordered = useMemo(
    () => [...(chaptersQuery.data ?? [])].sort((a, b) => a.order - b.order),
    [chaptersQuery.data],
  );
  const [reversed, setReversed] = useState(false);
  const chapters = useMemo(() => (reversed ? [...ordered].reverse() : ordered), [ordered, reversed]);
  /**
   * The grouped list, from the numbered contents tree: unparted chapters
   * first, then each part. Null while the tree hasn't loaded (or failed) —
   * the flat list above renders in its place, exactly as before parts existed.
   */
  const groups = useMemo<ChapterGroup[] | null>(() => {
    const contents = contentsQuery.data;
    if (!contents || contents.editionId !== selectedEdition?.id) return null;
    const grouped: ChapterGroup[] = [
      { part: null, chapters: contents.chapters },
      ...contents.parts.map((part) => ({ part, chapters: part.chapters })),
    ];
    if (!reversed) return grouped;
    return grouped.map((group) => ({ ...group, chapters: [...group.chapters].reverse() })).reverse();
  }, [contentsQuery.data, selectedEdition?.id, reversed]);
  const sectionCount = useMemo(
    () => (chaptersQuery.data ?? []).reduce((count, chapter) => count + (chapter.sections?.length ?? 0), 0),
    [chaptersQuery.data],
  );
  const readyChapterCount = useMemo(
    () => (chaptersQuery.data ?? []).filter((chapter) => chapter.status === "READY").length,
    [chaptersQuery.data],
  );

  /** The bookmarked chapter, and how far into it the reader is (the inverse of the saved whole-book %). */
  const bookmark = useMemo(() => {
    if (!progress || progress.progress <= 0 || !progress.chapterId) return null;
    const index = ordered.findIndex((chapter) => chapter.id === progress.chapterId);
    if (index < 0) return { chapter: null, depth: undefined };
    const depth = clamp((progress.progress / 100) * ordered.length - index, 0, 1);
    return { chapter: ordered[index], depth };
  }, [progress, ordered]);
  const firstReady = useMemo(() => ordered.find((chapter) => chapter.status === "READY") ?? null, [ordered]);

  const selectEdition = useCallback(
    (edition: BookEdition) => {
      setSelectedEditionId(edition.id);
      setReadingLanguage(edition.language);
    },
    [setReadingLanguage],
  );

  const openReader = useCallback(
    (chapterId?: string, target: { sectionId?: string; pageNumber?: number } = {}) => {
      if (!selectedEdition) return;
      navigation
        .getParent()
        ?.navigate("BookReader", { bookId, editionId: selectedEdition.id, chapterId, ...target });
    },
    [navigation, bookId, selectedEdition],
  );

  /**
   * One handler for every chapter row. `ChapterRow` is memoized and the list
   * is mapped in flow, so a per-row arrow re-rendered every row in the book on
   * each sort toggle, edition change and settling query.
   */
  const openChapter = useCallback((chapterId: string) => openReader(chapterId), [openReader]);

  /** A section link: written books land on the heading, page books on the start page. */
  const openSection = useCallback(
    (chapter: BookChapterSummary, section: BookSectionSummary) => {
      if (book?.type === "PDF") {
        openReader(chapter.id, section.startPage ? { pageNumber: section.startPage } : {});
      } else {
        openReader(chapter.id, { sectionId: section.id });
      }
    },
    [book?.type, openReader],
  );

  const openAuthor = useCallback(() => {
    if (authorId) navigation.navigate("AuthorDetails", { authorId });
  }, [navigation, authorId]);
  const openBook = useCallback((next: Book) => navigation.push("BookDetails", { bookId: next.id }), [navigation]);

  const back = <TopBar transparent onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />;

  if (bookQuery.isLoading) {
    return (
      <View style={styles.container}>
        <View style={[styles.skeletonHero, { paddingTop: insets.top + HERO_TOP }]}>
          <View style={styles.coverRow}>
            <View style={[bookCorners("lg"), styles.clip, { width: coverWidth, height: (coverWidth * 7) / 5 }]}>
              <Skeleton height={600} radius="xs" />
            </View>
            <View style={styles.facts}>
              <Skeleton width={72} height={12} radius="xs" />
              <Skeleton width={56} height={20} radius="xs" />
              <Skeleton width={72} height={12} radius="xs" style={styles.skeletonGap} />
              <Skeleton width={40} height={20} radius="xs" />
            </View>
          </View>
          <Skeleton width={240} height={34} radius="sm" style={styles.skeletonTitle} />
          <Skeleton width={150} height={16} radius="xs" style={styles.skeletonGap} />
        </View>
        <View style={styles.skeletonBody}>
          <Skeleton height={14} radius="xs" />
          <Skeleton width="92%" height={14} radius="xs" />
          <Skeleton width="60%" height={14} radius="xs" />
          <Skeleton width={160} height={20} radius="xs" style={styles.skeletonSection} />
          {Array.from({ length: 4 }).map((_, index) => (
            <ChapterRowSkeleton key={index} />
          ))}
        </View>
        {back}
      </View>
    );
  }

  if (bookQuery.isError) {
    return (
      <View style={styles.container}>
        <EmptyState
          title={t.books.loadError}
          message={t.common.somethingWentWrong}
          icon="cloud-offline-outline"
          tone={theme.colors.danger}
          actionLabel={t.common.retry}
          onAction={() => bookQuery.refetch()}
        />
        {back}
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.container}>
        <EmptyState title={t.books.notFoundTitle} message={t.books.notFoundBody} icon="book-outline" />
        {back}
      </View>
    );
  }

  const hasBookmark = progress !== null && progress.progress > 0;
  const ctaLabel = hasBookmark ? t.books.continueReading : t.books.startReading;
  const ctaDisabled = !selectedEdition || readyChapterCount === 0;
  const formatLabel = book.type === "EDITOR" ? t.books.formatEditor : t.books.formatPdf;
  const chapterTotal = chaptersQuery.data ? chapters.length : (selectedEdition?.chapterCount ?? 0);
  const chapterCountLabel =
    chapterTotal === 1 ? t.books.chapterCountOne : t.books.chapterCount.replace("{n}", String(chapterTotal));
  const publishedAt = selectedEdition?.publishedAt ?? null;
  const chapterLine = (chapter: BookChapterSummary | null) =>
    chapter ? `${r.chapterLabel.replace("{n}", chapter.number)} · ${chapter.title}` : null;
  const positionLine = hasBookmark ? chapterLine(bookmark?.chapter ?? null) : chapterLine(firstReady);
  const byLine = t.books.byAuthor.replace("{author}", book.author);
  const startCta = () => openReader(progress?.chapterId ?? undefined);

  return (
    <View style={styles.container}>
      <GlassTarget targetRef={glass.blurTarget}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <KeyboardLiftScrollView
            ref={scrollRef}
            // Every frame: the glass bar follows this scroll (GlassScrollFeed).
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: dockClearance }}
            // Without this the first tap on "Post" only dismisses the keyboard.
            keyboardShouldPersistTaps="handled"
          >
            {/* -------- hero: the cover on its own art, facts, title, author, the round CTA -------- */}
            <View style={styles.hero}>
              <View style={styles.heroArt} pointerEvents="none">
                {book.coverUrl ? (
                  <FadeInView style={StyleSheet.absoluteFill}>
                    <Image
                      source={{ uri: book.coverUrl }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      blurRadius={24}
                      cachePolicy="memory-disk"
                    />
                  </FadeInView>
                ) : null}
                <View style={[StyleSheet.absoluteFill, styles.heroWash]} />
                <LinearGradient colors={TOP_SCRIM} style={[styles.topScrim, { height: insets.top + 140 }]} />
                <LinearGradient colors={FOOT_SCRIM} locations={[0, 0.58, 1]} style={styles.footScrim} />
              </View>

              <View style={[styles.heroContent, { paddingTop: insets.top + HERO_TOP }]}>
                <View style={styles.coverRow}>
                  <FadeInView from="bottom" delay={80}>
                    <View style={[styles.coverShadow, bookCorners("lg"), { width: coverWidth }]}>
                      <BookCover title={book.title} coverUrl={book.coverUrl} size="lg" />
                    </View>
                  </FadeInView>
                  <View style={styles.facts}>
                    <Fact label={t.books.format} value={formatLabel} />
                    <Fact label={t.books.chaptersLabel} value={String(chapterTotal)} />
                    {sectionCount > 0 && <Fact label={t.books.sectionsLabel} value={String(sectionCount)} />}
                  </View>
                </View>

                <View style={styles.titleBlock}>
                  <ThemedText variant="display" accessibilityRole="header">
                    {book.title}
                  </ThemedText>
                  {authorId ? (
                    <Pressable
                      onPress={openAuthor}
                      accessibilityRole="link"
                      accessibilityLabel={byLine}
                      style={({ pressed }) => [
                        styles.authorLink,
                        pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
                      ]}
                    >
                      <AuthorPortrait
                        id={authorId}
                        name={book.authorRef?.name ?? book.author}
                        imageUrl={book.authorRef?.imageUrl}
                        size={28}
                      />
                      <ThemedText variant="body" weight="bold" color={theme.colors.textBody} style={styles.authorName}>
                        {byLine}
                      </ThemedText>
                      <Ionicons name="chevron-forward" size={16} color={theme.colors.textBody} />
                    </Pressable>
                  ) : (
                    <View style={styles.authorLink}>
                      <ThemedText variant="body" weight="bold" color={theme.colors.textBody} style={styles.authorName}>
                        {byLine}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>

              <Pressable
                onPress={startCta}
                disabled={ctaDisabled}
                accessibilityRole="button"
                accessibilityLabel={ctaLabel}
                accessibilityState={{ disabled: ctaDisabled }}
                style={({ pressed }) => [
                  styles.fab,
                  ctaDisabled && styles.disabled,
                  pressed && !ctaDisabled && (reduceMotion ? styles.pressedStill : styles.pressed),
                ]}
              >
                <Ionicons name="book-outline" size={30} color={theme.colors.onPlay} />
              </Pressable>
            </View>

            {/* -------- where the reader is -------- */}
            <View style={styles.body}>
              <Pressable
                onPress={startCta}
                disabled={ctaDisabled}
                accessibilityRole="button"
                accessibilityLabel={[ctaLabel, positionLine].filter(Boolean).join(", ")}
                accessibilityState={{ disabled: ctaDisabled }}
                style={({ pressed }) => [ctaDisabled && styles.disabled, pressed && styles.pressedStill]}
              >
                <View style={styles.positionHead}>
                  <View style={styles.positionLabel}>
                    <ThemedText variant="body" weight="extrabold">
                      {ctaLabel}
                    </ThemedText>
                    {!hasBookmark && <Ionicons name="chevron-forward" size={16} color={theme.colors.text} />}
                  </View>
                  {hasBookmark && (
                    <ThemedText variant="caption" weight="bold" tabular>
                      {`${Math.round(progress.progress)}%`}
                    </ThemedText>
                  )}
                </View>
                {hasBookmark && (
                  <ProgressTrack
                    progress={progress.progress / 100}
                    height={4}
                    trackColor={theme.colors.tonalStrong}
                    style={styles.positionTrack}
                  />
                )}
                {positionLine && (
                  <ThemedText variant="caption" numberOfLines={2} style={styles.positionLine}>
                    {positionLine}
                  </ThemedText>
                )}
              </Pressable>

              {/* -------- categories, summary, published -------- */}
              {book.categories.length > 0 && (
                <View style={styles.chipRow}>
                  {book.categories.map((category) => (
                    <Chip key={category.id} label={category.name} />
                  ))}
                </View>
              )}
              {book.description.length > 0 && (
                <View style={styles.summary}>
                  <ExpandableText text={book.description} />
                </View>
              )}
              {publishedAt && (
                <View style={styles.published}>
                  <Ionicons name="calendar-outline" size={16} color={theme.colors.textMuted} />
                  <ThemedText variant="caption" tabular style={styles.publishedText}>
                    {t.books.publishedOn.replace("{date}", format(new Date(publishedAt), "d MMM yyyy"))}
                  </ThemedText>
                </View>
              )}

              {/* -------- languages -------- */}
              <View style={styles.section}>
                <LanguagePanel
                  editions={book.editions}
                  selectedEditionId={selectedEdition?.id}
                  onSelect={selectEdition}
                />
              </View>

              {/* -------- chapters -------- */}
              <View style={styles.section}>
                <SectionHeader
                  title={t.books.chapterList}
                  inset={false}
                  titleLines={2}
                  style={styles.chapterHeader}
                  accessory={
                    <View style={styles.chapterAccessory}>
                      <ThemedText variant="caption" tabular color={theme.colors.textFaint}>
                        {chapterCountLabel}
                      </ThemedText>
                      <IconButton
                        icon="swap-vertical-outline"
                        variant="ghost"
                        size="sm"
                        color={reversed ? theme.colors.link : theme.colors.textMuted}
                        onPress={() => setReversed((value) => !value)}
                        accessibilityLabel={t.books.sortOrder}
                      />
                    </View>
                  }
                />
                {chaptersQuery.isLoading ? (
                  <View>
                    {Array.from({ length: 4 }).map((_, index) => (
                      <ChapterRowSkeleton key={index} />
                    ))}
                  </View>
                ) : chaptersQuery.isError ? (
                  <EmptyState
                    fill={false}
                    message={t.books.loadError}
                    icon="cloud-offline-outline"
                    tone={theme.colors.danger}
                    actionLabel={t.common.retry}
                    onAction={() => chaptersQuery.refetch()}
                  />
                ) : chapters.length === 0 ? (
                  <ThemedText variant="caption" style={styles.noChapters}>
                    {t.books.noChapters}
                  </ThemedText>
                ) : groups ? (
                  groups.map((group) => (
                    <View key={group.part?.id ?? "unparted"}>
                      {group.part && <PartHeader number={group.part.number} title={group.part.title} />}
                      {group.chapters.map((chapter) => (
                        <View key={chapter.id}>
                          <ChapterRow
                            chapter={chapter}
                            isPdf={book.type === "PDF"}
                            bookmarked={progress?.chapterId === chapter.id}
                            progress={progress?.chapterId === chapter.id ? bookmark?.depth : undefined}
                            onPress={openChapter}
                          />
                          {chapter.status === "READY" && (chapter.sections?.length ?? 0) > 0 && (
                            <SectionList
                              chapter={chapter}
                              isPdf={book.type === "PDF"}
                              onPress={(section) => openSection(chapter, section)}
                            />
                          )}
                        </View>
                      ))}
                    </View>
                  ))
                ) : (
                  chapters.map((chapter) => (
                    <ChapterRow
                      key={chapter.id}
                      chapter={chapter}
                      isPdf={book.type === "PDF"}
                      bookmarked={progress?.chapterId === chapter.id}
                      progress={progress?.chapterId === chapter.id ? bookmark?.depth : undefined}
                      onPress={openChapter}
                    />
                  ))
                )}
              </View>
            </View>

            {/* -------- more by the same author -------- */}
            {moreBy.length > 0 && (
              <View style={styles.section}>
                <BookRail
                  title={t.books.moreBy.replace("{author}", book.author)}
                  books={moreBy}
                  onPressBook={openBook}
                  onSeeAll={openAuthor}
                  seeAllLabel={t.common.seeAll}
                />
              </View>
            )}

            {/* -------- comments -------- */}
            <View style={[styles.body, styles.section]}>
              <CommentsSection bookId={bookId} />
            </View>
          </KeyboardLiftScrollView>
          <GlassScrollFeed scrollRef={scrollRef} scrollY={glass.scrollY} />
        </KeyboardAvoidingView>
      </GlassTarget>

      <GlassBarBackground scrollY={glass.scrollY} height={glass.barHeight} blurTarget={glass.blurTarget} />
      <TopBar
        transparent
        touchThrough
        onLayout={glass.onBarLayout}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t.common.back}
      />
    </View>
  );
}

/** FORMAT / CHAPTERS / SECTIONS beside the cover. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <ThemedText variant="overline" color={theme.colors.textMuted}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText variant="section" tabular style={styles.factValue}>
        {value}
      </ThemedText>
    </View>
  );
}

/** Overline above a part's chapters — "Part 1 · Title"; Myanmar text is never letter-spaced. */
function PartHeader({ number, title }: { number: number; title: string }) {
  const { t } = useLanguage();
  const label = `${t.books.partLabel.replace("{n}", String(number))} · ${title}`;
  const myanmar = containsMyanmar(label);
  return (
    <ThemedText
      variant={myanmar ? "caption" : "overline"}
      weight={myanmar ? "bold" : undefined}
      color={theme.colors.textFaint}
      numberOfLines={2}
      style={styles.partHeader}
    >
      {myanmar ? label : label.toUpperCase()}
    </ThemedText>
  );
}

/** The compact section links beneath an openable chapter. */
function SectionList({
  chapter,
  isPdf,
  onPress,
}: {
  chapter: BookChapterSummary;
  isPdf: boolean;
  onPress: (section: BookSectionSummary) => void;
}) {
  const { t } = useLanguage();
  return (
    <View style={styles.sectionRows}>
      {(chapter.sections ?? []).map((section) => {
        const label = `${section.number} ${section.title}`;
        const range =
          isPdf && section.startPage != null && section.endPage != null
            ? t.books.pageRange.replace("{from}", String(section.startPage)).replace("{to}", String(section.endPage))
            : null;
        return (
          <Pressable
            key={section.id}
            onPress={() => onPress(section)}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => [styles.sectionRow, pressed && styles.pressedStill]}
          >
            <ThemedText variant="caption" tabular color={theme.colors.textFaint} style={styles.sectionNumber}>
              {section.number}
            </ThemedText>
            <ThemedText variant="muted" color={theme.colors.textBody} numberOfLines={2} style={styles.sectionTitle}>
              {section.title}
            </ThemedText>
            {range && (
              <ThemedText variant="label" weight="regular" tabular color={theme.colors.textFaint}>
                {range}
              </ThemedText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A loading chapter row — the still and a title line, at the row's own height. */
function ChapterRowSkeleton() {
  return (
    <View style={styles.chapterSkeleton}>
      <Skeleton width={CHAPTER_THUMB_WIDTH} height={58} radius="sm" />
      <Skeleton width={150} height={14} radius="xs" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  /* hero */
  hero: { zIndex: 2, paddingBottom: FAB_DROP },
  heroArt: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: FAB_DROP,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
  },
  heroWash: { backgroundColor: withAlpha(theme.colors.background, 0.4) },
  topScrim: { position: "absolute", left: 0, right: 0, top: 0 },
  footScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 240 },
  heroContent: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: 20 },
  coverRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.lg },
  /** Android casts elevation only from an opaque view — the wrapper carries a fill. */
  coverShadow: { backgroundColor: theme.colors.surface, ...theme.shadow.lg },
  clip: { overflow: "hidden" },
  facts: { flex: 1, gap: 18, paddingTop: 20 },
  factValue: { marginTop: 4 },
  titleBlock: { marginTop: 36, paddingRight: FAB + 2 * theme.layout.screenPadding },
  authorLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: theme.spacing.sm,
    minHeight: theme.layout.minTouch,
    marginTop: theme.spacing.xs,
  },
  authorName: { flexShrink: 1 },
  fab: {
    position: "absolute",
    right: theme.layout.screenPadding,
    bottom: 0,
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.play,
    ...theme.shadow.lg,
  },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.7 },
  /* body */
  body: { paddingHorizontal: theme.layout.screenPadding },
  positionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    // 44pt under the art's edge, as on the board; the hero already holds FAB_DROP of it.
    paddingTop: 44 - FAB_DROP,
  },
  positionLabel: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  positionTrack: { marginTop: 10, width: "auto" },
  positionLine: { marginTop: theme.spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  summary: { marginTop: 20 },
  published: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  publishedText: { flexShrink: 1 },
  section: { marginTop: 36 },
  chapterHeader: { marginBottom: 6 },
  chapterAccessory: { flexDirection: "row", alignItems: "center", gap: 2, marginRight: -10 },
  partHeader: { paddingTop: 16, paddingBottom: 6 },
  sectionRows: { paddingLeft: CHAPTER_TEXT_INSET },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: theme.layout.minTouch,
    paddingVertical: theme.spacing.xs,
  },
  sectionNumber: { minWidth: 28 },
  sectionTitle: { flex: 1 },
  noChapters: { paddingVertical: theme.spacing.md },
  /* skeleton */
  skeletonHero: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: 20,
    backgroundColor: theme.colors.surface,
  },
  skeletonTitle: { marginTop: theme.spacing.xl },
  skeletonGap: { marginTop: theme.spacing.sm },
  skeletonBody: { paddingHorizontal: theme.layout.screenPadding, paddingTop: 44, gap: 12 },
  skeletonSection: { marginTop: 28 },
  chapterSkeleton: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 78 },
});
