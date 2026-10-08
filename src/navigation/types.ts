import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  /** `phone` pre-fills the number — set when "Forgot password" hands the user back to sign in. */
  Login: { phone?: string } | undefined;
  /** `phone` pre-fills the number the user was signing in with. */
  ForgotPassword: { phone?: string } | undefined;
};

/**
 * The media detail screens, registered in EVERY tab stack that can open one —
 * HomeStackNavigator, SearchStackNavigator and ProfileStackNavigator (the
 * root "Profile" screen's own stack) each register these same six routes (the comment in HomeStackNavigator carries
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
  /**
   * Every category (GET /categories) — banners, shelves and tiles that open
   * CategoryDetail. No params: it always shows the whole taxonomy.
   */
  Browse: undefined;
  /** A person's page — their photo and everything they are in. Opened from the search screen's People rail. */
  ActorDetails: { actorId: string };
  Subscribe: undefined;
};

export type HomeStackParamList = MediaDetailParamList & {
  Home: undefined;
};

export type SearchStackParamList = MediaDetailParamList & {
  /**
   * The Media tab's ROOT (screens/Media — the route keeps its old name so
   * every existing navigation still lands): the hub page — the "Media" bar,
   * the Movies / Series / Books / Music chips and the current chip's hub.
   * `initialTab` opens (or, when the tab is already open, switches to) a
   * chip — Home's Film / Series / Book / Music lanes and the search screen's
   * "See all" send it; "all" opens Movies (the Media tab has no All chip).
   */
  Search: { initialTab?: "all" | "movies" | "series" | "books" | "music" } | undefined;
  /**
   * The search screen (screens/Search/Search.tsx), pushed over the Media
   * root by its search button: the field, the All / Movies / Series / Books
   * scope pills, suggestions, recents and the results. `scope` picks the pill
   * it opens on (the root passes its current chip); without it, All.
   */
  MediaSearch: { scope?: "all" | "movies" | "series" | "books" } | undefined;
  /**
   * The full-screen filters page. It edits a draft of the shared
   * searchFiltersStore and commits on "Show results"; the params only say
   * WHICH tab's filters and what term the count should include — the filter
   * values themselves never travel through navigation. It pops back to
   * whichever screen opened it: a hub's "All …" Filter pill on the Media
   * root, or the search screen's results.
   */
  SearchFilters: { tab: "movies" | "series"; term: string };
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

/**
 * The stack behind the ROOT "Profile" screen (opened from the top bars'
 * avatar — Profile is not a tab; owner, 2026-10-07). Its first page is the
 * Profile page, which carries the "Your library" group; the pages that group
 * opens (they were the Library tab's) push onto this stack, so back from them
 * returns to Profile, and back from Profile leaves to the tabs underneath.
 */
export type ProfileStackParamList = MediaDetailParamList & {
  ProfileOverview: undefined;
  WatchHistory: undefined;
  Favorites: undefined;
  DownloadCachePlaceholder: undefined;
};

export type WalletStackParamList = {
  /**
   * `openDeposit` opens the Deposit sheet on arrival — set by Subscribe's
   * "Add money" (insufficient balance). Optional, so every existing
   * `{ screen: "Wallet" }` navigation is unchanged.
   */
  Wallet: { openDeposit?: boolean } | undefined;
  Transactions: undefined;
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  SearchTab: NavigatorScreenParams<SearchStackParamList>;
  WalletTab: NavigatorScreenParams<WalletStackParamList>;
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
  /**
   * The Profile page and the pages its "Your library" group opens (see
   * ProfileStackParamList). No params needed: `navigate("Profile")` opens the
   * Profile page itself.
   */
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
