import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  /** `phone` pre-fills the number — set when "Forgot password" hands the user back to sign in. */
  Login: { phone?: string } | undefined;
  /** `phone` pre-fills the number the user was signing in with. */
  ForgotPassword: { phone?: string } | undefined;
};

/**
 * The media detail screens, registered in EVERY tab stack that can open one —
 * HomeStackNavigator, SearchStackNavigator and LibraryStackNavigator each
 * register these same five routes (the comment in HomeStackNavigator carries
 * the full rationale; keep the three copies in sync).
 *
 * WHY the duplication is deliberate: a detail page belongs to the tab that
 * opened it. When these lived only in HomeStackParamList, Search/Favorites/
 * Watch history had to jump to the Home tab to show a movie, so `goBack()`
 * popped the HOME stack and the user landed on Home instead of the grid they
 * came from. That was the back-button bug. Registering the group per stack is
 * what keeps a journey — and therefore back — inside one tab.
 *
 * Subscribe travels with them because MovieDetails/SeriesDetails push it from
 * wherever they are hosted. Registration is free at runtime: native-stack only
 * mounts routes that actually appear in a stack's state.
 */
export type MediaDetailParamList = {
  MovieDetails: { movieId: string };
  SeriesDetails: { seriesId: string };
  CategoryDetail: { categoryId: string };
  /** A person's page — their photo and everything they are in. Opened from the Search screen's People rail. */
  ActorDetails: { actorId: string };
  Subscribe: undefined;
};

export type HomeStackParamList = MediaDetailParamList & {
  Home: undefined;
};

export type SearchStackParamList = MediaDetailParamList & {
  Search: { initialTab?: "movies" | "series" | "books" | "music" } | undefined;
  /**
   * The full-screen filters page. It edits a draft of the shared
   * searchFiltersStore and commits on "Show results"; the params only say
   * WHICH tab's filters and what term the count should include — the filter
   * values themselves never travel through navigation.
   */
  SearchFilters: { tab: "movies" | "series"; term: string };
  BooksCatalog: undefined;
  BookDetails: { bookId: string };
  /**
   * Everyone in the catalogue — the People button in the results header pushes
   * it. No params: the screen carries its own search field, so there is no
   * term to hand over, and nothing deep-links to it.
   */
  ActorsList: undefined;
  /**
   * The books twin of ActorsList — every author, pushed by the SAME results
   * header pill, which reads "Authors" on the Books tab. No params, for the
   * same reason ActorsList takes none.
   */
  AuthorsList: undefined;
  /**
   * One author's page — their portrait and everything they wrote. It lives on
   * THIS stack rather than in MediaDetailParamList, deliberately: it opens
   * BookDetails, and BookDetails is registered only here, so an author page on
   * another stack would have nowhere to send a tapped book.
   */
  AuthorDetails: { authorId: string };
};

export type LibraryStackParamList = MediaDetailParamList & {
  LibraryOverview: undefined;
  WatchHistory: undefined;
  Favorites: undefined;
  DownloadCachePlaceholder: undefined;
};

export type SettingsStackParamList = {
  Settings: undefined;
};

export type WalletStackParamList = {
  Wallet: undefined;
  Transactions: undefined;
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  SearchTab: NavigatorScreenParams<SearchStackParamList>;
  WalletTab: NavigatorScreenParams<WalletStackParamList>;
  LibraryTab: NavigatorScreenParams<LibraryStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  /** In place of Auth when a saved session could not be checked (offline) — see RootNavigator. */
  SessionOffline: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  Player: { movieId: string };
  /**
   * Full-screen reading surface, registered like Player (fullScreenModal,
   * headerShown false). `editionId`/`chapterId`/`sectionId`/`pageNumber` are optional
   * entry hints — BookReader validates each against the loaded book and
   * falls back (preferred language → bookmark → first READY chapter) rather
   * than trusting a stale link.
   */
  BookReader: { bookId: string; editionId?: string; chapterId?: string; sectionId?: string; pageNumber?: number };
  Notifications: undefined;
  Profile: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
