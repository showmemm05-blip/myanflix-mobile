import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ThemedText } from "@/components/ui/ThemedText";
import { HIGHLIGHT_COLORS } from "@/components/books/readerThemes";
import { useLanguage } from "@/localization/LanguageProvider";
import {
  NOTE_MAX,
  useReaderAnnotationsStore,
  type HighlightColor,
} from "@/store/readerAnnotationsStore";
import { theme, withAlpha } from "@/theme";

const COLOR_ORDER: HighlightColor[] = ["yellow", "green", "blue", "pink"];

interface Props {
  visible: boolean;
  onClose: () => void;
  editionId: string;
  chapterId: string;
  /** Top-level block index in the chapter's ProseMirror doc; null = closed. */
  blockIndex: number | null;
  /** The block's plain text — excerpt source and what "Copy paragraph" copies. */
  blockText: string;
}

/**
 * Long-press actions for one paragraph — the mobile annotation surface.
 * RN Text has no selection-change API, so per-PARAGRAPH highlights are the
 * sanctioned fallback: colour dots highlight the whole block, a note turns
 * the highlight into a "note" (Apple Books model — no third entity), copy
 * grabs the paragraph. All writes go through readerAnnotationsStore
 * (AsyncStorage write-through, per user + book).
 */
export function BlockActionsSheet({ visible, onClose, editionId, chapterId, blockIndex, blockText }: Props) {
  const { t } = useLanguage();
  const r = t.books.reader;

  const highlights = useReaderAnnotationsStore((s) => s.highlights);
  const addHighlight = useReaderAnnotationsStore((s) => s.addHighlight);
  const updateHighlight = useReaderAnnotationsStore((s) => s.updateHighlight);
  const removeHighlight = useReaderAnnotationsStore((s) => s.removeHighlight);

  const highlight =
    blockIndex === null
      ? undefined
      : highlights.find(
          (row) => row.editionId === editionId && row.chapterId === chapterId && row.blockIndex === blockIndex,
        );

  const [noteDraft, setNoteDraft] = useState("");
  const [copied, setCopied] = useState(false);

  // Re-seed the draft whenever the sheet opens onto a (possibly different) block.
  useEffect(() => {
    if (visible) {
      setNoteDraft(highlight?.note ?? "");
      setCopied(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, blockIndex]);

  if (blockIndex === null) return null;

  /** Add-or-recolour; the 500-highlight cap refuses loudly, never evicts. */
  const pickColor = (color: HighlightColor) => {
    if (highlight) {
      updateHighlight(highlight.id, { color });
      return;
    }
    const ok = addHighlight({
      editionId,
      chapterId,
      blockIndex,
      excerpt: blockText,
      color,
      note: noteDraft.trim() || undefined,
    });
    if (!ok) Alert.alert(r.annotationLimit);
  };

  const saveNote = () => {
    const note = noteDraft.trim();
    if (highlight) {
      updateHighlight(highlight.id, { note: note || undefined });
      onClose();
      return;
    }
    // A note needs a highlight to live on — seed a yellow one (Apple Books model).
    const ok = addHighlight({
      editionId,
      chapterId,
      blockIndex,
      excerpt: blockText,
      color: "yellow",
      note: note || undefined,
    });
    if (!ok) {
      Alert.alert(r.annotationLimit);
      return;
    }
    onClose();
  };

  const copyParagraph = async () => {
    try {
      await Clipboard.setStringAsync(blockText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — quiet failure, never a crash mid-read.
    }
  };

  const remove = () => {
    if (highlight) removeHighlight(highlight.id);
    onClose();
  };

  const noteDirty = noteDraft.trim() !== (highlight?.note ?? "");

  const colorLabels: Record<HighlightColor, string> = {
    yellow: r.hlYellow,
    green: r.hlGreen,
    blue: r.hlBlue,
    pink: r.hlPink,
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={r.paragraph} showClose snapHeight={480}>
      {/* The sheet lives in a Modal, which never resizes for the keyboard. */}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedText variant="caption" color={theme.colors.textMuted} numberOfLines={3}>
            {blockText}
          </ThemedText>

          {/* -------- highlight colours -------- */}
          <ThemedText variant="label" color={theme.colors.text}>
            {r.highlight}
          </ThemedText>
          <View style={styles.colorRow}>
            {COLOR_ORDER.map((color) => {
              const active = highlight?.color === color;
              return (
                <Pressable
                  key={color}
                  onPress={() => pickColor(color)}
                  accessibilityRole="button"
                  accessibilityLabel={colorLabels[color]}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [styles.colorHit, pressed && styles.pressed]}
                >
                  <View
                    style={[
                      styles.colorDot,
                      { backgroundColor: withAlpha(HIGHLIGHT_COLORS[color], 0.9) },
                      active && styles.colorDotActive,
                    ]}
                  >
                    {active && <Ionicons name="checkmark" size={16} color="#ffffff" />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* -------- note (a highlight with words) -------- */}
          <ThemedText variant="label" color={theme.colors.text}>
            {highlight?.note ? r.editNote : r.addNote}
          </ThemedText>
          <TextInput
            value={noteDraft}
            onChangeText={setNoteDraft}
            placeholder={r.notePlaceholder}
            placeholderTextColor={theme.colors.textFaint}
            accessibilityLabel={r.note}
            multiline
            maxLength={NOTE_MAX}
            textAlignVertical="top"
            style={styles.input}
          />
          {noteDirty && <Button title={r.saveNote} onPress={saveNote} size="md" />}

          {/* -------- copy / remove -------- */}
          <Button
            title={copied ? r.copied : r.copyParagraph}
            icon={copied ? "checkmark" : "copy-outline"}
            variant="outline"
            onPress={copyParagraph}
          />
          {highlight && (
            <Button title={r.removeHighlight} icon="trash-outline" variant="ghost" onPress={remove} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: theme.spacing.md, paddingBottom: theme.spacing.lg },
  colorRow: { flexDirection: "row", gap: theme.spacing.sm },
  colorHit: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  colorDotActive: {
    borderWidth: 2,
    borderColor: theme.colors.text,
  },
  pressed: { opacity: 0.75 },
  input: {
    minHeight: 96,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    color: theme.colors.text,
    fontFamily: theme.font.regular,
    fontSize: 15,
  },
});
