import { StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressableScale } from "@/components/ui/PressableScale";
import { Surface } from "@/components/ui/Surface";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { Language } from "@/localization/translations";

// Language names are deliberately NOT translated — each shown in its own
// script always, same reasoning as the web app's switcher. Exported so the
// Settings row can show the current one without a second copy of this list.
export const LANGUAGE_OPTIONS: { code: Language; label: string; flag: string }[] = [
  { code: "mm", label: "မြန်မာ", flag: "🇲🇲" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * The language switcher as a bottom sheet, replacing the pushed
 * LanguageSettings screen: Settings' other entries (Account, Support) all open
 * sheets, and a two-row choice never needed a whole screen. Picking a language
 * applies it at once and closes the sheet — there is nothing to confirm.
 */
export function LanguageSheet({ visible, onClose }: Props) {
  const { t, language, setLanguage } = useLanguage();

  const choose = (code: Language) => {
    setLanguage(code);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} snapHeight={300} title={t.settings.languageScreenTitle} showClose>
      <View style={styles.list}>
        {LANGUAGE_OPTIONS.map((option) => {
          const active = option.code === language;
          return (
            <PressableScale key={option.code} onPress={() => choose(option.code)} accessibilityLabel={option.label}>
              <Surface radius="xl" tone={active ? "accent" : "default"} style={styles.row}>
                <View style={styles.labelGroup}>
                  <View style={styles.flagTile}>
                    <ThemedText style={styles.flag}>{option.flag}</ThemedText>
                  </View>
                  <ThemedText variant="body" weight={active ? "semibold" : "regular"} numberOfLines={1} style={styles.label}>
                    {option.label}
                  </ThemedText>
                </View>
                <View style={[styles.check, active && styles.checkActive]}>
                  {active && <Ionicons name="checkmark" size={16} color={theme.colors.onPrimary} />}
                </View>
              </Surface>
            </PressableScale>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.sm, paddingTop: theme.spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minHeight: 68,
  },
  labelGroup: { flex: 1, flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  flagTile: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  flag: { fontSize: 20, lineHeight: 26 },
  label: { flex: 1 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
});
