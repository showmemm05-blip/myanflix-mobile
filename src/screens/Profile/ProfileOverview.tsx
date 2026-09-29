import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useSubscriptionStatus } from "@/hooks/useSubscription";
import { useLanguage } from "@/localization/LanguageProvider";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Surface } from "@/components/ui/Surface";
import { PressableScale } from "@/components/ui/PressableScale";
import { AuroraBackdrop } from "@/components/common/AuroraBackdrop";
import { StatCard } from "@/components/wallet/StatCard";
import { TopBar } from "@/components/layout/TopBar";
import { EditProfileSheet } from "@/components/profile/EditProfileSheet";
import { ChangePasswordSheet } from "@/components/profile/ChangePasswordSheet";
import { formatKyat } from "@/utils/currency";
import { displayNameOf, initials } from "@/utils/format";
import { theme } from "@/theme";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";

type Props = CompositeScreenProps<
  NativeStackScreenProps<RootStackParamList, "Profile">,
  BottomTabScreenProps<MainTabParamList>
>;

export function ProfileOverviewScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const walletQuery = useWallet();
  const subscriptionQuery = useSubscriptionStatus();
  const [editingProfile, setEditingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  /** Display name if they set one, else the username they sign in with. */
  const shownName = displayNameOf(user);

  const isSubscribed = subscriptionQuery.data?.isActive ?? false;
  const memberSince = user?.createdAt
    ? t.profile.memberSince.replace("{date}", new Date(user.createdAt).toLocaleDateString())
    : "";
  const expiresAt = subscriptionQuery.data?.expiresAt;
  const statusLabel =
    isSubscribed && expiresAt
      ? t.subscription.expiresOn.replace("{date}", new Date(expiresAt).toLocaleDateString())
      : isSubscribed
        ? t.subscription.active
        : t.subscription.inactive;
  // Gold is the premium role; an inactive subscription stays deliberately quiet.
  const statusColor = isSubscribed ? theme.colors.premium : theme.colors.textMuted;

  return (
    <View style={styles.container}>
      <AuroraBackdrop tone={isSubscribed ? "gold" : "violet"} height={400} intensity={0.7} />
      <TopBar title={t.nav.profile} onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard intensity={40} tint={isSubscribed ? theme.colors.premium : undefined}>
          <View style={styles.heroCenter}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatarGlow, { backgroundColor: statusColor + "26" }]} />
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={[styles.avatar, { borderColor: statusColor }]} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { borderColor: statusColor }]}>
                  {/* The letters have to agree with the name under them. */}
                  <ThemedText variant="display" weight="bold">
                    {initials(shownName)}
                  </ThemedText>
                </View>
              )}
              {isSubscribed && (
                <View style={styles.crown}>
                  <Ionicons name="diamond" size={13} color={theme.colors.onPremium} />
                </View>
              )}
            </View>

            <ThemedText variant="title" numberOfLines={1} style={styles.username}>
              {shownName}
            </ThemedText>

            <View style={[styles.statusChip, { backgroundColor: statusColor + "1F", borderColor: statusColor + "40" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <ThemedText variant="caption" weight="semibold" tabular style={{ color: statusColor }}>
                {statusLabel}
              </ThemedText>
            </View>

            {memberSince ? (
              <ThemedText variant="caption" tabular style={styles.memberSince}>
                {memberSince}
              </ThemedText>
            ) : null}
          </View>
        </GlassCard>

        <PressableScale
          /**
           * `popTo`, NOT `navigate`. Profile is a ROOT stack screen sitting
           * ABOVE the tab shell, so `navigate("Main", …)` does not return to
           * the app underneath — in react-navigation 7 it PUSHES a second
           * whole MainTabNavigator (a second tab bar, a second set of five
           * stacks), and the user needed three back presses to recover.
           * `popTo` pops the root stack back to the Main already below and
           * hands it the nested params. The inner `pop: true` stops a deep
           * Wallet stack from getting a duplicate Wallet pushed on top.
           */
          onPress={() =>
            navigation.popTo("Main", {
              screen: "WalletTab",
              params: { screen: "Wallet", pop: true },
            })
          }
          accessibilityLabel={t.wallet.balance}
        >
          <Surface radius="2xl" padded style={styles.walletCard}>
            <View style={styles.walletIconTile}>
              <Ionicons name="wallet" size={22} color={theme.colors.finance} />
            </View>
            <View style={styles.walletInfo}>
              <ThemedText variant="overline">{t.wallet.balance.toUpperCase()}</ThemedText>
              <ThemedText variant="title" tabular numberOfLines={1} style={styles.walletAmount}>
                {formatKyat(walletQuery.data?.balance ?? user?.balance ?? 0)}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textFaint} />
          </Surface>
        </PressableScale>

        <View style={styles.statsRow}>
          <StatCard
            icon="star"
            label={t.wallet.subscriptionStat}
            value={isSubscribed ? t.subscription.active : t.subscription.inactive}
            tone={isSubscribed ? "premium" : "neutral"}
          />
          {/* Emerald is the money role — violet is reserved for actions. */}
          <StatCard
            icon="trending-down"
            label={t.wallet.totalSpent}
            value={formatKyat(user?.totalSpent ?? 0)}
            tone="finance"
          />
        </View>

        {/* Your name and your password are account attributes, so they live
            here — this screen is who you are. Settings carries the same two
            rows as a shortcut (owner's request, 2026-09-22); both open the
            same sheets, so there is one behaviour to maintain. */}
        <View style={styles.group}>
          <SectionHeader title={t.profile.account} inset={false} icon="person-circle-outline" />
          <PressableScale onPress={() => setEditingProfile(true)} accessibilityLabel={t.profile.editProfile}>
            <Surface radius="xl" style={styles.row}>
              <View style={styles.rowIconTile}>
                <Ionicons name="person-outline" size={20} color={theme.colors.primary} />
              </View>
              <ThemedText variant="body" weight="semibold" style={styles.rowLabel}>
                {t.profile.editProfile}
              </ThemedText>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textFaint} />
            </Surface>
          </PressableScale>
          <PressableScale onPress={() => setChangingPassword(true)} accessibilityLabel={t.profile.changePassword}>
            <Surface radius="xl" style={styles.row}>
              <View style={styles.rowIconTile}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.colors.primary} />
              </View>
              <ThemedText variant="body" weight="semibold" style={styles.rowLabel}>
                {t.profile.changePassword}
              </ThemedText>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textFaint} />
            </Surface>
          </PressableScale>
        </View>

        <View style={styles.group}>
          <SectionHeader title={t.settings.preferences} inset={false} icon="options-outline" />
          <PressableScale
            /** `popTo` for the same reason as the wallet card above — `navigate` would push a second tab shell. */
            onPress={() =>
              navigation.popTo("Main", {
                screen: "SettingsTab",
                params: { screen: "Settings", pop: true },
              })
            }
            accessibilityLabel={t.profile.settings}
          >
            <Surface radius="xl" style={styles.row}>
              <View style={styles.rowIconTile}>
                <Ionicons name="settings-outline" size={20} color={theme.colors.primary} />
              </View>
              <ThemedText variant="body" weight="semibold" style={styles.rowLabel}>
                {t.profile.settings}
              </ThemedText>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textFaint} />
            </Surface>
          </PressableScale>
        </View>

        <Button
          title={t.common.logOut}
          // `void`, not a floating promise: logout() now clears local state in
          // a finally, so the only thing that can still reject here is the
          // SecureStore write — and an unhandled rejection at this call site
          // would be the only trace of it.
          onPress={() => {
            void logout();
          }}
          variant="soft"
          size="lg"
          icon="log-out-outline"
          color={theme.colors.danger}
          fullWidth
          style={styles.logout}
        />
      </ScrollView>

      {/* Both stay mounted while closed so they keep their close animation; the
          edit sheet needs a user to seed its field from, and this screen is
          only reachable while signed in. */}
      {user ? (
        <>
          <EditProfileSheet user={user} visible={editingProfile} onClose={() => setEditingProfile(false)} />
          <ChangePasswordSheet visible={changingPassword} onClose={() => setChangingPassword(false)} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  heroCenter: { alignItems: "center", gap: 4, paddingVertical: theme.spacing.sm },
  avatarWrap: { alignItems: "center", justifyContent: "center", marginBottom: theme.spacing.xs },
  avatarGlow: { position: "absolute", width: 112, height: 112, borderRadius: 56 },
  avatar: { width: 92, height: 92, borderRadius: theme.radius.pill, borderWidth: 2 },
  avatarFallback: { backgroundColor: theme.colors.secondary, alignItems: "center", justifyContent: "center" },
  crown: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.premium,
    borderWidth: 2,
    borderColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  username: { marginTop: 2 },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: theme.spacing.xs,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  memberSince: { color: theme.colors.textFaint, marginTop: 2 },
  walletCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, minHeight: 76 },
  walletIconTile: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.financeSoft,
    borderWidth: 1,
    borderColor: theme.colors.finance + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  walletInfo: { flex: 1, gap: 2 },
  walletAmount: { color: theme.colors.finance },
  statsRow: { flexDirection: "row", gap: theme.spacing.sm },
  group: { gap: theme.spacing.xs, marginTop: theme.spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    minHeight: 68,
  },
  rowIconTile: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primary + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1 },
  logout: { marginTop: theme.spacing.sm },
});
