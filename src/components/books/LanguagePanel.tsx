import { Pressable, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { languageLabel, languageSubLabel } from "@/utils/bookLanguages";
import { theme } from "@/theme";
import type { BookEdition } from "@/types/book";

interface Props {
  editions: BookEdition[];
  selectedEditionId: string | null | undefined;
  onSelect: (edition: BookEdition) => void;
}

/**
 * "Available languages" — the edition picker (BookDetail.dc.html). Language is
 * the organising axis of a book (each edition holds its own chapters and its
 * own bookmark), so choosing a tile re-points everything below it on the
 * detail screen. Two tiles a row; the chosen one takes the crimson tint and a
 * check, and "Reading in …" under the heading names it in words.
 */
export function LanguagePanel({ editions, selectedEditionId, onSelect }: Props) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  if (editions.length === 0) return null;

  const selected = editions.find((edition) => edition.id === selectedEditionId) ?? null;
  const single = editions.length === 1;

  return (
    <View>
      <ThemedText variant="section" accessibilityRole="header">
        {t.books.availableLanguages}
      </ThemedText>
      {!single && selected && (
        <ThemedText variant="caption" color={theme.colors.textFaint} style={styles.readingIn}>
          {t.books.readingIn.replace("{language}", languageLabel(selected.language))}
        </ThemedText>
      )}

      <View style={styles.grid}>
        {single ? (
          <View style={[styles.tile, styles.tileIdle]}>
            <LanguageLabels code={editions[0].language} />
          </View>
        ) : (
          editions.map((edition) => {
            const isSelected = edition.id === selectedEditionId;
            return (
              <Pressable
                key={edition.id}
                onPress={() => onSelect(edition)}
                accessibilityRole="button"
                accessibilityLabel={languageLabel(edition.language)}
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [
                  styles.tile,
                  isSelected ? styles.tileSelected : styles.tileIdle,
                  pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
                ]}
              >
                <LanguageLabels code={edition.language} />
                {isSelected && <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />}
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

function LanguageLabels({ code }: { code: string }) {
  const sub = languageSubLabel(code);
  return (
    <View style={styles.labels}>
      <ThemedText variant="body" weight="bold" style={styles.label}>
        {languageLabel(code)}
      </ThemedText>
      {sub && (
        <ThemedText variant="label" weight="regular" color={theme.colors.textMuted} style={styles.sub}>
          {sub}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  readingIn: { marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 14 },
  tile: {
    flexGrow: 1,
    flexBasis: "40%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    minHeight: 64,
    paddingLeft: theme.spacing.md,
    paddingRight: 14,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
  },
  tileIdle: { backgroundColor: theme.colors.surfaceElevated },
  tileSelected: { backgroundColor: theme.colors.primarySoft },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.7 },
  labels: { flex: 1 },
  label: { fontSize: 16 },
  sub: { letterSpacing: 0 },
});
