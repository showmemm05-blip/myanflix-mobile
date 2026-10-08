import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ProfileOverviewScreen } from "@/screens/Profile/ProfileOverview";
import { WatchHistoryScreen } from "@/screens/Library/WatchHistory";
import { FavoritesScreen } from "@/screens/Library/Favorites";
import { DownloadCacheSettingsScreen } from "@/screens/Settings/DownloadCacheSettings";
import { MovieDetailsScreen } from "@/screens/MovieDetails/MovieDetails";
import { SeriesDetailsScreen } from "@/screens/SeriesDetails/SeriesDetails";
import { CategoryDetailScreen } from "@/screens/Categories/CategoryDetail";
import { BrowseScreen } from "@/screens/Browse/Browse";
import { ActorDetailsScreen } from "@/screens/Actors/ActorDetails";
import { SubscribeScreen } from "@/screens/Subscribe/Subscribe";
import { modalScreenOptions, stackScreenOptions, titleScreenOptions } from "@/navigation/options";
import type { ProfileStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

/**
 * The ROOT "Profile" screen's stack (RootNavigator), opened from the avatar in
 * the top bars — Profile is not a tab (owner, 2026-10-07). Its first page is
 * the Profile page, which holds the "Your library" group; the pages that group
 * opens (Favorites, Watch History, the Downloads placeholder — once the
 * Library tab's) stay on this stack, so back from them returns to Profile.
 * Back from Profile itself pops the whole stack and returns to the tabs.
 */
export function ProfileStackNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      {/* First, so it is this stack's index 0 and `goBack()` from any page
          below lands here rather than leaving Profile. */}
      <Stack.Screen name="ProfileOverview" component={ProfileOverviewScreen} />
      <Stack.Screen name="WatchHistory" component={WatchHistoryScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="DownloadCachePlaceholder" component={DownloadCacheSettingsScreen} />
      {/* Profile's library rows, Favorites and Watch history push a
          movie/series page onto THIS stack, so back returns to the page the
          user tapped from instead of the Home tab. Same six routes as
          HomeStackNavigator (which carries the full rationale) and
          SearchStackNavigator — keep the three copies in sync. Subscribe is
          also what Profile's own Subscribe button opens. */}
      <Stack.Screen name="MovieDetails" component={MovieDetailsScreen} options={titleScreenOptions} />
      <Stack.Screen name="SeriesDetails" component={SeriesDetailsScreen} options={titleScreenOptions} />
      <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
      <Stack.Screen name="Browse" component={BrowseScreen} />
      <Stack.Screen name="ActorDetails" component={ActorDetailsScreen} />
      <Stack.Screen name="Subscribe" component={SubscribeScreen} options={modalScreenOptions} />
    </Stack.Navigator>
  );
}
