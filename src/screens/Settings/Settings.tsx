import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressableScale } from "@/components/ui/PressableScale";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Surface } from "@/components/ui/Surface";
import { AuroraBackdrop } from "@/components/common/AuroraBackdrop";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { SettingsStackParamList } from "@/navigation/types";
import type { Language } from "@/localization/translations";

type Props = NativeStackScreenProps<SettingsStackParamList, "Settings">;

const LANGUAGE_META: Record<Language, { label: string; flag: string }> = {
  mm: { label: "မြန်မာ", flag: "🇲🇲" },
  en: { label: "English", flag: "🇬🇧" },
};

export function SettingsScreen({ navigation }: Props) {
  const { t, language } = useLanguage();
  const current = LANGUAGE_META[language];

  return (
    <View style={styles.container}>
      <AuroraBackdrop tone="violet" height={360} intensity={0.6} />
      <AppTopBar title={t.profile.settings} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          <SectionHeader title={t.settings.preferences} icon="options-outline" inset={false} />

          <PressableScale onPress={() => navigation.navigate("LanguageSettings")} accessibilityLabel={t.settings.language}>
            <Surface radius="xl" style={styles.row}>
              <View style={styles.iconTile}>
                <Ionicons name="language" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.info}>
                <ThemedText variant="body" weight="semibold">
                  {t.settings.language}
                </ThemedText>
                <ThemedText variant="caption" style={styles.subtitle} numberOfLines={1}>
                  {current.flag}  {current.label}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textFaint} />
            </Surface>
          </PressableScale>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.layout.tabBarClearance,
    gap: theme.spacing.md,
  },
  group: { gap: theme.spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    minHeight: 72,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primary + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: 2 },
  subtitle: { color: theme.colors.textMuted },
});
