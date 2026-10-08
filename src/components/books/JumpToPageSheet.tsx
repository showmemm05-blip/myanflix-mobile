import { useCallback, useState } from "react";
import { StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { PageThumbGrid } from "@/components/books/PageThumbGrid";
import { useStackedActions } from "@/components/books/useStackedActions";
import { useLanguage } from "@/localization/LanguageProvider";
import { tabularNums, theme } from "@/theme";
import type { BookPage } from "@/types/book";

interface Props {
  visible: boolean;
  onClose: () => void;
  pages: BookPage[];
  currentIndex: number;
  /** Zero-based, exactly like the reader's own goToPage. */
  onGoToPage: (index: number) => void;
}

/**
 * Jump to page (PageReader.dc.html "jump"): the 56pt number field, First /
 * Last page, the crimson "Go to page" commit pinned at the foot — and the
 * thumbnail grid between them, kept from before Marquee.
 *
 * Lifted out of PageReader, which already owns three list layouts, a zoom
 * model and a chrome timer. The typed number lives here because nothing
 * outside this dialog reads it — but `visible` stays the SCREEN's state, since
 * the reader ORs it into `barsVisible` to pin the chrome up while the sheet is
 * open.
 */
export function JumpToPageSheet({ visible, onClose, pages, currentIndex, onGoToPage }: Props) {
  const { t } = useLanguage();
  const r = t.books.reader;
  const [jumpText, setJumpText] = useState("");
  const { height: windowHeight } = useWindowDimensions();
  const stacked = useStackedActions();

  const submitJump = useCallback(() => {
    const target = parseInt(jumpText, 10);
    onClose();
    setJumpText("");
    if (Number.isFinite(target) && target >= 1 && target <= pages.length) {
      onGoToPage(target - 1);
    }
  }, [jumpText, pages.length, onGoToPage, onClose]);

  /** Every shortcut in here closes the sheet and forgets the typed number. */
  const jumpTo = useCallback(
    (index: number) => {
      onClose();
      setJumpText("");
      onGoToPage(index);
    },
    [onClose, onGoToPage],
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={r.jumpToPage}
      showClose
      snapHeight={Math.round(windowHeight * 0.7)}
      footer={<Button title={r.jumpToPage} size="lg" fullWidth onPress={submitJump} />}
    >
      <TextInput
        style={styles.jumpInput}
        value={jumpText}
        onChangeText={setJumpText}
        keyboardType="number-pad"
        placeholder={`1 – ${pages.length}`}
        placeholderTextColor={theme.colors.textFaint}
        selectionColor={theme.colors.primary}
        accessibilityLabel={r.jumpToPage}
        onSubmitEditing={submitJump}
      />
      <View style={[styles.jumpQuickRow, stacked && styles.jumpQuickStacked]}>
        <Button title={r.firstPage} variant="secondary" onPress={() => jumpTo(0)} style={!stacked && styles.jumpQuick} />
        <Button
          title={r.lastPage}
          variant="secondary"
          onPress={() => jumpTo(pages.length - 1)}
          style={!stacked && styles.jumpQuick}
        />
      </View>
      <View style={styles.jumpGrid}>
        <PageThumbGrid pages={pages} currentIndex={currentIndex} onSelect={jumpTo} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  /** Marquee's field: 56pt, radius 16, the raised fill, a 20pt bold tabular number. */
  jumpInput: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceElevated,
    color: theme.colors.text,
    paddingHorizontal: 18,
    fontSize: 20,
    fontFamily: theme.font.bold,
    ...tabularNums,
  },
  jumpQuickRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    marginBottom: theme.spacing.md,
  },
  jumpQuickStacked: { flexDirection: "column" },
  jumpQuick: { flexGrow: 1, flexBasis: 0 },
  jumpGrid: { flex: 1 },
});
