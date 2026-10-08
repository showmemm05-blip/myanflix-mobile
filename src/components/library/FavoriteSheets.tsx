import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ThemedText } from "@/components/ui/ThemedText";
import { PosterThumb } from "@/components/library/PosterThumb";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/** The grabber header without a title: 8 + 4 + 8. */
const BARE_HEADER = 20;
/** The grabber header with a title row: 8 + 4 + 12 + 44 + 8. */
const TITLED_HEADER = 76;
/** Two 52pt buttons, 10 apart, under the footer's 16pt top padding. */
const TWO_BUTTON_FOOTER = 16 + 52 + 10 + 52;
const ONE_BUTTON_FOOTER = 16 + 52;

/**
 * BottomSheet takes a fixed height, so it is worked out here from the content
 * and the phone's font scale — a Burmese title at 2× still gets its room, and
 * the body scrolls if it ever needs more.
 */
function useSheetHeight(header: number, body: number, footer: number): number {
  const insets = useSafeAreaInsets();
  return header + body + footer + Math.max(insets.bottom, theme.spacing.md) + theme.spacing.md;
}

/**
 * Favorites.dc.html "remove": the confirm the heart quick action and the
 * long-press both open — the poster, "Remove from favorites", the title, then
 * crimson Remove over a quiet Cancel. It replaces the native Alert with the
 * same strings and the same single mutation.
 */
export function RemoveFavoriteSheet({
  visible,
  title,
  posterUrl,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  posterUrl: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { fontScale } = useWindowDimensions();
  const height = useSheetHeight(BARE_HEADER, 20 + Math.max(96, 92 * fontScale), TWO_BUTTON_FOOTER);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapHeight={height}
      footer={
        <View style={styles.footer}>
          <Button title={t.common.remove} onPress={onConfirm} size="lg" />
          <Button title={t.common.cancel} onPress={onClose} variant="secondary" size="lg" />
        </View>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.removeBody}>
        <PosterThumb uri={posterUrl} width={64} height={96} radius={8} fallbackIconSize={18} />
        <View style={styles.removeText}>
          <ThemedText variant="section" accessibilityRole="header">
            {t.movie.removeFromFavorites}
          </ThemedText>
          <ThemedText variant="body" color={theme.colors.textBody} style={styles.removeTitle}>
            {title}
          </ThemedText>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

export type FavoriteSort = "recent" | "title" | "year" | "rating";

/** Favorites.dc.html "sort": four radio rows that apply as they are tapped, and a crimson Done. */
export function FavoritesSortSheet({
  visible,
  value,
  options,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: FavoriteSort;
  options: { value: FavoriteSort; label: string }[];
  onChange: (value: FavoriteSort) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { fontScale } = useWindowDimensions();
  const rowHeight = Math.max(52, Math.ceil(30 * fontScale));
  const height = useSheetHeight(TITLED_HEADER, theme.spacing.xs + options.length * rowHeight, ONE_BUTTON_FOOTER);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t.library.sortBy}
      snapHeight={height}
      footer={<Button title={t.library.done} onPress={onClose} size="lg" />}
    >
      <ScrollView showsVerticalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={t.library.sortBy}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              accessibilityLabel={option.label}
              style={({ pressed }) => [styles.radioRow, pressed && styles.radioPressed]}
            >
              <ThemedText variant="body" weight="semibold" style={styles.radioLabel}>
                {option.label}
              </ThemedText>
              <View style={[styles.radio, checked ? styles.radioOn : styles.radioOff]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 10 },
  removeBody: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingTop: 12 },
  removeText: { flex: 1, minWidth: 0 },
  removeTitle: { marginTop: theme.spacing.xs },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 52,
    paddingVertical: 6,
  },
  radioPressed: { opacity: 0.7 },
  /** 16pt, a step above body — the board's sort rows. */
  radioLabel: { flex: 1, fontSize: 16 },
  radio: { width: 22, height: 22, borderRadius: 11 },
  /** Selected: a crimson ring 7pt thick round a white centre. */
  radioOn: { borderWidth: 7, borderColor: theme.colors.primary, backgroundColor: theme.colors.play },
  radioOff: { borderWidth: 2, borderColor: theme.colors.textDecor },
});
