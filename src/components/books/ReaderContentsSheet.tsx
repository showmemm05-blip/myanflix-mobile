import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
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
  /** PDF books show each chapter's page count at the row's end, and page ranges on its sections. */
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
 * The readers' contents drawer (BookReader.dc.html / PageReader.dc.html
 * "contents") — the chapter list plus, once a reader wires the annotation
 * handlers, Bookmarks / Notes tabs over the same sheet (and any injected
 * extra tabs, like the page reader's thumbnails). With no handlers it stays
 * the plain chapter list.
 *
 * Marquee rows: a number column, the title, the chapter's minutes or pages at
 * the end; the open chapter carries the crimson tint and a 3pt rail. A
 * chapter still being prepared keeps its row, inert, in the secondary inks
 * with "Coming soon" — no longer dimmed as a whole.
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
  const { height: windowHeight } = useWindowDimensions();

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

  const chapterOf = (chapterId: string) => chapters.find((chapter) => chapter.id === chapterId) ?? null;
  const chapterOrder = (chapterId: string): number | null => chapterOf(chapterId)?.order ?? null;

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

  /** "Saved on this device" — said first: these lists do not follow the reader to another phone. */
  const localNote = (
    <View style={styles.localNote}>
      <Ionicons name="phone-portrait-outline" size={16} color={theme.colors.textFaint} />
      <ThemedText variant="caption" color={theme.colors.textFaint} style={styles.localNoteText}>
        {r.annotationsLocal}
      </ThemedText>
    </View>
  );

  /** One chapter row — shared by the flat and the grouped list. */
  const renderChapter = (chapter: BookChapterSummary, number: string) => {
    const current = chapter.id === currentChapterId;
    const ready = chapter.status === "READY";
    const trailing = !ready
      ? t.books.chapterComingSoon
      : pdf
        ? chapter.pageCount > 0
          ? chapter.pageCount === 1
            ? t.books.pageCountOne
            : t.books.pageCount.replace("{n}", String(chapter.pageCount))
          : null
        : chapterMinutes?.has(chapter.id)
          ? r.estMinutes.replace("{n}", String(chapterMinutes.get(chapter.id)))
          : null;
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
        style={({ pressed }) => [styles.row, current && styles.currentRow, pressed && ready && styles.pressed]}
      >
        <ThemedText variant="caption" weight="bold" tabular color={theme.colors.textFaint} style={styles.order}>
          {number.padStart(2, "0")}
        </ThemedText>
        <ThemedText
          variant="body"
          weight="semibold"
          color={current ? theme.colors.link : ready ? theme.colors.text : theme.colors.textFaint}
          numberOfLines={2}
          style={styles.rowTitle}
        >
          {chapter.title}
        </ThemedText>
        {trailing ? (
          <ThemedText variant="label" weight="regular" tabular color={theme.colors.textFaint} style={styles.trailing}>
            {trailing}
          </ThemedText>
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
          const range =
            pdf && section.startPage != null
              ? section.endPage != null
                ? t.books.pageRange
                    .replace("{from}", String(section.startPage))
                    .replace("{to}", String(section.endPage))
                : t.books.pageAt.replace("{n}", String(section.startPage))
              : null;
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
              <ThemedText variant="caption" tabular color={theme.colors.textFaint} style={styles.sectionNumber}>
                {section.number}
              </ThemedText>
              <ThemedText variant="muted" color={theme.colors.textBody} numberOfLines={2} style={styles.sectionTitle}>
                {section.title}
              </ThemedText>
              {range && (
                <ThemedText variant="label" weight="regular" tabular color={theme.colors.textFaint} style={styles.trailing}>
                  {range}
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
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={r.contents}
      showClose
      snapHeight={Math.round(windowHeight * (pdf ? 0.75 : 0.9))}
    >
      {tabOptions.length > 1 && (
        <SegmentedControl wrap options={tabOptions} value={tab} onChange={setActiveTab} style={styles.tabs} />
      )}

      {tab === "contents" && (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.rows}>
            {contents ? (
              <>
                {contents.chapters.map(renderTreeChapter)}
                {contents.parts.map((part) => (
                  <View key={part.id}>
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
            {localNote}
            {editionBookmarks.length === 0 ? (
              <ThemedText variant="body" color={theme.colors.textMuted} style={styles.empty}>
                {r.noBookmarks}
              </ThemedText>
            ) : (
              editionBookmarks.map((bookmark) => {
                const paged = bookmark.pageNumber != null;
                const chapterTitle = chapterOf(bookmark.chapterId)?.title;
                return (
                  <View key={bookmark.id} style={styles.annoRow}>
                    <Ionicons name="bookmark" size={18} color={theme.colors.primary} style={styles.annoGlyph} />
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
                        <ThemedText
                          variant={paged ? "body" : "label"}
                          weight="bold"
                          tabular
                          color={paged ? theme.colors.text : theme.colors.textFaint}
                          style={styles.annoLabel}
                        >
                          {bookmarkLabel(bookmark)}
                        </ThemedText>
                        <ThemedText variant="label" weight="regular" tabular color={theme.colors.textFaint} style={styles.annoDate}>
                          {new Date(bookmark.createdAt).toLocaleDateString()}
                        </ThemedText>
                      </View>
                      {paged
                        ? !!chapterTitle && (
                            <ThemedText variant="caption" color={theme.colors.textFaint} numberOfLines={2}>
                              {chapterTitle}
                            </ThemedText>
                          )
                        : !!bookmark.excerpt && (
                            <ThemedText variant="body" color={theme.colors.textBody} numberOfLines={2}>
                              {bookmark.excerpt}
                            </ThemedText>
                          )}
                    </Pressable>
                    <IconButton
                      icon="close"
                      variant="ghost"
                      size="sm"
                      color={theme.colors.textMuted}
                      onPress={() => removeBookmark(bookmark.id)}
                      accessibilityLabel={r.removeBookmark}
                    />
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {tab === "notes" && (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.rows}>
            {localNote}
            {editionHighlights.length === 0 ? (
              <ThemedText variant="body" color={theme.colors.textMuted} style={styles.empty}>
                {r.noAnnotations}
              </ThemedText>
            ) : (
              editionHighlights.map((highlight) => (
                <View key={highlight.id} style={[styles.annoRow, styles.noteRow]}>
                  <View style={[styles.colorRail, { backgroundColor: HIGHLIGHT_COLORS[highlight.color] }]} />
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
                      <ThemedText variant="label" weight="bold" tabular color={theme.colors.textFaint} style={styles.annoLabel}>
                        {r.chapterLabel.replace("{n}", String(chapterOrder(highlight.chapterId) ?? "–"))}
                      </ThemedText>
                      <ThemedText variant="label" weight="regular" tabular color={theme.colors.textFaint} style={styles.annoDate}>
                        {new Date(highlight.createdAt).toLocaleDateString()}
                      </ThemedText>
                    </View>
                    <ThemedText variant="body" numberOfLines={2}>
                      {highlight.excerpt}
                    </ThemedText>
                    {!!highlight.note && (
                      <ThemedText variant="caption" color={theme.colors.textMuted} numberOfLines={2} style={styles.note}>
                        {highlight.note}
                      </ThemedText>
                    )}
                  </Pressable>
                  <IconButton
                    icon="close"
                    variant="ghost"
                    size="sm"
                    color={theme.colors.textMuted}
                    onPress={() => removeHighlight(highlight.id)}
                    accessibilityLabel={r.removeHighlight}
                  />
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {activeExtra && <View style={styles.extra}>{activeExtra.content}</View>}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  tabs: { marginBottom: 12 },
  rows: { paddingBottom: theme.spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingVertical: theme.spacing.xs,
    paddingLeft: 12,
    paddingRight: theme.spacing.xs,
    borderRadius: theme.radius.md,
    // The current chapter's rail; transparent on every other row so nothing shifts.
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  currentRow: {
    backgroundColor: withAlpha(theme.colors.primary, 0.12),
    borderLeftColor: theme.colors.primary,
  },
  pressed: { opacity: 0.7 },
  order: { width: 28 },
  rowTitle: { flex: 1 },
  trailing: { letterSpacing: 0, textAlign: "right" },
  partHeader: { paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xs },
  sectionRows: { paddingLeft: 40 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: theme.layout.minTouch,
    paddingVertical: theme.spacing.xs,
    paddingRight: theme.spacing.xs,
  },
  sectionNumber: { minWidth: 28 },
  sectionTitle: { flex: 1 },
  localNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  localNoteText: { flexShrink: 1 },
  annoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  noteRow: { alignItems: "stretch" },
  annoGlyph: { alignSelf: "flex-start", marginTop: 2 },
  annoBody: { flex: 1, gap: 2 },
  annoHead: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  annoLabel: { flexShrink: 1, letterSpacing: 0 },
  annoDate: { marginLeft: "auto", letterSpacing: 0 },
  colorRail: { width: 4, borderRadius: 2 },
  note: { marginTop: 2 },
  empty: { textAlign: "center", paddingVertical: theme.spacing.xl },
  extra: { flex: 1 },
});
