import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import {
  useReaderAnnotationsStore,
  type ReaderBookmark,
  type ReaderHighlight,
} from "@/store/readerAnnotationsStore";
import { HIGHLIGHT_COLORS } from "@/components/books/readerThemes";
import { containsMyanmar } from "@/components/books/RichText";
import { theme, withAlpha } from "@/theme";
import type { BookChapterSummary, BookContents, BookSectionSummary } from "@/types/book";

export interface ReaderContentsExtraTab {
  id: string;
  label: string;
  content: ReactNode;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Sorted by `order`. */
  chapters: BookChapterSummary[];
  /**
   * Estimated minutes per chapter, for the rows of TEXT books — only
   * chapters the reader has already loaded appear here (estimating unread
   * chapters would mean fetching every one just to open the sheet).
   */
  chapterMinutes?: ReadonlyMap<string, number>;
  currentChapterId: string;
  /** Called with a READY chapter's id; the sheet closes itself first. */
  onSelect: (chapterId: string) => void;
  /** PDF books show a chapter thumb + page count instead of the bare number column. */
  pdf?: boolean;
  /** Edition whose annotations to list — entries carry editionId; chapter ids are edition-specific. */
  editionId?: string;
  /** Enables the Bookmarks tab; the sheet closes itself before jumping. */
  onSelectBookmark?: (bookmark: ReaderBookmark) => void;
  /** Text readers: enables the Notes tab (highlights + their notes). */
  onSelectHighlight?: (highlight: ReaderHighlight) => void;
  /** Page reader slots (e.g. the thumbnails grid), appended after the built-in tabs. */
  extraTabs?: ReaderContentsExtraTab[];
  /**
   * The numbered Part → Chapter → Section tree. When given, the contents tab
   * renders it (part headers, server numbers, nested sections); when absent
   * the sheet renders the flat `chapters` list exactly as it always has.
   */
  contents?: BookContents;
  /** Called with a section of a READY chapter; the sheet closes itself first. */
  onSelectSection?: (chapterId: string, section: BookSectionSummary) => void;
}

/**
 * The readers' contents drawer — chapter list plus, once a reader wires the
 * annotation handlers, Bookmarks/Notes tabs over the same sheet (and any
 * injected extra tabs). With no handlers it stays the plain chapter list.
 */
