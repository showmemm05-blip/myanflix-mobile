import { ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
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
import { formatKyat } from "@/utils/currency";
import { theme } from "@/theme";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";

type Props = CompositeScreenProps<
  NativeStackScreenProps<RootStackParamList, "Profile">,
  BottomTabScreenProps<MainTabParamList>
>;

function initials(name: string | undefined): string {
  if (!name) return "?";
  return name.slice(0, 2).toUpperCase();
}

export function ProfileOverviewScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const walletQuery = useWallet();
  const subscriptionQuery = useSubscriptionStatus();

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
                  <ThemedText variant="display" weight="bold">
                    {initials(user?.username)}
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
              {user?.username}
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
          onPress={() => navigation.navigate("Main", { screen: "WalletTab", params: { screen: "Wallet" } })}
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

        <View style={styles.group}>
          <SectionHeader title={t.settings.preferences} inset={false} icon="options-outline" />
          <PressableScale
            onPress={() => navigation.navigate("Main", { screen: "SettingsTab", params: { screen: "Settings" } })}
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
          onPress={() => logout()}
          variant="soft"
          size="lg"
          icon="log-out-outline"
          color={theme.colors.danger}
          fullWidth
          style={styles.logout}
        />
      </ScrollView>
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
