import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ThemedText } from "@/components/ui/ThemedText";
import { pmPlainBlocks } from "@/components/books/RichText";
import { composeChapterDoc } from "@/utils/chapterSections";
import { chapterKey } from "@/hooks/useBooks";
import { booksService } from "@/services/books.service";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { BookChapterSummary } from "@/types/book";

export interface ReaderSearchResult {
  id: string;
  chapterId: string;
  chapterTitle: string;
  /** Top-level block index in the chapter doc — the jump target. */
  blockIndex: number;
  /** ±40 chars of context around the match. */
  pre: string;
  match: string;
  post: string;
  /** First result of its chapter renders the chapter header above it. */
  firstInChapter: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  bookId: string;
  editionId: string;
  /** Sorted by `order`; only READY chapters are searched. */
  chapters: BookChapterSummary[];
  /** The sheet closes itself first. */
  onSelectResult: (result: ReaderSearchResult) => void;
}

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;
const MATCH_CAP = 200;
const CONTEXT_CHARS = 40;
const MINUTE_MS = 60_000;

/**
 * Search-in-book for TEXT (EDITOR) editions — client-side and lazy: chapters
 * are fetched sequentially through the SAME react-query key/fn as useChapter,
 * so every fetched chapter warms the reader cache. Page books are raster WebP
 * with no text layer — search never mounts for them (parked).
 */
export function ReaderSearchSheet({ visible, onClose, bookId, editionId, chapters, onSelectResult }: Props) {
  const { t } = useLanguage();
  const r = t.books.reader;
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReaderSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [ran, setRan] = useState(false);

  /** Plain-text block cache per chapterId — survives sheet close/reopen. */
  const textCacheRef = useRef(new Map<string, string[]>());
  /** Cancels stale runs: only the latest generation may write state. */
  const generationRef = useRef(0);

  const runSearch = useCallback(
    async (term: string) => {
      const generation = ++generationRef.current;
      const ready = chapters.filter((chapter) => chapter.status === "READY");
      // NFC-normalize both sides; Burmese has no case, toLowerCase only bends Latin.
      const needle = term.normalize("NFC").toLowerCase();

      setSearching(true);
      setResults([]);
      setRan(false);
      const found: ReaderSearchResult[] = [];

      for (let index = 0; index < ready.length; index += 1) {
        if (generationRef.current !== generation) return;
        const chapter = ready[index];
        setProgress({ done: index + 1, total: ready.length });

        let blocks = textCacheRef.current.get(chapter.id);
        if (!blocks) {
          try {
            // Cache-first through the reader's own key/fn — a hit costs no request.
            const loaded = await queryClient.fetchQuery({
              queryKey: chapterKey(bookId, editionId, chapter.id),
              queryFn: ({ signal }) => booksService.getChapter(bookId, editionId, chapter.id, { signal }),
              staleTime: 5 * MINUTE_MS,
            });
            // Sections are searchable too: the composed doc is the SAME block
            // space the reader renders, so blockIndex jumps land unchanged.
            const composed = composeChapterDoc({ content: loaded.content, sections: loaded.sections ?? [] }).doc;
            blocks = composed ? pmPlainBlocks(composed as Record<string, unknown>) : [];
            textCacheRef.current.set(chapter.id, blocks);
          } catch {
            continue; // One unreachable chapter never sinks the whole search.
          }
        }
        if (generationRef.current !== generation) return;

        let firstInChapter = true;
        for (let blockIndex = 0; blockIndex < blocks.length && found.length < MATCH_CAP; blockIndex += 1) {
          const raw = blocks[blockIndex].normalize("NFC");
          const haystack = raw.toLowerCase();
          let from = 0;
          let at = haystack.indexOf(needle, from);
          while (at !== -1 && found.length < MATCH_CAP) {
            const end = at + needle.length;
            found.push({
              id: `${chapter.id}-${blockIndex}-${at}`,
              chapterId: chapter.id,
              chapterTitle: chapter.title,
              blockIndex,
              pre: `${at > CONTEXT_CHARS ? "…" : ""}${raw.slice(Math.max(0, at - CONTEXT_CHARS), at)}`,
              match: raw.slice(at, end),
              post: `${raw.slice(end, end + CONTEXT_CHARS)}${end + CONTEXT_CHARS < raw.length ? "…" : ""}`,
              firstInChapter,
            });
            firstInChapter = false;
            from = end;
            at = haystack.indexOf(needle, from);
          }
        }
        setResults([...found]);
        if (found.length >= MATCH_CAP) break; // Stop fetching further chapters at cap.
      }

      if (generationRef.current !== generation) return;
      setSearching(false);
      setProgress(null);
      setRan(true);
    },
    [bookId, editionId, chapters, queryClient],
  );

  // Debounced trigger — a functional timer, not decoration (allowed under RM).
  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_QUERY) {
      generationRef.current += 1; // Cancel any in-flight run.
      setSearching(false);
      setProgress(null);
      setResults([]);
      setRan(false);
      return;
    }
    const timer = setTimeout(() => void runSearch(term), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const trimmed = query.trim();
  const countLabel =
    results.length === 1 ? r.searchCountOne : r.searchCount.replace("{n}", String(results.length));
  const progressLabel = progress
    ? `${r.searching} ${t.books.reader.chapterOf
        .replace("{c}", String(progress.done))
        .replace("{t}", String(progress.total))}`
    : r.searching;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={r.searchInBook} showClose snapHeight={560}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={r.searchPlaceholder}
        placeholderTextColor={theme.colors.textFaint}
        accessibilityLabel={r.searchInBook}
        autoCorrect={false}
        returnKeyType="search"
        style={styles.input}
      />

      {trimmed.length > 0 && trimmed.length < MIN_QUERY ? (
        <ThemedText variant="caption" color={theme.colors.textFaint} style={styles.status}>
          {r.searchTooShort}
        </ThemedText>
      ) : searching ? (
        <ThemedText variant="caption" color={theme.colors.textFaint} style={styles.status}>
          {progressLabel}
        </ThemedText>
      ) : ran ? (
        <ThemedText variant="caption" color={theme.colors.textFaint} style={styles.status}>
          {results.length === 0 ? r.searchNoResults : countLabel}
        </ThemedText>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.rows}
        renderItem={({ item }) => (
          <View>
            {item.firstInChapter && (
              <ThemedText variant="label" color={theme.colors.textMuted} numberOfLines={1} style={styles.chapterHead}>
                {item.chapterTitle}
              </ThemedText>
            )}
            <Pressable
              onPress={() => {
                onClose();
                onSelectResult(item);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${item.pre}${item.match}${item.post}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <ThemedText variant="caption" numberOfLines={2} color={theme.colors.textMuted}>
                {item.pre}
                <Text style={styles.match}>{item.match}</Text>
                {item.post}
              </ThemedText>
            </Pressable>
          </View>
        )}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: theme.layout.minTouch,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.text,
    fontFamily: theme.font.regular,
    fontSize: 15,
    marginBottom: theme.spacing.sm,
  },
  status: { textAlign: "center", paddingVertical: theme.spacing.xs },
  rows: { paddingBottom: theme.spacing.md },
  chapterHead: { marginTop: theme.spacing.sm, marginBottom: theme.spacing.xs },
  row: {
    minHeight: theme.layout.minTouch,
    justifyContent: "center",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.lg,
  },
  pressed: { opacity: 0.75 },
  match: {
    color: theme.colors.primary,
    fontFamily: theme.font.semibold,
  },
});
