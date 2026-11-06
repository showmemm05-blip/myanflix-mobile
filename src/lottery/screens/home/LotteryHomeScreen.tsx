import { useCallback, useRef } from "react";
import { StyleSheet, View, type ScrollViewInstance } from "react-native";
import { useScrollToTop } from "@react-navigation/native";
import { LotteryFooter } from "@/lottery/components/LotteryFooter";
import { LotteryScreen } from "@/lottery/components/LotteryScreen";
import { LT_COPY } from "@/lottery/copy";
import { saleStatus } from "@/lottery/data/draws";
import { dateLong } from "@/lottery/data/format";
import { useLotteryFocusRefresh } from "@/lottery/hooks/lotteryKeys";
import { useCurrentDraw, useLotteryNow } from "@/lottery/hooks/useCurrentDraw";
import { useResults } from "@/lottery/hooks/useResults";
import { useDrawTickets } from "@/lottery/hooks/useTickets";
import type { LotteryHomeScreenProps } from "@/lottery/navigation/types";
import { DrawCardSkeleton, DrawErrorBanner, NoDrawYet } from "@/lottery/screens/draw/DrawStates";
import { DreamLoadingLine } from "@/lottery/screens/dreams/DreamStates";
import { HOME_COPY } from "@/lottery/screens/home/copy";
import { HomeHero } from "@/lottery/screens/home/HomeHero";
import { LatestResults } from "@/lottery/screens/home/LatestResults";
import { PickWays } from "@/lottery/screens/home/PickWays";
import { RecentWinners } from "@/lottery/screens/home/RecentWinners";
import { StepsStrip } from "@/lottery/screens/home/StepsStrip";
import { useAuthStore } from "@/store/authStore";
import type { DreamBook } from "@/types/lottery";

/**
 * LOTTERY HOME (Main.dc.html, the intuitive Home — owner brief 22 Oct 2026):
 * the current draw and its one action first, then the three ways to pick a
 * number, the previous draw's results, its winners, and the three steps.
 * Top to bottom:
 *
 *  1. the current draw card (HomeHero): the real draw from
 *     GET /lottery/draws/current — its status, countdown, the two fanned
 *     sample tickets printed on it, the price, and "Choose numbers" (→ the
 *     Draw tab's root) while open, else "See results" + "My tickets";
 *     loading: "Loading the draw…" + the card's skeleton; failed: Try again;
 *     none: "No draw yet";
 *  2. "Pick numbers your way": Dream 1000 and Dream 100 push their dream
 *     book inside this tab; Random opens the Draw tab with Quick pick
 *     already applied (`quickPick: true`, read once by the Draw page);
 *  3. "Latest results": the newest published sheet (GET /lottery/results)
 *     compact, with "All results" (→ Results) and "Check my tickets" (→ the
 *     reveal for that draw, pushed in the Results tab so Back returns to
 *     Results) — seal red when the customer holds tickets for it;
 *  4. "Recent winners": that draw's winning tickets, numbers only;
 *  5. Pick · Buy · Check, then the footer; the Ivory dock floats over the end.
 *
 * Every section loads, fails and empties on its own. The countdown and the
 * open / closed lever tick on the server's clock; everything is re-read
 * when the tab comes back into view. A re-tap of the Home tab scrolls back
 * to the top. A guest sees no "My tickets" (the board's `auth.in` lever) and
 * "Check my tickets" sends them to sign-in (the Lottery sits behind sign-in
 * today, so this is the board's lever only).
 */