export function ReaderContentsSheet({
  visible,
  onClose,
  chapters,
  chapterMinutes,
  currentChapterId,
  onSelect,
  pdf,
  editionId,
  onSelectBookmark,
  onSelectHighlight,
  extraTabs,
  contents,
  onSelectSection,
}: Props) {
  const { t } = useLanguage();
  const r = t.books.reader;

  const showBookmarks = !!editionId && !!onSelectBookmark;
  const showNotes = !!editionId && !!onSelectHighlight;

  const tabOptions = [
    { value: "contents", label: r.contents },
    ...(showBookmarks ? [{ value: "bookmarks", label: r.bookmarks }] : []),
    ...(showNotes ? [{ value: "notes", label: r.notesTab }] : []),
    ...(extraTabs ?? []).map((tab) => ({ value: `extra:${tab.id}`, label: tab.label })),
  ];
  const [activeTab, setActiveTab] = useState("contents");
  const tab = tabOptions.some((option) => option.value === activeTab) ? activeTab : "contents";

  const bookmarks = useReaderAnnotationsStore((s) => s.bookmarks);
  const highlights = useReaderAnnotationsStore((s) => s.highlights);
  const removeBookmark = useReaderAnnotationsStore((s) => s.removeBookmark);
  const removeHighlight = useReaderAnnotationsStore((s) => s.removeHighlight);

  // Lists filter to the OPEN edition — chapter ids are edition-specific.
  const editionBookmarks = bookmarks
    .filter((row) => row.editionId === editionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const editionHighlights = highlights
    .filter((row) => row.editionId === editionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const chapterOrder = (chapterId: string): number | null =>
    chapters.find((chapter) => chapter.id === chapterId)?.order ?? null;

  const bookmarkLabel = (bookmark: ReaderBookmark): string => {
    if (bookmark.pageNumber != null) return r.pageLabel.replace("{n}", String(bookmark.pageNumber));
    const order = chapterOrder(bookmark.chapterId);
    const chapterPart = r.chapterLabel.replace("{n}", String(order ?? "–"));
    const pct = Math.round((bookmark.pct ?? 0) * 100);
    return `${chapterPart} · ${pct}%`;
  };

  const activeExtra = tab.startsWith("extra:")
    ? (extraTabs ?? []).find((candidate) => candidate.id === tab.slice("extra:".length))
    : undefined;

  const annotationsFooter = (
    <ThemedText variant="caption" color={theme.colors.textFaint} style={styles.localNote}>
      {r.annotationsLocal}
    </ThemedText>
  );

  /** One chapter row — the ORIGINAL markup, shared by the flat and the grouped list. */
  const renderChapter = (chapter: BookChapterSummary, number: string) => {
    const current = chapter.id === currentChapterId;
    const ready = chapter.status === "READY";
    const pageCountLabel =
      chapter.pageCount === 1
        ? t.books.pageCountOne
        : t.books.pageCount.replace("{n}", String(chapter.pageCount));
    return (
      <Pressable
        key={chapter.id}
        onPress={
          ready && !current
            ? () => {
                onClose();
                onSelect(chapter.id);
              }
            : ready
              ? onClose
              : undefined
        }
        disabled={!ready}
        accessibilityRole="button"
        accessibilityLabel={chapter.title}
        accessibilityState={{ selected: current, disabled: !ready }}
        style={({ pressed }) => [
          styles.row,
          current && styles.currentRow,
          !ready && styles.dimmed,
          pressed && ready && styles.pressed,
        ]}
      >
        {pdf ? (
          <View style={styles.thumb}>
            {chapter.imageUrl ? (
              <Image
                source={{ uri: chapter.imageUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={160}
              />
            ) : (
              <ThemedText variant="caption" tabular color={theme.colors.textFaint}>
                {number}
              </ThemedText>
            )}
          </View>
        ) : (
          <ThemedText variant="caption" tabular style={styles.order}>
            {number.padStart(2, "0")}
          </ThemedText>
        )}

        <View style={styles.body}>
          <ThemedText
            variant="body"
            weight={current ? "semibold" : "regular"}
            color={current ? theme.colors.primary : theme.colors.text}
            numberOfLines={2}
          >
            {chapter.title}
          </ThemedText>
          {pdf && chapter.pageCount > 0 && (
            <ThemedText variant="caption" tabular numberOfLines={1}>
              {pageCountLabel}
            </ThemedText>
          )}
          {!pdf && chapterMinutes?.has(chapter.id) && (
            <ThemedText variant="caption" tabular numberOfLines={1}>
              {t.books.reader.estMinutes.replace(
                "{n}",
                String(chapterMinutes.get(chapter.id)),
              )}
            </ThemedText>
          )}
        </View>

        {!ready ? (
          <ThemedText variant="caption" color={theme.colors.textFaint}>
            {t.books.chapterComingSoon}
          </ThemedText>
        ) : current ? (
          <Ionicons name="bookmark" size={14} color={theme.colors.primary} />
        ) : null}
      </Pressable>
    );
  };

  /** A READY chapter's sections, indented under its row; a tap lands on the section. */
  const renderSections = (chapter: BookChapterSummary) => {
    // `?? []` guards a row cached before sections existed — never a crash for an old book.
    const sections = chapter.sections ?? [];
    if (!onSelectSection || chapter.status !== "READY" || sections.length === 0) return null;
    return (
      <View style={styles.sectionRows}>
        {sections.map((section) => {
          const label = `${section.number} ${section.title}`;
          return (
            <Pressable
              key={section.id}
              onPress={() => {
                onClose();
                onSelectSection(chapter.id, section);
              }}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={({ pressed }) => [styles.sectionRow, pressed && styles.pressed]}
            >
              <ThemedText variant="caption" tabular style={styles.sectionNumber}>
                {section.number}
              </ThemedText>
              <ThemedText variant="caption" color={theme.colors.text} numberOfLines={2} style={styles.sectionTitle}>
                {section.title}
              </ThemedText>
              {pdf && section.startPage != null && (
                <ThemedText variant="caption" tabular color={theme.colors.textFaint}>
                  {t.books.pageAt.replace("{n}", String(section.startPage))}
                </ThemedText>
              )}
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderTreeChapter = (chapter: BookChapterSummary) => (
    <View key={chapter.id}>
      {renderChapter(chapter, chapter.number)}
      {renderSections(chapter)}
    </View>
  );

  const renderPartHeader = (part: BookContents["parts"][number]) => {
    const label = `${r.partLabel.replace("{n}", String(part.number))} · ${part.title}`;
    return (
      <ThemedText
        variant="overline"
        numberOfLines={2}
        // Tracking widens Latin overlines; Myanmar text must never be letter-spaced.
        style={[styles.partHeader, containsMyanmar(label) && styles.noTracking]}
      >
        {label}
      </ThemedText>
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={r.contents} showClose snapHeight={560}>
      {tabOptions.length > 1 && (
        <SegmentedControl options={tabOptions} value={tab} onChange={setActiveTab} style={styles.tabs} />
      )}

      {tab === "contents" && (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.rows}>
            {contents ? (
              <>
                {contents.chapters.map(renderTreeChapter)}
                {contents.parts.map((part) => (
                  <View key={part.id} style={styles.partGroup}>
                    {renderPartHeader(part)}
                    {part.chapters.map(renderTreeChapter)}
                  </View>
                ))}
              </>
            ) : (
              chapters.map((chapter) => renderChapter(chapter, String(chapter.order)))
            )}
          </View>
        </ScrollView>
      )}

      {tab === "bookmarks" && (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.rows}>
            {editionBookmarks.length === 0 ? (
              <ThemedText variant="body" color={theme.colors.textMuted} style={styles.empty}>
                {r.noBookmarks}
              </ThemedText>
            ) : (
              editionBookmarks.map((bookmark) => (
                <View key={bookmark.id} style={styles.annoRow}>
                  <Pressable
                    onPress={() => {
                      onClose();
                      onSelectBookmark?.(bookmark);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={bookmarkLabel(bookmark)}
                    style={({ pressed }) => [styles.annoBody, pressed && styles.pressed]}
                  >
                    <View style={styles.annoHead}>
                      <Ionicons name="bookmark" size={14} color={theme.colors.primary} />
                      <ThemedText variant="label" tabular color={theme.colors.text}>
                        {bookmarkLabel(bookmark)}
                      </ThemedText>
                      <ThemedText variant="caption" color={theme.colors.textFaint} style={styles.annoDate}>
                        {new Date(bookmark.createdAt).toLocaleDateString()}
                      </ThemedText>
                    </View>
                    {!!bookmark.excerpt && (
                      <ThemedText variant="caption" numberOfLines={2}>
                        {bookmark.excerpt}
                      </ThemedText>
                    )}
                  </Pressable>
                  <IconButton
                    icon="close"
                    variant="ghost"
                    size="sm"
                    color={theme.colors.textFaint}
                    onPress={() => removeBookmark(bookmark.id)}
                    accessibilityLabel={r.removeBookmark}
                  />
                </View>
              ))
            )}
            {annotationsFooter}
          </View>
        </ScrollView>
      )}

      {tab === "notes" && (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.rows}>
            {editionHighlights.length === 0 ? (
              <ThemedText variant="body" color={theme.colors.textMuted} style={styles.empty}>
                {r.noAnnotations}
              </ThemedText>
            ) : (
              editionHighlights.map((highlight) => (
                <View key={highlight.id} style={styles.annoRow}>
                  <Pressable
                    onPress={() => {
                      onClose();
                      onSelectHighlight?.(highlight);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={highlight.excerpt}
                    style={({ pressed }) => [styles.annoBody, pressed && styles.pressed]}
                  >
                    <View style={styles.annoHead}>
                      <View style={[styles.colorDot, { backgroundColor: HIGHLIGHT_COLORS[highlight.color] }]} />
                      <ThemedText variant="label" tabular color={theme.colors.text}>
                        {r.chapterLabel.replace("{n}", String(chapterOrder(highlight.chapterId) ?? "–"))}
                      </ThemedText>
                      <ThemedText variant="caption" color={theme.colors.textFaint} style={styles.annoDate}>
                        {new Date(highlight.createdAt).toLocaleDateString()}
                      </ThemedText>
                    </View>
                    <ThemedText variant="caption" numberOfLines={2}>
                      {highlight.excerpt}
                    </ThemedText>
                    {!!highlight.note && (
                      <View style={styles.noteWrap}>
                        <ThemedText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
                          {highlight.note}
                        </ThemedText>
                      </View>
                    )}
                  </Pressable>
                  <IconButton
                    icon="close"
                    variant="ghost"
                    size="sm"
                    color={theme.colors.textFaint}
                    onPress={() => removeHighlight(highlight.id)}
                    accessibilityLabel={r.removeHighlight}
                  />
                </View>
              ))
            )}
            {annotationsFooter}
          </View>
        </ScrollView>
      )}

      {activeExtra && <View style={styles.extra}>{activeExtra.content}</View>}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  tabs: { marginBottom: theme.spacing.sm },
  rows: { gap: theme.spacing.xs, paddingBottom: theme.spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm + 4,
    minHeight: 52,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.lg,
  },
  currentRow: { backgroundColor: withAlpha(theme.colors.primary, 0.12) },
  dimmed: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  order: { minWidth: 26, textAlign: "right", color: theme.colors.textFaint },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
    borderWidth: 1,
    borderColor: theme.colors.ring,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 2 },
  partGroup: { gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  partHeader: { letterSpacing: 1.2, paddingHorizontal: theme.spacing.sm, paddingBottom: 2 },
  noTracking: { letterSpacing: 0 },
  sectionRows: { gap: 2, paddingLeft: theme.spacing.xl + theme.spacing.sm, paddingBottom: theme.spacing.xs },
  sectionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    minHeight: 36,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  sectionNumber: { color: theme.colors.textFaint, minWidth: 30 },
  sectionTitle: { flex: 1 },
  annoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.lg,
  },
  annoBody: { flex: 1, gap: theme.spacing.xs },
  annoHead: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  annoDate: { marginLeft: "auto" },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  noteWrap: {
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.borderStrong,
    paddingLeft: theme.spacing.sm,
  },
  empty: { textAlign: "center", paddingVertical: theme.spacing.xl },
  localNote: { textAlign: "center", paddingTop: theme.spacing.md },
  extra: { flex: 1 },
});
