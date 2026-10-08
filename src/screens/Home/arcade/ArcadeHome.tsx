import { useCallback, useRef } from "react";
import { StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import Animated, { useAnimatedRef, useReducedMotion, useScrollOffset } from "react-native-reanimated";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { GlassBarBackground, GlassTarget } from "@/components/layout/GlassBar";
import { StoreHero } from "@/components/arcade/StoreHero";
import { StoreFeatured } from "@/components/arcade/StoreFeatured";
import { StorePromos } from "@/components/arcade/StorePromos";
import { StoreLive } from "@/components/arcade/StoreLive";
import { StoreDiscover } from "@/components/arcade/StoreDiscover";
import { StoreExploreMore } from "@/components/arcade/StoreExploreMore";
import { useArcadeTopBarHeight } from "@/components/arcade/arcadeLayout";
import type { LaneId } from "@/data/arcade";
import { useDockClearance } from "@/hooks/useDockClearance";
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
 * THE ARCADE — the games storefront that WAS the Home tab until 2026-10-08.
 * Kept for the future games rows (owner, 2026-10-08): not registered in any
 * navigator (HomeStackNavigator mounts screens/Home/Home.tsx, the movies /
 * series / books Home), but left compiling so its sections can come back as
 * extra rows. See README.md beside this file.
 *
 * Ported from the userwebsite's Store* sections and restyled to Marquee
 * (Main.dc.html). The whole page runs
 * on local mock data (src/data/arcade.ts selectors over src/data/games.ts) and
 * locally drawn artwork (components/arcade/ArcadeArt): ZERO catalogue
 * requests, zero react-query hooks in the body, so an airplane-mode Home
 * renders completely. Movies, series, books and music are demoted to the
 * explore tiles at the foot of the scroll.
 *
 * The hero runs full-bleed under the status bar with the TRANSPARENT top bar
 * laid over it; as the page scrolls, the frosted glass (components/layout/
 * GlassBar) fades in behind the bar — never a solid ground (the owner,
 * 2026-10-02) — so the wordmark, bell and avatar stay reachable, and legible,
 * all the way down. Entrance motion is spent only on the hero, the one block on
 * screen at t=0.
 */
export function ArcadeHomeScreen({ navigation }: Props) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);
  const blurTarget = useRef<View>(null);
  const featuredY = useRef(0);
  const topBarHeight = useArcadeTopBarHeight();
  const dockClearance = useDockClearance();
  const reduceMotion = useReducedMotion();

  /**
   * Every game surface CTAs into the same place — the Media tab's root (the
   * route still called "Search"), on whichever chip it was left on.
   *
   * Both flags on the nested payload are load-bearing; neither is boilerplate:
   *
   * `initial: false` — bottom tabs are lazy, so the FIRST jump into the Media
   * tab is what CREATES its stack, and react-navigation builds that stack from
   * the payload ALONE: one route, with no Media root beneath it. That is how
   * the Books lane once stranded the tab on the old books page forever, with
   * Search unreachable from the tab bar. `initial: false` makes the tab build its
   * normal [Search] root first and then navigate on top of it.
   *
   * `pop: true` — in react-navigation 7, `navigate` only reuses a route when
   * its name matches the CURRENTLY FOCUSED one; otherwise it PUSHES a
   * duplicate. Without this flag, arriving on a Media tab that is sitting on
   * BookDetails pushed a SECOND Search on top, so back revealed a page the user
   * had already left. `pop: true` pops back to the existing screen instead.
   */
  const goToArcadeHub = useCallback(
    () => navigation.navigate("SearchTab", { screen: "Search", initial: false, pop: true }),
    [navigation],
  );

  /**
   * "All games" on the hero — scrolls down to the Featured shelf, landing its
   * heading just below the (now pinned, transparent) top bar. A jump, not a
   * glide, under reduce motion.
   */
  const scrollToFeatured = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, featuredY.current - topBarHeight),
      animated: !reduceMotion,
    });
  }, [scrollRef, topBarHeight, reduceMotion]);

  /**
   * The explore tiles' lanes each open the Media tab's root on a chip — Film
   * on Movies, Series on Series, Book on Books (each chip IS that catalogue's
   * hub: hero, rows, the full list), Music on Music. Every one carries
   * `initial: false` and `pop: true` for the reasons spelled out on
   * `goToArcadeHub` above — a cold Media tab must still get its root
   * underneath, and a warm one must be popped back to (closing the search
   * screen if it is open) rather than duplicated. The root reads
   * `initialTab` on every arrival, so a Media tab already open on another
   * chip switches too.
   */
  const openLane = useCallback(
    (id: LaneId) => {
      switch (id) {
        case "film":
          navigation.navigate("SearchTab", {
            screen: "Search",
            params: { initialTab: "movies" },
            initial: false,
            pop: true,
          });
          break;
        case "series":
          navigation.navigate("SearchTab", {
            screen: "Search",
            params: { initialTab: "series" },
            initial: false,
            pop: true,
          });
          break;
        case "book":
          navigation.navigate("SearchTab", {
            screen: "Search",
            params: { initialTab: "books" },
            initial: false,
            pop: true,
          });
          break;
        case "music":
          navigation.navigate("SearchTab", {
            screen: "Search",
            params: { initialTab: "music" },
            initial: false,
            pop: true,
          });
          break;
        default:
          navigation.navigate("SearchTab", { screen: "Search", initial: false, pop: true });
      }
    },
    [navigation],
  );

  return (
    <View style={styles.container}>
      {/* The page the glass blurs; it starts one pixel down so TalkBack reads
          the bar first (see GlassTarget). */}
      <GlassTarget targetRef={blurTarget}>
        <Animated.ScrollView
          ref={scrollRef}
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: dockClearance }}
        >
          <StoreHero onExplore={goToArcadeHub} onAllGames={scrollToFeatured} />

          {/* The wrapper's layout.y is what "All games" scrolls to. */}
          <View onLayout={(event) => (featuredY.current = event.nativeEvent.layout.y)}>
            <StoreFeatured onPressGame={goToArcadeHub} />
          </View>

          <StorePromos onPressGame={goToArcadeHub} />

          <StoreLive onPressGame={goToArcadeHub} />

          <StoreDiscover onPressGame={goToArcadeHub} />

          <StoreExploreMore onPressLane={openLane} />
        </Animated.ScrollView>
      </GlassTarget>

      {/* The frosted glass, faded in by scroll — under the bar, over the page. */}
      <GlassBarBackground scrollY={scrollY} height={topBarHeight} blurTarget={blurTarget} />
      {/* touchThrough: the bar's empty space passes touches to the page, as on the Media root. */}
      <AppTopBar transparent touchThrough />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  /**
   * Screen-reader order: the top bar (wordmark, bell, avatar) must be read
   * BEFORE the storefront. Moving <AppTopBar> earlier in this JSX would not
   * do it: Fabric mounts siblings sorted by zIndex, and the transparent bar
   * carries zIndex 1, so it is always the last native child. GlassTarget
   * starts the page one physical pixel lower, which puts the bar first.
   */
  scroll: { flex: 1 },
});
