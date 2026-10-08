import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ThemedText } from "@/components/ui/ThemedText";
import { SheetForm, SheetTextArea } from "@/components/wallet/SheetForm";
import { HIGHLIGHT_COLORS } from "@/components/books/readerThemes";
import { useStackedActions } from "@/components/books/useStackedActions";
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

  const stacked = useStackedActions();
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
      {/* No pinned action: the buttons here are alternatives, not one submit,
          so they stay in the scroll flow. SheetForm still keeps the note field
          clear of the keyboard — a Modal never resizes for one. */}
      <SheetForm contentStyle={styles.body}>
        {/* The paragraph, quoted against a rail in its highlight colour. */}
        <View
          style={[
            styles.quote,
            { borderLeftColor: highlight ? HIGHLIGHT_COLORS[highlight.color] : theme.colors.borderStrong },
          ]}
        >
          <ThemedText variant="muted" color={theme.colors.textBody} numberOfLines={3}>
            {blockText}
          </ThemedText>
        </View>

        {/* -------- highlight colours -------- */}
        <View style={styles.group}>
          <ThemedText variant="overline">{r.highlight.toUpperCase()}</ThemedText>
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
                  <View style={[styles.colorRing, active && styles.colorRingActive]}>
                    <View style={[styles.colorDot, { backgroundColor: withAlpha(HIGHLIGHT_COLORS[color], 0.9) }]}>
                      {active && <Ionicons name="checkmark" size={16} color={theme.colors.text} />}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* -------- note (a highlight with words) -------- */}
        <View style={styles.group}>
          <ThemedText variant="overline">{(highlight?.note ? r.editNote : r.addNote).toUpperCase()}</ThemedText>
          <SheetTextArea
            value={noteDraft}
            onChangeText={setNoteDraft}
            placeholder={r.notePlaceholder}
            accessibilityLabel={r.note}
            maxLength={NOTE_MAX}
            style={styles.note}
          />
        </View>
        {noteDirty && <Button title={r.saveNote} onPress={saveNote} size="md" />}

        {/* -------- copy / remove -------- */}
        <View style={[styles.actions, stacked && styles.actionsStacked]}>
          <Button
            title={copied ? r.copied : r.copyParagraph}
            icon={copied ? "checkmark" : "copy-outline"}
            variant="secondary"
            onPress={copyParagraph}
            style={!stacked && styles.action}
          />
          {highlight && (
            <Button
              title={r.removeHighlight}
              icon="trash-outline"
              variant="ghost"
              color={theme.colors.danger}
              onPress={remove}
              style={!stacked && styles.action}
            />
          )}
        </View>
      </SheetForm>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 20 },
  quote: { borderLeftWidth: 3, paddingLeft: 12 },
  group: { gap: theme.spacing.sm },
  colorRow: { flexDirection: "row", gap: 12 },
  colorHit: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  /** The selected colour's ring: 3pt of the sheet, then 2pt of white (BookReader.dc.html). */
  colorRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  colorRingActive: { borderColor: theme.colors.text },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.75 },
  /** A note is a sentence, not a paragraph — shorter than the feedback box. */
  note: { minHeight: 88 },
  actions: { flexDirection: "row", gap: 10 },
  actionsStacked: { flexDirection: "column" },
  action: { flexGrow: 1, flexBasis: 0 },
});
