import { useCallback, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Pill } from "@/components/ui/Pill";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ThemedText } from "@/components/ui/ThemedText";
import { TopBar } from "@/components/layout/TopBar";
import { ChapterRow } from "@/components/books/ChapterRow";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { LanguagePanel } from "@/components/books/LanguagePanel";
import { containsMyanmar } from "@/components/books/RichText";
import { ProgressTrack } from "@/components/common/ProgressTrack";
import { Skeleton } from "@/components/common/Skeleton";
import { Surface } from "@/components/ui/Surface";
import { useBook, useChapters, useContents, useReadingProgress } from "@/hooks/useBooks";
import { useLanguage } from "@/localization/LanguageProvider";
import { useReaderPrefsStore } from "@/store/readerPrefsStore";
import { languageLabel, pickEdition } from "@/utils/bookLanguages";
import { theme, withAlpha } from "@/theme";
import type { SearchStackParamList } from "@/navigation/types";
import type { BookChapterSummary, BookContents, BookEdition, BookSectionSummary } from "@/types/book";

/** One group of the chapter list: the unparted chapters (part null) or a part with its chapters. */
interface ChapterGroup {
  part: BookContents["parts"][number] | null;
  chapters: BookChapterSummary[];
}

type Props = NativeStackScreenProps<SearchStackParamList, "BookDetails">;

/**
 * One book, organised around language: choosing an edition re-points the
 * chapter list AND the bookmark, and persists as the cross-book preference.
 */
