import { useMemo, useState } from "react";
import { Linking, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedRef, useScrollOffset } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps } from "@react-navigation/native";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useSubscriptionStatus } from "@/hooks/useSubscription";
import { useWithdrawalCodeStatus } from "@/hooks/useWithdrawalCode";
import { useWatchHistoryInfinite } from "@/hooks/useVideo";
import { LIST_PAGE_SIZE, flattenPages } from "@/hooks/pagination";
import { useLanguage } from "@/localization/LanguageProvider";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { FadeInView } from "@/components/ui/FadeInView";
import { PressableScale } from "@/components/ui/PressableScale";
import { Skeleton } from "@/components/common/Skeleton";
import { TopBar } from "@/components/layout/TopBar";
import { GlassBarBackground, GlassTarget, useGlassBar } from "@/components/layout/GlassBar";
import { ProfileAvatar, ProfileGlow, SettingsGroup, SettingsRow } from "@/components/library/ProfileParts";
import { ProfileLibrary } from "@/components/library/ProfileLibrary";
import { useFavoriteTitles, type FavoriteTitle } from "@/components/library/favoriteTitles";
import { EditProfileSheet } from "@/components/profile/EditProfileSheet";
import { ChangePasswordSheet } from "@/components/profile/ChangePasswordSheet";
import { DeleteAccountSheet } from "@/components/profile/DeleteAccountSheet";
import { WithdrawalCodeSheet } from "@/components/withdrawal-code/WithdrawalCodeSheet";
import { CodeGlyph } from "@/components/withdrawal-code/CodeGlyph";
import { FeedbackSheet } from "@/components/feedback/FeedbackSheet";
import { LANGUAGE_OPTIONS, LanguageSheet } from "@/components/settings/LanguageSheet";
import { PRIVACY_POLICY_URL } from "@/utils/websiteLinks";
import { formatKyat } from "@/utils/currency";
import { displayNameOf, initials } from "@/utils/format";
import { theme, withAlpha } from "@/theme";
import type { ProfileStackParamList, RootStackParamList } from "@/navigation/types";

type Props = CompositeScreenProps<
  NativeStackScreenProps<ProfileStackParamList, "ProfileOverview">,
  NativeStackScreenProps<RootStackParamList>
>;

/**
 * The Profile page — opened from the avatar in the top bars, above the tabs,
 * with a back button (Profile is not a tab; owner, 2026-10-07). It is the
 * first page of the root "Profile" screen's own stack (ProfileStackNavigator).
 * Top to bottom: the profile header (avatar, name, subscription band,
 * balance), the "Your library" group (My List, Watch History, Downloads — the
 * only way to them since the Library tab went), then the settings.
 */
