import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SearchScreen } from "@/screens/Search/Search";
import { BooksCatalogScreen } from "@/screens/Books/BooksCatalog";
import { BookDetailsScreen } from "@/screens/Books/BookDetails";
import { MovieDetailsScreen } from "@/screens/MovieDetails/MovieDetails";
import { SeriesDetailsScreen } from "@/screens/SeriesDetails/SeriesDetails";
import { CategoryDetailScreen } from "@/screens/Categories/CategoryDetail";
import { SubscribeScreen } from "@/screens/Subscribe/Subscribe";
import { modalScreenOptions, stackScreenOptions } from "@/navigation/options";
import type { SearchStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<SearchStackParamList>();

export function SearchStackNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="BooksCatalog" component={BooksCatalogScreen} />
      <Stack.Screen name="BookDetails" component={BookDetailsScreen} />
      {/* A movie opened from Search is pushed HERE, on the Media tab's own
          stack, so back returns to the results grid with the term and filters
          still on screen. Before this, Search had to jump to the Home tab to
          show a movie at all, and back popped the HOME stack. Same four routes
          as HomeStackNavigator (which carries the full rationale) and
          LibraryStackNavigator — keep the three copies in sync. */}
      <Stack.Screen name="MovieDetails" component={MovieDetailsScreen} />
      <Stack.Screen name="SeriesDetails" component={SeriesDetailsScreen} />
      <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
      <Stack.Screen name="Subscribe" component={SubscribeScreen} options={modalScreenOptions} />
    </Stack.Navigator>
  );
}
