import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

/**
 * The media detail screens, registered in EVERY tab stack that can open one —
 * HomeStackNavigator, SearchStackNavigator and LibraryStackNavigator each
 * register these same four routes (the comment in HomeStackNavigator carries
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
  Subscribe: undefined;
};

export type HomeStackParamList = MediaDetailParamList & {
  Home: undefined;
};

export type SearchStackParamList = MediaDetailParamList & {
  Search: { initialTab?: "movies" | "series" | "books" | "music" } | undefined;
  BooksCatalog: undefined;
  BookDetails: { bookId: string };
};

export type LibraryStackParamList = MediaDetailParamList & {
  LibraryOverview: undefined;
  WatchHistory: undefined;
  Favorites: undefined;
  DownloadCachePlaceholder: undefined;
};

export type SettingsStackParamList = {
  Settings: undefined;
  LanguageSettings: undefined;
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
