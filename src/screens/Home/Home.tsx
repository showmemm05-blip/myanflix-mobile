import { useCallback, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { FadeInView } from "@/components/ui/FadeInView";
import { StoreHero } from "@/components/arcade/StoreHero";
import { StoreFeatured } from "@/components/arcade/StoreFeatured";
import { StorePromos } from "@/components/arcade/StorePromos";
import { StoreLive } from "@/components/arcade/StoreLive";
import { StoreDiscover } from "@/components/arcade/StoreDiscover";
import { StoreExploreMore } from "@/components/arcade/StoreExploreMore";
import type { LaneId } from "@/data/arcade";
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
 * Home is THE ARCADE — the games storefront, ported from the userwebsite's
 * Store* sections. The whole page runs on local mock data (src/data/arcade.ts
 * selectors over src/data/games.ts) and locally drawn GamePlate artwork:
 * ZERO catalogue requests, zero react-query hooks in the body, so an
 * airplane-mode Home renders completely. Movies, series, books and music are
 * demoted to the explore strip at the foot of the scroll.
 *
 * Entrance motion is spent only where it can be seen: the hero is the one
 * block on screen at t=0, so it is the only block that animates in.
 */
export function HomeScreen({ navigation }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const featuredY = useRef(0);

  /**
   * Every game surface CTAs into the same place — the games hub (Search root).
   *
   * Both flags on the nested payload are load-bearing; neither is boilerplate:
   *
   * `initial: false` — bottom tabs are lazy, so the FIRST jump into the Media
   * tab is what CREATES its stack, and react-navigation builds that stack from
   * the payload ALONE: one route, with no Search screen beneath it. That is how
   * the Books lane used to strand the tab on BooksCatalog forever, with Search
   * unreachable from the tab bar. `initial: false` makes the tab build its
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

  /** "All games" on the hero — scrolls down to the Featured shelf. */
  const scrollToFeatured = useCallback(() => {
    scrollRef.current?.scrollTo({ y: featuredY.current, animated: true });
  }, []);

  /**
   * The explore strip's lanes each open the Media tab on a segment. Every one
   * carries `initial: false` and `pop: true` for the reasons spelled out on
   * `goToArcadeHub` above — a cold Media tab must still get its Search root
   * underneath, and a warm one must be popped back to rather than duplicated.
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
            screen: "BooksCatalog",
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
      <AppTopBar />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <FadeInView>
          <StoreHero onExplore={goToArcadeHub} onAllGames={scrollToFeatured} />
        </FadeInView>

        {/* The wrapper's layout.y is what "All games" scrolls to. */}
        <View onLayout={(event) => (featuredY.current = event.nativeEvent.layout.y)}>
          <StoreFeatured onPressGame={goToArcadeHub} />
        </View>

        <StorePromos onPressGame={goToArcadeHub} />

        <StoreLive onPressGame={goToArcadeHub} />

        <StoreDiscover onPressGame={goToArcadeHub} />

        <StoreExploreMore onPressLane={openLane} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: {
    paddingBottom: theme.layout.tabBarClearance,
  },
});
