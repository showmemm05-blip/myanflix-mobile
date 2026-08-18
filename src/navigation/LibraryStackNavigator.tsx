import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LibraryOverviewScreen } from "@/screens/Library/LibraryOverview";
import { WatchHistoryScreen } from "@/screens/Library/WatchHistory";
import { FavoritesScreen } from "@/screens/Library/Favorites";
import { DownloadCacheSettingsScreen } from "@/screens/Settings/DownloadCacheSettings";
import { stackScreenOptions } from "@/navigation/options";
import type { LibraryStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<LibraryStackParamList>();

export function LibraryStackNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="LibraryOverview" component={LibraryOverviewScreen} />
      <Stack.Screen name="WatchHistory" component={WatchHistoryScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="DownloadCachePlaceholder" component={DownloadCacheSettingsScreen} />
    </Stack.Navigator>
  );
}
