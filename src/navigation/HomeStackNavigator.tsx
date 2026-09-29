import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "@/screens/Home/Home";
import { MovieDetailsScreen } from "@/screens/MovieDetails/MovieDetails";
import { SeriesDetailsScreen } from "@/screens/SeriesDetails/SeriesDetails";
import { CategoryDetailScreen } from "@/screens/Categories/CategoryDetail";
import { ActorDetailsScreen } from "@/screens/Actors/ActorDetails";
import { SubscribeScreen } from "@/screens/Subscribe/Subscribe";
import { modalScreenOptions, stackScreenOptions } from "@/navigation/options";
import type { HomeStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      {/* Home stays first, so it is this stack's index 0 and `goBack()` from a
          detail page lands here rather than leaving the tab. */}
      <Stack.Screen name="Home" component={HomeScreen} />
      {/* THE MEDIA DETAIL GROUP. These same five routes are registered
          identically in SearchStackNavigator and LibraryStackNavigator, and the
          duplication is deliberate: a detail page belongs to the tab that
          opened it. While they lived only here, Search/Favorites/Watch history
          had to jump to the Home tab to show a movie, so `goBack()` popped the
          HOME stack and dumped the user on Home instead of the grid they came
          from — that was the back-button bug. Registration is free until used:
          native-stack mounts only the routes that appear in a stack's state.
          (They cannot be extracted into a shared helper: a navigator accepts
          only Screen/Group/Fragment as direct children, and the Stack object's
          ParamList generic is invariant, so a helper typed for the shared
          param list will not accept a stack typed for a wider one.)
          KEEP THE THREE COPIES IN SYNC. */}
      <Stack.Screen name="MovieDetails" component={MovieDetailsScreen} />
      <Stack.Screen name="SeriesDetails" component={SeriesDetailsScreen} />
      <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
      <Stack.Screen name="ActorDetails" component={ActorDetailsScreen} />
      <Stack.Screen name="Subscribe" component={SubscribeScreen} options={modalScreenOptions} />
    </Stack.Navigator>
  );
}
