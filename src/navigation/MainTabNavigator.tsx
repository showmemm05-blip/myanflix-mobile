import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StackActions } from "@react-navigation/native";
import { HomeStackNavigator } from "@/navigation/HomeStackNavigator";
import { SearchStackNavigator } from "@/navigation/SearchStackNavigator";
import { WalletStackNavigator } from "@/navigation/WalletStackNavigator";
import { LotteryHubScreen } from "@/screens/Lottery/LotteryHub";
import { CustomTabBar } from "@/components/layout/TabBar";
import { theme } from "@/theme";
import type { MainTabParamList } from "@/navigation/types";

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Route names are frozen (navigation/types.ts) — only the bar's look changes. */
export function MainTabNavigator() {
  return (
    <Tab.Navigator
      /**
       * The phone's back key, between tabs. The library default is
       * `firstRoute`, which REBUILDS the tab history as [HomeTab, currentTab]
       * on every switch — so back from any tab always meant "go to Home" and
       * the tab you actually came from was forgotten. `history` returns to the
       * previously selected tab, which is what back means everywhere else.
       * Trade-off, deliberately accepted: the number of back presses needed to
       * leave the app now depends on how many tabs were visited.
       */
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} />
      <Tab.Screen
        name="SearchTab"
        component={SearchStackNavigator}
        /**
         * Re-tapping the Media tab returns to its hub (owner, 2026-10-22).
         * Nothing does this by itself: the JS bottom tabs only pop a stack on
         * `popToTopOnBlur`, and CustomTabBar does not navigate to the tab
         * already focused — it emits `tabPress` and stops. So the press on
         * the focused tab pops its stack here, exactly like a "‹ Media" on
         * every page of it at once. On the hub itself it is a no-op.
         */
        listeners={({ navigation, route }) => ({
          tabPress: () => {
            if (!navigation.isFocused()) return;
            // The tab's nested stack state (a RouteProp carries no `state`).
            const stack = navigation.getState().routes.find((entry) => entry.key === route.key)?.state;
            if (stack?.type !== "stack" || typeof stack.key !== "string" || !stack.index) return;
            navigation.dispatch({ ...StackActions.popToTop(), target: stack.key });
          },
        })}
      />
      <Tab.Screen name="LotteryTab" component={LotteryHubScreen} />
      <Tab.Screen name="WalletTab" component={WalletStackNavigator} />
      {/* Four tabs (owner, 2026-10-15): Home · Media · Lottery · Wallet. The
          Lottery tab is the dark hub ("Choose a game"); the Thai lottery
          itself opens above the tabs as the root "Lottery" screen. Profile
          is not a tab — it opens from the avatar in the top bars as a root
          screen (RootNavigator), and it carries the "Your library" group that
          leads to Favorites, Watch History and Downloads. */}
    </Tab.Navigator>
  );
}