export function BookDetailsScreen({ route, navigation }: Props) {
  const { bookId } = route.params;
  const { t } = useLanguage();
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

  const [reversed, setReversed] = useState(false);
  const chapters = useMemo(() => {
    const sorted = [...(chaptersQuery.data ?? [])].sort((a, b) => a.order - b.order);
    return reversed ? sorted.reverse() : sorted;
  }, [chaptersQuery.data, reversed]);
  /**
   * The grouped list, from the numbered contents tree: unparted chapters
   * first, then each part. Null while the tree hasn't loaded (or failed) —
   * the flat list above renders in its place, exactly as before parts existed.
   */
  const groups = useMemo<ChapterGroup[] | null>(() => {
    const contents = contentsQuery.data;
    if (!contents || contents.editionId !== selectedEdition?.id) return null;
    const ordered: ChapterGroup[] = [
      { part: null, chapters: contents.chapters },
      ...contents.parts.map((part) => ({ part, chapters: part.chapters })),
    ];
    if (!reversed) return ordered;
    return ordered.map((group) => ({ ...group, chapters: [...group.chapters].reverse() })).reverse();
  }, [contentsQuery.data, selectedEdition?.id, reversed]);
  const sectionCount = useMemo(
    () => (chaptersQuery.data ?? []).reduce((count, chapter) => count + (chapter.sections?.length ?? 0), 0),
    [chaptersQuery.data],
  );
  const readyChapterCount = useMemo(
    () => (chaptersQuery.data ?? []).filter((chapter) => chapter.status === "READY").length,
    [chaptersQuery.data],
  );

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

  if (bookQuery.isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.skeletonBand}>
          <Skeleton width={150} height={210} radius="lg" />
          <View style={styles.skeletonLines}>
            <Skeleton width="80%" height={22} radius="sm" />
            <Skeleton width="50%" height={14} radius="sm" />
            <Skeleton width="40%" height={14} radius="sm" />
          </View>
        </View>
        <TopBar transparent onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />
      </View>
    );
  }

  if (bookQuery.isError) {
    return (
      <View style={styles.container}>
        <EmptyState
          message={t.books.loadError}
          icon="cloud-offline-outline"
          tone={theme.colors.danger}
          actionLabel={t.common.retry}
          onAction={() => bookQuery.refetch()}
        />
        <TopBar transparent onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.container}>
        <EmptyState title={t.books.notFoundTitle} message={t.books.notFoundBody} icon="book-outline" />
        <TopBar transparent onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />
      </View>
    );
  }

  const hasBookmark = progress !== null && progress.progress > 0;
  const ctaLabel = hasBookmark ? t.books.continueReading : t.books.startReading;
  const formatLabel = book.type === "EDITOR" ? t.books.formatEditor : t.books.formatPdf;
  const chapterCountLabel =
    chapters.length === 1 ? t.books.chapterCountOne : t.books.chapterCount.replace("{n}", String(chapters.length));
  const publishedAt = selectedEdition?.publishedAt ?? null;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* -------- title band -------- */}
          <View style={styles.band}>
            {book.coverUrl && (
              <Image
                source={{ uri: book.coverUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                blurRadius={20}
              />
            )}
            <View style={[StyleSheet.absoluteFill, styles.bandWash]} />
            <LinearGradient
              colors={["transparent", theme.colors.background]}
              style={styles.bandFade}
              pointerEvents="none"
            />
            <View style={styles.bandContent}>
              <View style={styles.coverTile}>
                {book.coverUrl ? (
                  <Image source={{ uri: book.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                ) : (
                  <View style={styles.coverFallback}>
                    <Ionicons name="book-outline" size={30} color={theme.colors.textFaint} />
                  </View>
                )}
              </View>
              <ThemedText variant="display" numberOfLines={3} style={styles.title}>
                {book.title}
              </ThemedText>
              <ThemedText variant="muted" numberOfLines={1}>
                {t.books.byAuthor.replace("{author}", book.author)}
              </ThemedText>
              <View style={styles.chipRow}>
                <Pill tone="info">{formatLabel}</Pill>
                {book.categories.map((category) => (
                  <Pill key={category.id} tone="neutral">
                    {category.name}
                  </Pill>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.spine}>
            {/* -------- summary -------- */}
            {book.description.length > 0 && (
              <View style={styles.summary}>
                <ThemedText variant="overline">{t.books.summary.toUpperCase()}</ThemedText>
                <ThemedText variant="body" color={theme.colors.textMuted}>
                  {book.description}
                </ThemedText>
              </View>
            )}

            {/* -------- CTA -------- */}
            <View style={styles.ctaBlock}>
              <Button
                title={ctaLabel}
                icon="book-outline"
                size="lg"
                onPress={() => openReader(progress?.chapterId ?? undefined)}
                disabled={!selectedEdition || readyChapterCount === 0}
              />
              {selectedEdition && book.editions.length > 1 && (
                <ThemedText variant="caption" style={styles.readingIn}>
                  {t.books.readingIn.replace("{language}", languageLabel(selectedEdition.language))}
                </ThemedText>
              )}
              {hasBookmark && (
                <View style={styles.progressRow}>
                  <ProgressTrack progress={progress.progress / 100} style={styles.progressTrack} />
                  <ThemedText variant="caption" tabular>
                    {`${Math.round(progress.progress)}%`}
                  </ThemedText>
                </View>
              )}
            </View>

            {/* -------- languages -------- */}
            <LanguagePanel
              editions={book.editions}
              selectedEditionId={selectedEdition?.id}
              onSelect={selectEdition}
            />

            {/* -------- chapters -------- */}
            <View style={styles.chapterSection}>
              <SectionHeader
                title={t.books.chapterList}
                inset={false}
                accessory={
                  <View style={styles.chapterAccessory}>
                    <ThemedText variant="caption" tabular>
                      {chapterCountLabel}
                    </ThemedText>
                    <IconButton
                      icon="swap-vertical-outline"
                      variant="ghost"
                      size="sm"
                      color={theme.colors.textMuted}
                      onPress={() => setReversed((value) => !value)}
                      accessibilityLabel={t.books.sortOrder}
                    />
                  </View>
                }
              />
              {chaptersQuery.isLoading ? (
                <View style={styles.chapterSkeletons}>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} height={64} radius="lg" />
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
              ) : (
                <View style={styles.chapterList}>
                  {groups
                    ? groups.map((group) => (
                        <View key={group.part?.id ?? "unparted"} style={styles.chapterGroup}>
                          {group.part && <PartHeader number={group.part.number} title={group.part.title} />}
                          {group.chapters.map((chapter) => (
                            <View key={chapter.id}>
                              <ChapterRow
                                chapter={chapter}
                                isPdf={book.type === "PDF"}
                                bookmarked={progress?.chapterId === chapter.id}
                                onPress={() => openReader(chapter.id)}
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
                    : chapters.map((chapter) => (
                        <ChapterRow
                          key={chapter.id}
                          chapter={chapter}
                          isPdf={book.type === "PDF"}
                          bookmarked={progress?.chapterId === chapter.id}
                          onPress={() => openReader(chapter.id)}
                        />
                      ))}
                </View>
              )}
            </View>

            {/* -------- details facts -------- */}
            <Surface tone="flat" radius="xl" style={styles.facts}>
              <FactRow icon="person-outline" label={t.books.author} value={book.author} />
              <FactRow icon="reader-outline" label={t.books.format} value={formatLabel} />
              <FactRow icon="albums-outline" label={t.books.chaptersLabel} value={String(chapters.length)} />
              {sectionCount > 0 && (
                <FactRow icon="list-outline" label={t.books.sectionsLabel} value={String(sectionCount)} />
              )}
              {publishedAt && (
                <FactRow
                  icon="calendar-outline"
                  label={t.books.published}
                  value={format(new Date(publishedAt), "d MMM yyyy")}
                  last
                />
              )}
            </Surface>

            {/* -------- comments -------- */}
            <View style={styles.comments}>
              <CommentsSection bookId={bookId} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <TopBar transparent onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />
    </View>
  );
}

/** Overline above a part's chapters — "Part 1 · Title"; Myanmar text is never letter-spaced. */
function PartHeader({ number, title }: { number: number; title: string }) {
  const { t } = useLanguage();
  const label = `${t.books.partLabel.replace("{n}", String(number))} · ${title}`;
  return (
    <ThemedText
      variant="overline"
      numberOfLines={2}
      style={[styles.partHeader, containsMyanmar(label) && styles.noTracking]}
    >
      {label}
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
            style={({ pressed }) => [styles.sectionRow, pressed && styles.sectionPressed]}
          >
            <ThemedText variant="caption" tabular style={styles.sectionNumber}>
              {section.number}
            </ThemedText>
            <ThemedText variant="caption" color={theme.colors.text} numberOfLines={2} style={styles.sectionTitle}>
              {section.title}
            </ThemedText>
            {range && (
              <ThemedText variant="caption" tabular color={theme.colors.textFaint}>
                {range}
              </ThemedText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function FactRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.factRow, !last && styles.factDivider]}>
      <View style={styles.factLabel}>
        <Ionicons name={icon} size={14} color={theme.colors.textFaint} />
        <ThemedText variant="caption" numberOfLines={1}>
          {label}
        </ThemedText>
      </View>
      <ThemedText variant="caption" color={theme.colors.text} tabular numberOfLines={1} style={styles.factValue}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: theme.layout.tabBarClearance },
  band: { overflow: "hidden", backgroundColor: theme.colors.surface },
  bandWash: { backgroundColor: withAlpha("#0E1018", 0.55) },
  bandFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 120 },
  bandContent: {
    paddingTop: 108,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.layout.screenPadding,
    gap: theme.spacing.sm,
  },
  coverTile: {
    width: 150,
    aspectRatio: 5 / 7,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
    borderWidth: 1,
    borderColor: theme.colors.ring,
    marginBottom: theme.spacing.sm,
  },
  coverFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  title: { maxWidth: "94%" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  spine: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  summary: { gap: theme.spacing.sm },
  ctaBlock: { gap: theme.spacing.sm },
  readingIn: { textAlign: "center" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  progressTrack: { flex: 1, width: "auto" },
  chapterSection: { gap: theme.spacing.sm },
  chapterAccessory: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  chapterSkeletons: { gap: theme.spacing.sm },
  chapterList: { gap: theme.spacing.xs },
  chapterGroup: { gap: theme.spacing.xs },
  partHeader: { letterSpacing: 1.2, paddingTop: theme.spacing.sm, paddingBottom: 2, paddingHorizontal: theme.spacing.sm },
  noTracking: { letterSpacing: 0 },
  sectionRows: { gap: 2, paddingLeft: 72 + theme.spacing.sm + 4 + theme.spacing.sm, paddingBottom: theme.spacing.xs },
  sectionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    minHeight: 36,
    paddingVertical: theme.spacing.xs,
    paddingRight: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  sectionPressed: { opacity: 0.75 },
  sectionNumber: { color: theme.colors.textFaint, minWidth: 30 },
  sectionTitle: { flex: 1 },
  noChapters: { paddingVertical: theme.spacing.md },
  facts: { paddingHorizontal: theme.spacing.md },
  comments: { marginTop: theme.spacing.xl },
  factRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    minHeight: 44,
    paddingVertical: theme.spacing.sm,
  },
  factDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  factLabel: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  factValue: { flexShrink: 1 },
  skeletonBand: {
    paddingTop: 120,
    paddingHorizontal: theme.layout.screenPadding,
    gap: theme.spacing.md,
  },
  skeletonLines: { gap: theme.spacing.sm },
});
