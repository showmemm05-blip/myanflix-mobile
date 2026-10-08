import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MediaScreen } from "@/screens/Media/Media";
import { SearchScreen } from "@/screens/Search/Search";
import { SearchFiltersScreen } from "@/screens/Search/SearchFilters";
import { BookDetailsScreen } from "@/screens/Books/BookDetails";
import { MovieDetailsScreen } from "@/screens/MovieDetails/MovieDetails";
import { SeriesDetailsScreen } from "@/screens/SeriesDetails/SeriesDetails";
import { CategoryDetailScreen } from "@/screens/Categories/CategoryDetail";
import { BrowseScreen } from "@/screens/Browse/Browse";
import { ActorsListScreen } from "@/screens/Actors/ActorsList";
import { ActorDetailsScreen } from "@/screens/Actors/ActorDetails";
import { AuthorsListScreen } from "@/screens/Authors/AuthorsList";
import { AuthorDetailsScreen } from "@/screens/Authors/AuthorDetails";
import { SubscribeScreen } from "@/screens/Subscribe/Subscribe";
import { modalScreenOptions, stackScreenOptions, titleScreenOptions } from "@/navigation/options";
import type { SearchStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<SearchStackParamList>();

export function SearchStackNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      {/* The Media tab's root — the hub page. The route keeps the name
          "Search" so every existing navigation into the tab still lands. */}
      <Stack.Screen name="Search" component={MediaScreen} />
      {/* The search screen, pushed over the root by its search button. */}
      <Stack.Screen name="MediaSearch" component={SearchScreen} />
      {/* The Media tab's one filter surface — a full page pushed over the
          root (a hub's "All …" Filter pill) or the search screen, editing the
          shared searchFiltersStore and popping back on "Show results". Only
          this stack has it: the filters are the Media tab's alone. */}
      <Stack.Screen name="SearchFilters" component={SearchFiltersScreen} />
      <Stack.Screen name="BookDetails" component={BookDetailsScreen} options={titleScreenOptions} />
      {/* The actors list — the People button in a results header (the search
          screen's, or a hub's "All …") opens it. Only this stack registers
          it: those buttons live on this stack, and nothing else reaches it. */}
      <Stack.Screen name="ActorsList" component={ActorsListScreen} />
      {/* The authors pair, registered here and nowhere else — the Authors
          button that opens the list is on the Books hub and the search
          screen's Books results, both on this stack, and an author page
          pushes BookDetails, which only this stack has. Same reach as books,
          so back from a book opened off an author page lands on that author,
          not on another tab. */}
      <Stack.Screen name="AuthorsList" component={AuthorsListScreen} />
      <Stack.Screen name="AuthorDetails" component={AuthorDetailsScreen} />
      {/* A movie opened from the Media tab is pushed HERE, on its own stack,
          so back returns to the hub or the results grid with the term and
          filters still on screen. Before this, Search had to jump to the Home
          tab to show a movie at all, and back popped the HOME stack. Same six
          routes as HomeStackNavigator (which carries the full rationale) and
          ProfileStackNavigator — keep the three copies in sync. */}
      <Stack.Screen name="MovieDetails" component={MovieDetailsScreen} options={titleScreenOptions} />
      <Stack.Screen name="SeriesDetails" component={SeriesDetailsScreen} options={titleScreenOptions} />
      <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
      <Stack.Screen name="Browse" component={BrowseScreen} />
      <Stack.Screen name="ActorDetails" component={ActorDetailsScreen} />
      <Stack.Screen name="Subscribe" component={SubscribeScreen} options={modalScreenOptions} />
    </Stack.Navigator>
  );
}