export function LotteryHomeScreen({ navigation }: LotteryHomeScreenProps<"LotteryHome">) {
  useLotteryFocusRefresh();
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);
  const signedIn = useAuthStore((s) => s.isAuthenticated);

  const current = useCurrentDraw();
  const draw = current.data?.info ?? null;
  const nowMs = useLotteryNow();
  const status = draw ? saleStatus(draw, nowMs) : null;

  const results = useResults();
  const previous = results.sheets[0] ?? null;
  // The customer's tickets for the previous draw (shared with Results' cache): they make "Check my tickets" the seal action.
  const mine = useDrawTickets(signedIn ? previous?.drawNo : undefined);
  // No results yet: the first ones come after the current draw (unless that draw is itself already published).
  const nextLine =
    draw && status !== "published"
      ? HOME_COPY.results.none.text(draw.drawTime, dateLong(draw.dateIso))
      : HOME_COPY.results.none.textNoDraw;

  const toDraw = useCallback(
    (quickPick = false) =>
      navigation.navigate("LotteryDrawTab", {
        screen: "LotteryDraw",
        params: quickPick ? { quickPick: true } : undefined,
        pop: true,
      }),
    [navigation],
  );
  const choose = useCallback(() => toDraw(), [toDraw]);
  const random = useCallback(() => toDraw(true), [toDraw]);
  const toResults = useCallback(
    () => navigation.navigate("LotteryResultsTab", { screen: "LotteryResults", pop: true }),
    [navigation],
  );
  const toBook = useCallback((book: DreamBook) => navigation.navigate("LotteryDreamBook", { book }), [navigation]);
  /**
   * A guest's way in. Today a signed-out user never reaches the Lottery (the
   * root stack swaps the app for the sign-in screens), so this navigates only
   * when the root stack really holds them (Home.tsx's rule).
   */
  const signIn = useCallback(() => {
    const root = navigation.getParent()?.getParent();
    if (root?.getState()?.routeNames.includes("Auth")) navigation.navigate("Auth", { screen: "Login" });
  }, [navigation]);
  const toTickets = useCallback(
    () => (signedIn ? navigation.navigate("LotteryTicketsTab", { screen: "LotteryTickets", pop: true }) : signIn()),
    [navigation, signedIn, signIn],
  );
  const toCheck = useCallback(() => {
    if (!signedIn) return signIn();
    navigation.navigate("LotteryResultsTab", {
      screen: "CheckTickets",
      params: previous ? { drawNo: previous.drawNo } : undefined,
      initial: false,
    });
  }, [navigation, signedIn, signIn, previous]);

  const { refetch: refetchDraw } = current;
  const retryDraw = useCallback(() => {
    refetchDraw();
  }, [refetchDraw]);
  const { refetch: refetchResults } = results;
  const retryResults = useCallback(() => {
    refetchResults();
  }, [refetchResults]);

  return (
    <LotteryScreen topBar={{ variant: "root" }} scrollRef={scrollRef} footer={<LotteryFooter />}>
      {draw && status ? (
        <HomeHero
          draw={draw}
          status={status}
          nowMs={nowMs}
          signedIn={signedIn}
          onChoose={choose}
          onResults={toResults}
          onTickets={toTickets}
        />
      ) : current.isPending ? (
        <View style={styles.loading}>
          <DreamLoadingLine text={LT_COPY.draw.loading} />
          <DrawCardSkeleton />
        </View>
      ) : current.isError ? (
        <DrawErrorBanner onRetry={retryDraw} />
      ) : (
        <NoDrawYet action={{ label: HOME_COPY.hero.seeResults, onPress: toResults }} />
      )}

      <PickWays onBook={toBook} onRandom={random} />

      <LatestResults
        sheet={previous}
        loading={results.isPending}
        failed={results.isError}
        nextLine={nextLine}
        hasTickets={mine.tickets.length > 0}
        signedIn={signedIn}
        onRetry={retryResults}
        onAll={toResults}
        onCheck={toCheck}
      />

      <RecentWinners
        sheet={previous}
        loading={results.isPending}
        failed={results.isError}
        onRetry={retryResults}
        onSeeAll={toResults}
      />

      <StepsStrip />
    </LotteryScreen>
  );
}

const styles = StyleSheet.create({
  /** The live line over the skeleton, 12 apart (LatestResults' loading spacing). */
  loading: { gap: 12 },
});
