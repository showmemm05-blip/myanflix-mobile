import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SearchScreen } from "@/screens/Search/Search";
import { SearchFiltersScreen } from "@/screens/Search/SearchFilters";
import { BooksCatalogScreen } from "@/screens/Books/BooksCatalog";
import { BookDetailsScreen } from "@/screens/Books/BookDetails";
import { MovieDetailsScreen } from "@/screens/MovieDetails/MovieDetails";
import { SeriesDetailsScreen } from "@/screens/SeriesDetails/SeriesDetails";
import { CategoryDetailScreen } from "@/screens/Categories/CategoryDetail";
import { ActorsListScreen } from "@/screens/Actors/ActorsList";
import { ActorDetailsScreen } from "@/screens/Actors/ActorDetails";
import { AuthorsListScreen } from "@/screens/Authors/AuthorsList";
import { AuthorDetailsScreen } from "@/screens/Authors/AuthorDetails";
import { SubscribeScreen } from "@/screens/Subscribe/Subscribe";
import { modalScreenOptions, stackScreenOptions } from "@/navigation/options";
import type { SearchStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<SearchStackParamList>();

export function SearchStackNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Search" component={SearchScreen} />
      {/* The Media tab's one filter surface — a full page pushed over Search,
          editing the shared searchFiltersStore and popping back on "Show
          results". Only this stack has it: filters are Search's alone. */}
      <Stack.Screen name="SearchFilters" component={SearchFiltersScreen} />
      <Stack.Screen name="BooksCatalog" component={BooksCatalogScreen} />
      <Stack.Screen name="BookDetails" component={BookDetailsScreen} />
      {/* The actors list — the People button in the results header opens it.
          Only this stack registers it: that button lives on the Media screen,
          which is on this stack, and nothing else reaches the screen. */}
      <Stack.Screen name="ActorsList" component={ActorsListScreen} />
      {/* The authors pair, registered here and nowhere else — the Authors
          button that opens the list is on the Books tab of the Media screen,
          which is on this stack, and an author page pushes BookDetails, which
          only this stack has. Same reach as books, so back from a book opened
          off an author page lands on that author, not on another tab. */}
      <Stack.Screen name="AuthorsList" component={AuthorsListScreen} />
      <Stack.Screen name="AuthorDetails" component={AuthorDetailsScreen} />
      {/* A movie opened from Search is pushed HERE, on the Media tab's own
          stack, so back returns to the results grid with the term and filters
          still on screen. Before this, Search had to jump to the Home tab to
          show a movie at all, and back popped the HOME stack. Same five routes
          as HomeStackNavigator (which carries the full rationale) and
          LibraryStackNavigator — keep the three copies in sync. */}
      <Stack.Screen name="MovieDetails" component={MovieDetailsScreen} />
      <Stack.Screen name="SeriesDetails" component={SeriesDetailsScreen} />
      <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
      <Stack.Screen name="ActorDetails" component={ActorDetailsScreen} />
      <Stack.Screen name="Subscribe" component={SubscribeScreen} options={modalScreenOptions} />
    </Stack.Navigator>
  );
}
