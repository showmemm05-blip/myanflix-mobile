import { useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressableScale } from "@/components/ui/PressableScale";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Surface } from "@/components/ui/Surface";
import { AuroraBackdrop } from "@/components/common/AuroraBackdrop";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { FeedbackSheet } from "@/components/feedback/FeedbackSheet";
import { LANGUAGE_OPTIONS, LanguageSheet } from "@/components/settings/LanguageSheet";
import { EditProfileSheet } from "@/components/profile/EditProfileSheet";
import { ChangePasswordSheet } from "@/components/profile/ChangePasswordSheet";
import { DeleteAccountSheet } from "@/components/profile/DeleteAccountSheet";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/localization/LanguageProvider";
import { PRIVACY_POLICY_URL } from "@/utils/websiteLinks";
import { theme } from "@/theme";

export function SettingsScreen() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  // The list is the sheet's; the row only needs to name the current one.
  const current = LANGUAGE_OPTIONS.find((option) => option.code === language) ?? LANGUAGE_OPTIONS[0];
  const [languageOpen, setLanguageOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  // A local const so the null check below narrows inside the press handler.
  const privacyPolicyUrl = PRIVACY_POLICY_URL;

  return (
    <View style={styles.container}>
      <AuroraBackdrop tone="violet" height={360} intensity={0.6} />
      {/* See Wallet: the tab bar names the tab, so the heading was one row of
          screen spent repeating it. No title also drops AppBar to compact. */}
      <AppTopBar />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* The same two sheets Profile opens. Profile remains the account
            summary; this is the shortcut the owner asked for, one tap from the
            tab bar, so the two entries are deliberately identical. Hidden
            without a signed-in user: the sheets need one. */}
        {user && (
          <View style={styles.group}>
            <SectionHeader title={t.profile.account} icon="person-circle-outline" inset={false} />

            <PressableScale onPress={() => setEditingProfile(true)} accessibilityLabel={t.profile.editProfile}>
              <Surface radius="xl" style={styles.row}>
                <View style={styles.iconTile}>
                  <Ionicons name="person-outline" size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.info}>
                  <ThemedText variant="body" weight="semibold">
                    {t.profile.editProfile}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textFaint} />
              </Surface>
            </PressableScale>

            <PressableScale onPress={() => setChangingPassword(true)} accessibilityLabel={t.profile.changePassword}>
              <Surface radius="xl" style={styles.row}>
                <View style={styles.iconTile}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.info}>
                  <ThemedText variant="body" weight="semibold">
                    {t.profile.changePassword}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textFaint} />
              </Surface>
            </PressableScale>

            {/* In-app account deletion is an App Store / Play requirement for
                any app that creates accounts (H-16). Last in the group and in
                the danger colour, so it is never the row a thumb lands on by
                habit; the sheet explains, and a dialog asks once more. */}
            <PressableScale onPress={() => setDeletingAccount(true)} accessibilityLabel={t.profile.deleteAccount}>
              <Surface radius="xl" style={styles.row}>
                <View style={[styles.iconTile, styles.dangerTile]}>
                  <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                </View>
                <View style={styles.info}>
                  <ThemedText variant="body" weight="semibold" color={theme.colors.danger}>
                    {t.profile.deleteAccount}
                  </ThemedText>
                  <ThemedText variant="caption" style={styles.subtitle} numberOfLines={2}>
                    {t.profile.deleteAccountEntrySubtitle}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textFaint} />
              </Surface>
            </PressableScale>
          </View>
        )}

        <View style={styles.group}>
          <SectionHeader title={t.settings.preferences} icon="options-outline" inset={false} />

          <PressableScale onPress={() => setLanguageOpen(true)} accessibilityLabel={t.settings.language}>
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

          {/* The stores require a privacy policy reachable from inside the
              app (H-16). It lives on the website's /privacy page and opens in
              the phone's browser; a build with no website address shows no
              row rather than a dead one. */}
          {privacyPolicyUrl && (
            <PressableScale
              onPress={() => {
                Linking.openURL(privacyPolicyUrl).catch(() => {});
              }}
              accessibilityLabel={t.settings.privacyPolicy}
              accessibilityRole="link"
            >
              <Surface radius="xl" style={styles.row}>
                <View style={styles.iconTile}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.info}>
                  <ThemedText variant="body" weight="semibold">
                    {t.settings.privacyPolicy}
                  </ThemedText>
                  <ThemedText variant="caption" style={styles.subtitle} numberOfLines={2}>
                    {t.settings.privacyPolicySubtitle}
                  </ThemedText>
                </View>
                <Ionicons name="open-outline" size={20} color={theme.colors.textFaint} />
              </Surface>
            </PressableScale>
          )}
        </View>
      </ScrollView>

      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
      <FeedbackSheet visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      {user && (
        <>
          <EditProfileSheet user={user} visible={editingProfile} onClose={() => setEditingProfile(false)} />
          <ChangePasswordSheet visible={changingPassword} onClose={() => setChangingPassword(false)} />
          <DeleteAccountSheet visible={deletingAccount} onClose={() => setDeletingAccount(false)} />
        </>
      )}
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
  dangerTile: { backgroundColor: theme.colors.dangerSoft, borderColor: theme.colors.danger + "33" },
  info: { flex: 1, gap: 2 },
  subtitle: { color: theme.colors.textMuted },
});
