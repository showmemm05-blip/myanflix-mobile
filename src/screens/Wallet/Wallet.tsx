import { useEffect, useRef, useState } from "react";
import { Platform, RefreshControl, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { FadeInView } from "@/components/ui/FadeInView";
import { ThemedText } from "@/components/ui/ThemedText";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { GlassBarBackground, GlassTarget } from "@/components/layout/GlassBar";
import { BalanceHero } from "@/components/wallet/BalanceHero";
import { DepositSheet } from "@/components/wallet/DepositSheet";
import { useBalanceVisibility } from "@/components/wallet/MaskedAmount";
import { QuickActions } from "@/components/wallet/QuickActions";
import { RecentActivity, type ActivitySegment } from "@/components/wallet/RecentActivity";
import { WalletHeroArt } from "@/components/wallet/WalletHeroArt";
import { WithdrawSheet } from "@/components/wallet/WithdrawSheet";
import { useDockClearance } from "@/hooks/useDockClearance";
import { useWallet, useTransactions } from "@/hooks/useWallet";
import { useDeposits } from "@/hooks/useDeposits";
import { useWithdrawals } from "@/hooks/useWithdrawals";
import { useWalletAnnouncements } from "@/hooks/useWalletAnnouncements";
import { ROW_INSET, useWalletLayout } from "@/hooks/useWalletLayout";
import { usePendingRequests } from "@/hooks/usePendingRequests";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { WalletStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<WalletStackParamList, "Wallet">;

/** Width of the left column (title, balance, actions) once the wallet splits in two. */
const LEFT_COLUMN = 420;
/**
 * AppTopBar's wordmark line (22/28). Its font scale is not capped, so at large
 * OS text sizes this line, not the 44pt targets, sets the bar's height.
 */
const WORDMARK_LINE = 28;
/**
 * The root bar's control row: 8pt above a 44pt row (AppBar) — taller once the
 * OS text size grows the wordmark past 44pt (~64pt at 2.0). The same rule as
 * the Arcade's bar. The page title starts 44pt under it — the board's 56pt
 * header plus its 40pt of air.
 */
function barRowHeight(fontScale: number): number {
  return theme.spacing.sm + Math.max(theme.layout.minTouch, Math.ceil(WORDMARK_LINE * fontScale));
}
const TITLE_GAP = 44;
/**
 * iOS only: how long a Deposit asked for by another screen (Subscribe's "Add
 * money") waits before it opens. That screen closes its own native modal in
 * the same tick, and UIKit silently drops a presentation that starts while
 * another is still animating away — React Native's Modal then believes it is
 * up and never retries. A sheet dismissal takes ~0.35s; this waits it out
 * with headroom. Android's Modal is a dialog with no such rule.
 */
const OPEN_DEPOSIT_DELAY_MS = Platform.OS === "ios" ? 650 : 0;
/** The board's gap from the balance block (or its hold line) down to the action tiles. */
const ACTIONS_GAP = 28;
/** The hero art runs 8pt past the action tiles, then the recent list starts 28pt below them. */
const HERO_TAIL = theme.spacing.sm;
const RECENT_GAP = 28;

/**
 * The wallet tab (Wallet.dc.html): a hero — decorative marquee art under the
 * floating root bar, the page title, the balance and the three action tiles —
 * then the recent activity. One scroll; on wide tablets the activity moves to
 * a second column beside the hero block.
 *
 * Route param `openDeposit` (e.g. Subscribe's "Add money") opens the Deposit
 * flow once on arrival — on iOS after OPEN_DEPOSIT_DELAY_MS — and is then
 * cleared, so coming back to the tab later does not open it again.
 */
export function WalletScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  const layout = useWalletLayout();
  const insets = useSafeAreaInsets();
  const dockClearance = useDockClearance();
  const walletQuery = useWallet();
  const transactionsQuery = useTransactions({ limit: 5 });
  const depositsQuery = useDeposits({ limit: 5 });
  const withdrawalsQuery = useWithdrawals({ limit: 5 });
  const pending = usePendingRequests();
  const { hidden, toggle: toggleHidden } = useBalanceVisibility();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [segment, setSegment] = useState<ActivitySegment>("all");
  // Presentation-only: drives the pull-to-refresh spinner while the queries
  // this screen already owns re-run. No new data source.
  const [refreshing, setRefreshing] = useState(false);
  /** Bottom of the hero block in the scroll content, so the art ends just under the tiles. */
  const [heroBottom, setHeroBottom] = useState(0);

  const openDepositParam = route.params?.openDeposit;
  useEffect(() => {
    if (!openDepositParam) return;
    // Clearing the param inside the timer (not before it) keeps this effect
    // from re-running and cancelling the timer it just set.
    const timer = setTimeout(() => {
      navigation.setParams({ openDeposit: undefined });
      // Moved to another tab while it waited: never raise a sheet over a
      // screen that did not ask for it.
      if (navigation.isFocused()) setDepositOpen(true);
    }, OPEN_DEPOSIT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [openDepositParam, navigation]);

  const wallet = walletQuery.data;
  // No wallet to show — a failed first fetch, or a success that came back
  // empty — is an error, never a made-up "0 Ks". A failed REFETCH keeps the
  // last real balance on screen and marks it stale instead.
  const heroState = walletQuery.isLoading ? "loading" : wallet ? "ready" : "error";

  useWalletAnnouncements({
    balance: wallet?.balance,
    hidden,
    deposits: depositsQuery.data?.items,
    withdrawals: withdrawalsQuery.data?.items,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        walletQuery.refetch(),
        transactionsQuery.refetch(),
        depositsQuery.refetch(),
        withdrawalsQuery.refetch(),
        pending.refetchAll(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * The Deposit tile (and the empty list's Deposit) can only be pressed while
   * no sheet covers it — so a flag that already says "open" means the sheet
   * never reached the screen (a presentation iOS dropped). Lower the flag and
   * raise it a frame later, so the Modal presents afresh instead of the tile
   * going dead until a restart.
   */
  const openDeposit = () => {
    if (!depositOpen) {
      setDepositOpen(true);
      return;
    }
    setDepositOpen(false);
    requestAnimationFrame(() => setDepositOpen(true));
  };
  const openHistory = () => navigation.navigate("Transactions");

  /**
   * The root bar floats over the page: at rest it lies on the hero art (its
   * own soft scrim keeps the wordmark and the clock legible); once the page
   * scrolls, the frosted glass (components/layout/GlassBar) fades in behind
   * it — never a solid strip (the owner, 2026-10-02) — so rows passing under
   * the wordmark and the clock are blurred and dimmed.
   */
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const blurTarget = useRef<View>(null);

  const barHeight = insets.top + barRowHeight(layout.fontScale);
  const contentTop = barHeight + TITLE_GAP;
  const columnMargin = layout.columnMargin(layout.contentMaxWidth);
  // The hero block always starts at the top of the content (both layouts), so its height is enough.
  const onHeroLayout = (event: LayoutChangeEvent) => setHeroBottom(contentTop + event.nativeEvent.layout.height);
  // Until measured, a typical hero's height stands in so the art is there from the first frame.
  const artHeight = (heroBottom || contentTop + 330) + HERO_TAIL;

  const primary = (
    <View onLayout={onHeroLayout}>
      <FadeInView from="bottom" duration={320}>
        <ThemedText
          variant="display"
          accessibilityRole="header"
          maxFontSizeMultiplier={1.4}
          style={styles.title}
        >
          {t.nav.wallet}
        </ThemedText>
        <View style={styles.balance}>
          <BalanceHero
            state={heroState}
            stale={!!wallet && walletQuery.isError}
            balance={wallet?.balance ?? 0}
            hidden={hidden}
            onToggleHidden={() => {
              if (wallet) toggleHidden(wallet.balance);
            }}
            heldAmount={pending.heldAmount}
            onRetry={() => void walletQuery.refetch()}
            retrying={walletQuery.isFetching}
          />
        </View>
      </FadeInView>
      <FadeInView delay={60} duration={240} style={styles.actions}>
        <QuickActions onDeposit={openDeposit} onWithdraw={() => setWithdrawOpen(true)} onHistory={openHistory} />
      </FadeInView>
    </View>
  );

  const activity = (
    <FadeInView delay={120} duration={240}>
      <RecentActivity
        segment={segment}
        onSegmentChange={setSegment}
        ledger={transactionsQuery}
        deposits={depositsQuery}
        withdrawals={withdrawalsQuery}
        pendingDeposits={pending.pendingDepositRows}
        hidden={hidden}
        onSeeAll={openHistory}
        onDeposit={openDeposit}
      />
    </FadeInView>
  );

  return (
    <View style={styles.container}>
      {/* The page the glass blurs; one pixel down so TalkBack reads the bar first (see GlassTarget). */}
      <GlassTarget targetRef={blurTarget}>
        <Animated.ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: dockClearance }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor={theme.colors.surface}
              progressViewOffset={barHeight}
            />
          }
        >
          <WalletHeroArt height={artHeight} />

          <View style={{ paddingTop: contentTop, paddingHorizontal: columnMargin }}>
            {layout.isTwoColumn ? (
              // One scroll, two columns; a screen reader finishes the left column
              // (title → balance → actions) before it reaches the activity.
              <View style={styles.columns}>
                <View style={styles.leftColumn}>{primary}</View>
                <View style={styles.rightColumn}>{activity}</View>
              </View>
            ) : (
              <>
                {primary}
                <View style={styles.recent}>{activity}</View>
              </>
            )}
          </View>
        </Animated.ScrollView>
      </GlassTarget>

      <GlassBarBackground scrollY={scrollY} height={barHeight} blurTarget={blurTarget} />
      {/* The tab root's shared bar (wordmark, notifications, profile), laid over the hero art;
          its empty space passes touches to the page, as on the Media root. */}
      <AppTopBar transparent touchThrough />

      <DepositSheet visible={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawSheet visible={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  /**
   * Screen-reader order (same fix as Home.tsx): the transparent bar carries
   * zIndex 1, so Fabric mounts it after the scroll whatever the JSX order;
   * GlassTarget starts the page one physical pixel lower, so the bar
   * (wordmark, bell, avatar) is read first.
   */
  scroll: { flex: 1 },
  title: { paddingHorizontal: ROW_INSET },
  balance: { marginTop: 20 },
  actions: { marginTop: ACTIONS_GAP },
  recent: { marginTop: RECENT_GAP + HERO_TAIL },
  columns: { flexDirection: "row", alignItems: "flex-start" },
  leftColumn: { width: LEFT_COLUMN },
  rightColumn: { flex: 1 },
});
