import { View, StyleSheet } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useLanguage } from "@/localization/LanguageProvider";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressableScale } from "@/components/ui/PressableScale";
import { Surface } from "@/components/ui/Surface";
import { TopBar } from "@/components/layout/TopBar";
import { theme } from "@/theme";
import type { SettingsStackParamList } from "@/navigation/types";
import type { Language } from "@/localization/translations";

type Props = NativeStackScreenProps<SettingsStackParamList, "LanguageSettings">;

// Language names are deliberately NOT translated — each shown in its own
// script always, same reasoning as the web app's switcher.
const OPTIONS: { code: Language; label: string; flag: string }[] = [
  { code: "mm", label: "မြန်မာ", flag: "🇲🇲" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

export function LanguageSettingsScreen({ navigation }: Props) {
  const { t, language, setLanguage } = useLanguage();

  return (
    <View style={styles.container}>
      <TopBar
        title={t.settings.languageScreenTitle}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t.common.back}
      />

      <View style={styles.content}>
        {OPTIONS.map((option) => {
          const active = option.code === language;
          return (
            <PressableScale key={option.code} onPress={() => setLanguage(option.code)} accessibilityLabel={option.label}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
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
