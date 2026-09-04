import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  MovieDetails: { movieId: string };
  SeriesDetails: { seriesId: string };
  CategoryDetail: { categoryId: string };
  Subscribe: undefined;
};

export type SearchStackParamList = {
  Search: { initialTab?: "movies" | "series" | "books" | "music" } | undefined;
  BooksCatalog: undefined;
  BookDetails: { bookId: string };
};

export type LibraryStackParamList = {
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
