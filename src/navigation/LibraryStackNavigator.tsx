import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LibraryOverviewScreen } from "@/screens/Library/LibraryOverview";
import { WatchHistoryScreen } from "@/screens/Library/WatchHistory";
import { FavoritesScreen } from "@/screens/Library/Favorites";
import { DownloadCacheSettingsScreen } from "@/screens/Settings/DownloadCacheSettings";
import { MovieDetailsScreen } from "@/screens/MovieDetails/MovieDetails";
import { SeriesDetailsScreen } from "@/screens/SeriesDetails/SeriesDetails";
import { CategoryDetailScreen } from "@/screens/Categories/CategoryDetail";
import { ActorDetailsScreen } from "@/screens/Actors/ActorDetails";
import { SubscribeScreen } from "@/screens/Subscribe/Subscribe";
import { modalScreenOptions, stackScreenOptions } from "@/navigation/options";
import type { LibraryStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<LibraryStackParamList>();

export function LibraryStackNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="LibraryOverview" component={LibraryOverviewScreen} />
      <Stack.Screen name="WatchHistory" component={WatchHistoryScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="DownloadCachePlaceholder" component={DownloadCacheSettingsScreen} />
      {/* Favorites and Watch history push a movie/series page onto THIS stack,
          so back returns to the grid the user tapped from instead of the Home
          tab. Same five routes as HomeStackNavigator (which carries the full
          rationale) and SearchStackNavigator — keep the three copies in sync. */}
      <Stack.Screen name="MovieDetails" component={MovieDetailsScreen} />
      <Stack.Screen name="SeriesDetails" component={SeriesDetailsScreen} />
      <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
      <Stack.Screen name="ActorDetails" component={ActorDetailsScreen} />
      <Stack.Screen name="Subscribe" component={SubscribeScreen} options={modalScreenOptions} />
    </Stack.Navigator>
  );
}
