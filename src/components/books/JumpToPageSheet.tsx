import { useCallback, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { PageThumbGrid } from "@/components/books/PageThumbGrid";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
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
 * Jump to page: number pad + first/last + thumbnail grid.
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
      snapHeight={560}
      footer={<Button title={r.jumpToPage} fullWidth onPress={submitJump} />}
    >
      <TextInput
        style={styles.jumpInput}
        value={jumpText}
        onChangeText={setJumpText}
        keyboardType="number-pad"
        placeholder={`1 – ${pages.length}`}
        placeholderTextColor={theme.colors.textFaint}
        accessibilityLabel={r.jumpToPage}
        onSubmitEditing={submitJump}
      />
      <View style={styles.jumpQuickRow}>
        <Button
          title={r.firstPage}
          icon="play-back-outline"
          variant="outline"
          onPress={() => jumpTo(0)}
          style={styles.jumpQuick}
        />
        <Button
          title={r.lastPage}
          trailingIcon="play-forward-outline"
          variant="outline"
          onPress={() => jumpTo(pages.length - 1)}
          style={styles.jumpQuick}
        />
      </View>
      <View style={styles.jumpGrid}>
        <PageThumbGrid pages={pages} currentIndex={currentIndex} onSelect={jumpTo} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  jumpInput: {
    minHeight: theme.layout.minTouch,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
    fontSize: 16,
    fontFamily: theme.font.regular,
    textAlign: "center",
  },
  jumpQuickRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  jumpQuick: { flex: 1 },
  jumpGrid: { flex: 1 },
});
