import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressableScale } from "@/components/ui/PressableScale";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Surface } from "@/components/ui/Surface";
import { AuroraBackdrop } from "@/components/common/AuroraBackdrop";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { FeedbackSheet } from "@/components/feedback/FeedbackSheet";
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
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <View style={styles.container}>
      <AuroraBackdrop tone="violet" height={360} intensity={0.6} />
      {/* See Wallet: the tab bar names the tab, so the heading was one row of
          screen spent repeating it. No title also drops AppBar to compact. */}
      <AppTopBar />

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

        {/* Feedback lives here rather than on Profile: Profile is the account
            summary (who you are, what you've spent), reachable only by pushing
            from the top bar, while Settings is the tab-level list of things you
            DO with the app — and sending feedback is an action, not an account
            attribute. It is also one tap from the tab bar this way. */}
        <View style={styles.group}>
          <SectionHeader title={t.settings.support} icon="help-buoy-outline" inset={false} />

          <PressableScale onPress={() => setFeedbackOpen(true)} accessibilityLabel={t.feedback.entryTitle}>
            <Surface radius="xl" style={styles.row}>
              <View style={styles.iconTile}>
                <Ionicons name="chatbox-ellipses-outline" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.info}>
                <ThemedText variant="body" weight="semibold">
                  {t.feedback.entryTitle}
                </ThemedText>
                <ThemedText variant="caption" style={styles.subtitle} numberOfLines={2}>
                  {t.feedback.entrySubtitle}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textFaint} />
            </Surface>
          </PressableScale>
        </View>
      </ScrollView>

      <FeedbackSheet visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
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