export function ProfileOverviewScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const walletQuery = useWallet();
  const subscriptionQuery = useSubscriptionStatus();
  const withdrawalCodeQuery = useWithdrawalCodeStatus();
  /**
   * The library rows read the SAME queries the Favorites and Watch History
   * pages use — the same history key and the same by-saved-ID favourite
   * lookups (useFavoriteTitles) — so "See all" opens them from cache instead
   * of fetching twice.
   */
  const historyQuery = useWatchHistoryInfinite({ limit: LIST_PAGE_SIZE });
  const historyEntries = useMemo(() => flattenPages(historyQuery.data?.pages), [historyQuery.data]);
  const favorites = useFavoriteTitles();
  // Presentation-only spinner state for pull-to-refresh.
  const [refreshing, setRefreshing] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [withdrawalCodeOpen, setWithdrawalCodeOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  /**
   * "Create code" with no code yet, "Change code" once there is one — and no
   * second line at all until the status is known, never a guess.
   */
  const withdrawalCodeAction = withdrawalCodeQuery.data
    ? withdrawalCodeQuery.data.hasCode
      ? t.withdrawalCode.profileChange
      : t.withdrawalCode.profileCreate
    : undefined;
  // The list is the sheet's; the row only needs to name the current one.
  const currentLanguage = LANGUAGE_OPTIONS.find((option) => option.code === language) ?? LANGUAGE_OPTIONS[0];
  // A local const so the null check below narrows inside the press handler.
  const privacyPolicyUrl = PRIVACY_POLICY_URL;

  /** Display name if they set one, else the username they sign in with. */
  const shownName = displayNameOf(user);

  const isSubscribed = subscriptionQuery.data?.isActive ?? false;
  const memberSince = user?.createdAt
    ? t.profile.memberSince.replace("{date}", new Date(user.createdAt).toLocaleDateString())
    : "";
  const expiresAt = subscriptionQuery.data?.expiresAt;
  const expiresLine =
    isSubscribed && expiresAt
      ? t.subscription.expiresOn.replace("{date}", new Date(expiresAt).toLocaleDateString())
      : null;

  /**
   * The Subscribe modal is registered on Profile's own stack (as on every tab
   * stack — MediaDetailParamList), so it simply opens over Profile and its
   * Close returns here.
   */
  const openSubscribe = () => navigation.navigate("Subscribe");

  /**
   * The library rows push onto Profile's own stack (ProfileStackNavigator
   * registers the pages and the movie/series pages), so back from any of
   * them returns to Profile.
   */
  const openFavorites = () => navigation.navigate("Favorites");
  const openHistory = () => navigation.navigate("WatchHistory");
  const openDownloads = () => navigation.navigate("DownloadCachePlaceholder");
  const openTitle = (item: FavoriteTitle) => {
    if (item.kind === "movie") navigation.navigate("MovieDetails", { movieId: item.id });
    else navigation.navigate("SeriesDetails", { seriesId: item.id });
  };
  // Like the Watch History page: a history title opens its page, which resumes it.
  const openMovie = (movieId: string) => navigation.navigate("MovieDetails", { movieId });

  /** Pull-to-refresh: the header's figures and both library rows. */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        subscriptionQuery.refetch(),
        walletQuery.refetch(),
        withdrawalCodeQuery.refetch(),
        historyQuery.refetch(),
        favorites.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * The glass bar (components/layout/GlassBar): the bar floats over the
   * page, transparent at the top — the glow shows through it as before — and
   * frosted only once the page has scrolled GLASS_START (150pt) under it: the
   * blur is not even mounted before that, so opening Profile can never show
   * glass. The glow is inside the blur target, so the glass blurs it too.
   */
  const glass = useGlassBar();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  useScrollOffset(scrollRef, glass.scrollY);

  return (
    <View style={styles.container}>
      <GlassTarget targetRef={glass.blurTarget}>
        {/* Behind the bar and the page; the page scrolls over it. */}
        <ProfileGlow premium={isSubscribed} />
        <Animated.ScrollView
          ref={scrollRef}
          // Above the tabs there is no dock to clear: just the phone's own edge.
          contentContainerStyle={[styles.content, { paddingTop: glass.barHeight, paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor={theme.colors.surface}
              progressViewOffset={glass.barHeight}
            />
          }
        >
          <FadeInView from="bottom" style={styles.identity}>
            <ProfileAvatar avatarUrl={user?.avatarUrl} initials={initials(shownName)} premium={isSubscribed} />
            <View style={styles.identityText}>
              {/* The letters in the avatar agree with this name. */}
              <ThemedText variant="title">{shownName}</ThemedText>
              {memberSince ? (
                <ThemedText variant="caption" weight="regular" tabular color={theme.colors.textFaint} style={styles.memberSince}>
                  {memberSince}
                </ThemedText>
              ) : null}
            </View>
          </FadeInView>

          <View style={styles.cards}>
            {/* The subscription band: Active + its expiry in gold, or a quiet
                Inactive with the gold Subscribe button. It replaces the old
                status chip and the separate Subscription stat. */}
            <View style={[styles.band, isSubscribed ? styles.bandPremium : styles.bandQuiet]}>
              <View
                style={styles.bandMain}
                accessible
                accessibilityLabel={[
                  t.wallet.subscriptionStat,
                  subscriptionQuery.isLoading
                    ? t.common.loading
                    : isSubscribed
                      ? t.subscription.active
                      : t.subscription.inactive,
                  expiresLine,
                ]
                  .filter(Boolean)
                  .join(", ")}
              >
                <View style={[styles.bandIcon, isSubscribed ? styles.bandIconPremium : styles.bandIconQuiet]}>
                  <Ionicons name="diamond" size={20} color={isSubscribed ? theme.colors.premium : theme.colors.textFaint} />
                </View>
                <View style={styles.bandText}>
                  <ThemedText
                    variant="caption"
                    weight="semibold"
                    color={isSubscribed ? theme.colors.textBody : theme.colors.textMuted}
                  >
                    {t.wallet.subscriptionStat}
                  </ThemedText>
                  {subscriptionQuery.isLoading ? (
                    <Skeleton width={96} height={18} radius="xs" style={styles.bandSkeleton} />
                  ) : (
                    <ThemedText variant="section" color={isSubscribed ? theme.colors.premium : theme.colors.text}>
                      {isSubscribed ? t.subscription.active : t.subscription.inactive}
                    </ThemedText>
                  )}
                  {expiresLine ? (
                    <ThemedText variant="caption" weight="regular" tabular color={theme.colors.textBody}>
                      {expiresLine}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
              {/* Only once the status is known to be inactive — never a flash of
                  "Subscribe" while it loads or after it failed to load. When the
                  row is too narrow (320pt, large text) it wraps under the status. */}
              {subscriptionQuery.data && !subscriptionQuery.data.isActive ? (
                <Button
                  title={t.subscription.subscribeButton}
                  onPress={openSubscribe}
                  variant="premium"
                  style={styles.bandButton}
                />
              ) : null}
            </View>

            <PressableScale
              /**
               * `popTo`, NOT `navigate`. Profile is a ROOT stack screen sitting
               * ABOVE the tab shell, so `navigate("Main", …)` does not return to
               * the app underneath — in react-navigation 7 it PUSHES a second
               * whole MainTabNavigator (a second tab bar, a second set of tab
               * stacks), and the user needed three back presses to recover.
               * `popTo` pops the root stack back to the Main already below and
               * hands it the nested params. The inner `pop: true` stops a deep
               * Wallet stack from getting a duplicate Wallet pushed on top.
               * (Profile's own little stack has no "Main", so the action
               * passes up to the root stack, which does.)
               */
              onPress={() =>
                navigation.popTo("Main", {
                  screen: "WalletTab",
                  params: { screen: "Wallet", pop: true },
                })
              }
              accessibilityLabel={t.wallet.balance}
              style={styles.balance}
            >
              <View style={styles.balanceIcon}>
                <Ionicons name="wallet-outline" size={22} color={theme.colors.finance} />
              </View>
              <View style={styles.balanceText}>
                <ThemedText variant="caption" weight="semibold" color={theme.colors.textBody}>
                  {t.wallet.balance}
                </ThemedText>
                <ThemedText variant="title" tabular color={theme.colors.finance} style={styles.balanceAmount}>
                  {formatKyat(walletQuery.data?.balance ?? user?.balance ?? 0)}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </PressableScale>
          </View>

          {/* "Your library" (owner, 2026-10-07): the Library tab is gone, so
              My List, Watch History and Downloads come back here — they left
              Profile on 2026-10-05 only because the Library tab duplicated
              them. */}
          <View style={styles.sectionFirst}>
            <ProfileLibrary
              favorites={favorites}
              history={{
                entries: historyEntries,
                total: historyQuery.data?.pages[0]?.total ?? historyEntries.length,
                isLoading: historyQuery.isLoading,
                isError: historyQuery.isError,
                refetch: () => {
                  void historyQuery.refetch();
                },
              }}
              onOpenFavorites={openFavorites}
              onOpenHistory={openHistory}
              onOpenDownloads={openDownloads}
              onOpenTitle={openTitle}
              onOpenMovie={openMovie}
            />
          </View>

          {/* Everything the Settings tab used to hold lives here since it was
              removed (owner, 2026-10-01), in the owner's order: Preferences,
              Support, Account. */}
          <View style={styles.sectionAfterLibrary}>
            <SettingsGroup title={t.settings.preferences}>
              <SettingsRow
                icon="globe-outline"
                label={t.settings.language}
                subtitle={currentLanguage.label}
                leadingSubtitle={currentLanguage.flag}
                onPress={() => setLanguageOpen(true)}
                accessibilityLabel={t.settings.language}
              />
            </SettingsGroup>
          </View>

          <View style={styles.section}>
            <SettingsGroup title={t.settings.support}>
              <SettingsRow
                icon="chatbox-ellipses-outline"
                label={t.feedback.entryTitle}
                subtitle={t.feedback.entrySubtitle}
                onPress={() => setFeedbackOpen(true)}
                accessibilityLabel={t.feedback.entryTitle}
              />
              {/* The stores require a privacy policy reachable from inside the
                  app (H-16). It lives on the website's /privacy page and opens in
                  the phone's browser; a build with no website address shows no
                  row rather than a dead one. */}
              {privacyPolicyUrl && (
                <SettingsRow
                  icon="shield-checkmark-outline"
                  label={t.settings.privacyPolicy}
                  subtitle={t.settings.privacyPolicySubtitle}
                  onPress={() => {
                    Linking.openURL(privacyPolicyUrl).catch(() => {});
                  }}
                  accessibilityLabel={t.settings.privacyPolicy}
                  accessibilityRole="link"
                  external
                />
              )}
            </SettingsGroup>
          </View>

          <View style={styles.section}>
            <SettingsGroup title={t.profile.account}>
              <SettingsRow
                icon="person-outline"
                label={t.profile.editProfile}
                onPress={() => setEditingProfile(true)}
                accessibilityLabel={t.profile.editProfile}
              />
              <SettingsRow
                icon="lock-closed-outline"
                label={t.profile.changePassword}
                onPress={() => setChangingPassword(true)}
                accessibilityLabel={t.profile.changePassword}
              />
              {/* The 6-digit code every withdrawal asks for (WithdrawalCode
                  Flow.dc.html, D0): the boards' shield-and-lock glyph. */}
              <SettingsRow
                icon="keypad-outline"
                glyph={<CodeGlyph name="shieldLock" size={22} color={theme.colors.textBody} />}
                label={t.withdrawalCode.profileRow}
                subtitle={withdrawalCodeAction}
                onPress={() => setWithdrawalCodeOpen(true)}
                accessibilityLabel={
                  withdrawalCodeAction
                    ? `${t.withdrawalCode.profileRow}, ${withdrawalCodeAction}`
                    : t.withdrawalCode.profileRow
                }
              />
              {/* In-app account deletion is an App Store / Play requirement for
                  any app that creates accounts (H-16). Last in the group and in
                  the danger colour, so it is never the row a thumb lands on by
                  habit; the sheet explains, and a dialog asks once more. */}
              <SettingsRow
                icon="trash-outline"
                label={t.profile.deleteAccount}
                subtitle={t.profile.deleteAccountEntrySubtitle}
                onPress={() => setDeletingAccount(true)}
                accessibilityLabel={t.profile.deleteAccount}
                danger
              />
            </SettingsGroup>
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
            style={styles.logout}
          />
        </Animated.ScrollView>
      </GlassTarget>

      <GlassBarBackground scrollY={glass.scrollY} height={glass.barHeight} blurTarget={glass.blurTarget} />
      <TopBar
        title={t.nav.profile}
        floating
        touchThrough
        onLayout={glass.onBarLayout}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t.common.back}
      />

      {/* All stay mounted while closed so they keep their close animation; the
          edit sheet needs a user to seed its field from, and this screen is
          only reachable while signed in. */}
      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
      <FeedbackSheet visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      {user ? (
        <>
          <EditProfileSheet user={user} visible={editingProfile} onClose={() => setEditingProfile(false)} />
          <ChangePasswordSheet visible={changingPassword} onClose={() => setChangingPassword(false)} />
          <DeleteAccountSheet visible={deletingAccount} onClose={() => setDeletingAccount(false)} />
          <WithdrawalCodeSheet visible={withdrawalCodeOpen} onClose={() => setWithdrawalCodeOpen(false)} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1 },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: 20,
  },
  identityText: { flex: 1, minWidth: 0 },
  memberSince: { marginTop: theme.spacing.xs },
  cards: { paddingHorizontal: theme.layout.screenPadding, paddingTop: theme.spacing.lg, gap: 10 },
  band: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 14,
    rowGap: 12,
    minHeight: 92,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderRadius: 16,
  },
  bandPremium: { backgroundColor: withAlpha(theme.colors.premium, 0.12) },
  bandQuiet: { backgroundColor: withAlpha(theme.colors.text, 0.06) },
  bandIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  bandIconPremium: { backgroundColor: theme.colors.premiumSoft },
  bandIconQuiet: { backgroundColor: theme.colors.tonalSoft },
  /** Grows into the row; below ~180pt left over, the Subscribe button wraps underneath. */
  bandMain: { flexDirection: "row", alignItems: "center", gap: 14, flexGrow: 1, flexShrink: 1, flexBasis: 160 },
  /**
   * A token grow: beside the status it takes (almost) none of the spare room
   * and stays its own size; wrapped onto a line of its own, it is the only
   * item there and so takes the whole width.
   */
  bandButton: { flexGrow: 0.001 },
  bandText: { flex: 1, minWidth: 0 },
  bandSkeleton: { marginVertical: 3 },
  balance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 72,
    paddingLeft: theme.spacing.md,
    paddingRight: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: withAlpha(theme.colors.finance, 0.1),
  },
  balanceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.financeSoft,
  },
  balanceText: { flex: 1, minWidth: 0 },
  /** 20pt extra-bold figures. */
  balanceAmount: { fontSize: 20 },
  /**
   * "Your library" starts 36pt under the subscription band and balance — the
   * break the page has always used before its first section; the groups
   * after it keep the tighter `section` rhythm.
   */
  sectionFirst: { marginTop: 36 },
  /** Preferences, after the library's last banner: a whole section's break. */
  sectionAfterLibrary: { marginTop: 36 },
  section: { marginTop: theme.spacing.xl },
  logout: { marginTop: theme.spacing.lg, marginHorizontal: theme.layout.screenPadding },
});
