import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeStackNavigator } from "@/navigation/HomeStackNavigator";
import { SearchStackNavigator } from "@/navigation/SearchStackNavigator";
import { WalletStackNavigator } from "@/navigation/WalletStackNavigator";
import { LibraryStackNavigator } from "@/navigation/LibraryStackNavigator";
import { SettingsStackNavigator } from "@/navigation/SettingsStackNavigator";
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
      <Tab.Screen name="SearchTab" component={SearchStackNavigator} />
      <Tab.Screen name="WalletTab" component={WalletStackNavigator} />
      <Tab.Screen name="LibraryTab" component={LibraryStackNavigator} />
      <Tab.Screen name="SettingsTab" component={SettingsStackNavigator} />
    </Tab.Navigator>
  );
}
