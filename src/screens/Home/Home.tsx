import { useCallback } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { FadeInView } from "@/components/ui/FadeInView";
import { PromoHero } from "@/components/home/PromoHero";
import { OfferTicket } from "@/components/home/OfferTicket";
import { PromoDeck } from "@/components/home/PromoDeck";
import { PartnerWall } from "@/components/home/PartnerWall";
import { TestimonialPager } from "@/components/home/TestimonialPager";
import { BrowseBar } from "@/components/home/BrowseBar";
import { EditorialWell } from "@/components/home/EditorialWell";
import { BehindTheScenes } from "@/components/home/BehindTheScenes";
import { NewsArticles } from "@/components/home/NewsArticles";
import { RoadmapTimeline } from "@/components/home/RoadmapTimeline";
import { TeamSpotlight } from "@/components/home/TeamSpotlight";
import { ClosingTicket } from "@/components/home/ClosingTicket";
import { useSubscriptionStatus } from "@/hooks/useSubscription";
import { useWallet } from "@/hooks/useWallet";
import { theme } from "@/theme";
import type {
  HomeStackParamList,
  MainTabParamList,
  RootStackParamList,
} from "@/navigation/types";

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, "Home">,
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList>,
    NativeStackScreenProps<RootStackParamList>
  >
>;

/**
 * Entrance motion is spent only where it can be seen. `FadeInView` animates on
 * MOUNT, and every section of this page mounts in the same frame — so a stagger
 * running down the whole page finishes long before the reader has scrolled to
 * the third block, and every section below the fold "animates" invisibly and
 * arrives static. The hero and the campaign deck are the only two blocks on
 * screen at t=0, so they are the only two that get an entrance.
 */
const DECK_ENTER_DELAY = 120;

/**
 * Home is the ADVERTISEMENT page — a marketing landing surface, not a content
 * browser. There is no movie card, series card, episode, poster rail or genre
 * chip on this screen by design; every catalogue affordance lives on Search,
 * Categories and Library, and this page's job is to point at them.
 *
 * The funnel, top to bottom: offer → campaigns → proof → "go watch something"
 * → press room → close. CTA density down the scroll is 2 → 1 → 2 → 0 → 0 → 2 →
 * 0 → 3: two dense poles with a quiet middle, which is what keeps it from
 * reading as a coupon book.
 *
 * The only data it touches is the two app-wide hooks it already had a reason to
 * know about — subscription status (so a member is never sold a subscription)
 * and the wallet balance (so the referral offer can name a real number). That
 * is also what keeps pull-to-refresh honest: it refetches those two, and
 * nothing else on the page pretends to be live.
 */
export function HomeScreen({ navigation }: Props) {
  const statusQuery = useSubscriptionStatus();
  const walletQuery = useWallet();

  const status = statusQuery.data;
  const isMember = !!status?.isActive;
  // "We could not ask" is NOT "not a member". Offline, or after the query's
  // retries are exhausted, `data` is undefined and `isMember` reads false — so
  // without this the page would show a paying member the guest pitch, twice
  // (hero and closing ticket). Both blocks fall back to browse-only instead.
  const statusUnknown = statusQuery.isError && !isMember;

  // No scroll-linked worklet lives on this page any more: the hero is drawn in
  // code rather than photographed, so there is nothing left to parallax.
  const goToMovies = useCallback(
    () =>
      navigation.navigate("SearchTab", {
        screen: "Search",
        params: { initialTab: "movies" },
      }),
    [navigation],
  );
  const goToSeries = useCallback(
    () =>
      navigation.navigate("SearchTab", {
        screen: "Search",
        params: { initialTab: "series" },
      }),
    [navigation],
  );
  const goToWallet = useCallback(
    () => navigation.navigate("WalletTab", { screen: "Wallet" }),
    [navigation],
  );
  const goToSubscribe = useCallback(
    () => navigation.navigate("Subscribe"),
    [navigation],
  );

  const refreshing = statusQuery.isRefetching || walletQuery.isRefetching;
  const onRefresh = useCallback(() => {
    statusQuery.refetch();
    walletQuery.refetch();
  }, [statusQuery, walletQuery]);

  return (
    <View style={styles.container}>
      <AppTopBar />
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surface}
          />
        }
      >
        {/* Hero and ticket are ONE block: the ticket's negative margin has to
            tear it off the bottom edge of the hero (into its gold bloom), and
            the scroll container's row gap would otherwise cancel the overlap
            out. */}
        <View>
          <PromoHero
            isMember={isMember}
            expiresAt={status?.expiresAt ?? null}
            statusLoading={statusQuery.isLoading}
            statusError={statusQuery.isError}
            onSubscribe={goToSubscribe}
            onBrowseMovies={goToMovies}
            onBrowseSeries={goToSeries}
          />

          <OfferTicket
            balance={walletQuery.data?.balance}
            balanceLoading={walletQuery.isLoading}
            balanceError={walletQuery.isError}
            onOpenWallet={goToWallet}
          />
        </View>

        <FadeInView from="bottom" delay={DECK_ENTER_DELAY}>
          <PromoDeck onBrowseMovies={goToMovies} onBrowseSeries={goToSeries} />
        </FadeInView>

        <PartnerWall />

        <TestimonialPager />

        <BrowseBar onBrowseMovies={goToMovies} onBrowseSeries={goToSeries} />

        <EditorialWell>
          <BehindTheScenes />
          <NewsArticles />
          <RoadmapTimeline />
          <TeamSpotlight />
        </EditorialWell>

        <ClosingTicket
          isMember={isMember}
          statusUnknown={statusUnknown}
          statusLoading={statusQuery.isLoading}
          onSubscribe={goToSubscribe}
          onBrowseMovies={goToMovies}
          onBrowseSeries={goToSeries}
        />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: {
    paddingBottom: theme.layout.tabBarClearance,
    gap: theme.spacing.xl,
  },
});
