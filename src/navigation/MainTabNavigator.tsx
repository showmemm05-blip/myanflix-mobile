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
