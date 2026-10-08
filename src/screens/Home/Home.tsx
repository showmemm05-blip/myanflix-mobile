import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused, type CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { GLASS_BAR_ROW, GlassBarBackground, GlassTarget, useMeasuredHeight } from "@/components/layout/GlassBar";
import { HubHero, type HubHeroBadge, type HubHeroPrimary, type HubHeroSlide } from "@/components/hub/HubHero";
import { HubBrowseList } from "@/components/hub/HubBrowseList";
import { HubError } from "@/components/hub/HubStates";
import { HubChromeContext } from "@/components/hub/hubLayout";
import { useHubScroll } from "@/components/hub/useHubScroll";
import { isRecentlyAdded } from "@/components/movie/mediaItems";
import { createMovieFilters, movieFiltersToQuery, type MovieFilters } from "@/components/search/filters";
import { HomeSkeleton } from "@/components/home/HomeSkeleton";
import { PromoArt } from "@/components/home/PromoArt";
import {
  AlsoOnWeb,
  BooksBand,
  ComingSoonStrip,
  PayChips,
  PremiumBand,
  SpotlightBanner,
  ValueStrip,
} from "@/components/home/HomeShowcase";
import {
  BecauseYouWatchedRow,
  ContinueWatchingRow,
  MovieQueryRow,
  NewBooksRow,
  NewSeriesRow,
  RecentlyAddedRow,
  useContinueWatchingPresent,
  type HomeRowActions,
  type MovieRowSpec,
} from "@/components/home/HomeRows";
import {
  BROWSE_OPTIONS,
  HOME_HERO_MAX_PROMOS,
  HOME_ROW_LIMIT,
  NEWEST_MOVIES_QUERY,
  NEWEST_SERIES_QUERY,
  heroPicks,
  interleave,
  isWebUrl,
  promoText,
  visiblePlans,
  yearOf,
  type HeroPick,
} from "@/components/home/homeData";
import { homeShowcaseKey, useHomeShowcase } from "@/hooks/useHomeShowcase";
import { useMoviesInfinite } from "@/hooks/useMovies";
import { useSeriesInfinite } from "@/hooks/useSeries";
import { useSubscriptionPlans, useSubscriptionStatus } from "@/hooks/useSubscription";
import { useToggleWatchlist, useWatchlist } from "@/hooks/useWatchlist";
import { useAuthStore } from "@/store/authStore";
import { useSearchFiltersStore } from "@/store/searchFiltersStore";
import { useLanguage } from "@/localization/LanguageProvider";
import { hasAccess } from "@/utils/access";
import { formatDuration } from "@/utils/format";
import { formatKyat } from "@/utils/currency";
import { theme, withAlpha } from "@/theme";
import type { HomePromoArtPreset, ShowcasePromo, ShowcaseTitle } from "@/types/home";
import type { HomeStackParamList, MainTabParamList, RootStackParamList } from "@/navigation/types";

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, "Home">,
  CompositeScreenProps<BottomTabScreenProps<MainTabParamList>, NativeStackScreenProps<RootStackParamList>>
>;

/**
 * The sections under the hero, top to bottom (HomeMobile.dc.html); the
 * signed-in ones are listed only when signed in. A section with nothing to
 * show renders nothing (the spotlight, coming soon, the web card).
 */
type HomeRowKind =
  | "value"
  | "continue"
  | "spotlight"
  | "recent"
  | "series"
  | "premium"
  | "top10"
  | "booksBand"
  | "books"
  | "rated"
  | "because"
  | "coming"
  | "web";

/** A promo's kicker chip on the hero, by its art preset (the board's chip colours). */
const PRESET_BADGE: Record<HomePromoArtPreset, Omit<HubHeroBadge, "label">> = {
  PREMIUM: { ink: theme.colors.premium, fill: theme.colors.premiumSoft, glyph: "crown" },
  PAYMENT: { ink: theme.colors.finance, fill: theme.colors.financeSoft, glyph: "wallet" },
  GAMES: { ink: theme.colors.link, fill: withAlpha(theme.colors.primary, 0.2), glyph: "pulse" },
  GENERIC: { ink: theme.colors.textBody, fill: theme.colors.artBadge, glyph: null },
};
/** The colour of a promo's date / price line, by preset. */
const PRESET_NOTE: Record<HomePromoArtPreset, string> = {
  PREMIUM: theme.colors.premium,
  PAYMENT: theme.colors.finance,
  GAMES: theme.colors.link,
  GENERIC: theme.colors.text,
};

const rowKey = (kind: HomeRowKind) => kind;

/**
 * HOME — the showcase (owner, 2026-10-08: HomeMobile.dc.html and
 * HomeMobileLoading.dc.html; the owner's defaults for its open questions are
 * in components/home/HomeShowcase.tsx). The games storefront that was here
 * is kept aside in screens/Home/arcade for the future games rows.
 *
 * Top to bottom:
 *   1. the hero carousel — the five newest movies and series (unchanged
 *      rules: NEW / PREMIUM tags, white Play, My List, info) INTERLEAVED with
 *      the live HERO promos from the admin "Home promos" page (title, promo,
 *      title, promo…): a promo is its uploaded picture or its drawn preset
 *      scene (PromoArt), its kicker chip, title, body, and one button —
 *      Subscribe, Add money, a title, a web link, or none. 7 s a slide,
 *      paused while touched / off screen / under reduce motion; the dots and
 *      arrows sit under it;
 *   2. "Why MyanFlix" — four static tiles;
 *   3. Continue watching (signed in; hidden when empty);
 *   4. the spotlight — the team's pick, else the newest movie;
 *   5. Recently added, New series;
 *   6. the Premium band — the real plans, Subscribe / Extend, Add money;
 *   7. Top 10 most viewed;
 *   8. "Read on MyanFlix", then New on the shelf (signed in);
 *   9. Top rated, Because you watched (signed in);
 *  10. Coming soon — the team's cards and the games teaser (hidden when empty);
 *  11. "Also on the web" — only when the web address is set.
 *
 * Requests: the rows' own (unchanged — homeData explains) plus ONE
 * GET /api/home/showcase (useHomeShowcase, kept five minutes) for the
 * promos, the spotlight, coming soon and the Home settings, and the plans /
 * subscription the app already asks for elsewhere (signed in only).
 * Pull to refresh asks every section again. Loading is the HomeMobileLoading
 * board (HomeSkeleton); a page whose two catalogue requests both failed
 * shows the app's error state with Retry. A failed showcase only means no
 * promos — the catalogue rows still show.
 *
 * The chrome: the transparent AppTopBar is laid over the hero and the
 * frosted glass (components/layout/GlassBar) fades in behind it as the page
 * scrolls — never a solid ground (the owner, 2026-10-02). The bar's measured
 * height travels down HubChromeContext, so the hero's copy, the refresh
 * spinner and the error state all clear it, as on the Media tab.
 */
export function HomeScreen({ navigation }: Props) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setMovieFilters = useSearchFiltersStore((state) => state.setMovieFilters);

  /* ---- the pinned chrome: the transparent bar, measured ---- */
  const [chromeHeight, onChromeLayout] = useMeasuredHeight(insets.top + GLASS_BAR_ROW);
  const scroll = useHubScroll(chromeHeight);
  const blurTargetRef = useRef<View>(null);

  /* ---- access (the Media hubs' rule) ---- */
  // A guest has no subscription to ask about — and /subscriptions/me 401s a
  // guest into the logout path (useSubscriptionStatus explains).
  const subscriptionQuery = useSubscriptionStatus({ enabled: isAuthenticated });
  const isSubscribed = subscriptionQuery.data?.isActive ?? false;
  const subscriptionPending = isAuthenticated && subscriptionQuery.isPending;
  const savedIds = useWatchlist().data;
  // `mutate` is bound once per observer, so this holds its identity.
  const toggleSaved = useToggleWatchlist().mutate;

  /* ---- the showcase: one request ---- */
  const showcaseQuery = useHomeShowcase(isAuthenticated);
  const showcase = showcaseQuery.data;
  // Shares ["subscription", "plans"] with the Premium band and the Subscribe screen.
  const plansQuery = useSubscriptionPlans({ enabled: isAuthenticated });

  /* ---- navigation ---- */
  const openMovie = useCallback(
    (movie: { id: string }) => navigation.navigate("MovieDetails", { movieId: movie.id }),
    [navigation],
  );
  const playMovie = useCallback((movieId: string) => navigation.navigate("Player", { movieId }), [navigation]);
  const openSeries = useCallback(
    (series: { id: string }) => navigation.navigate("SeriesDetails", { seriesId: series.id }),
    [navigation],
  );
  /**
   * Every Media-tab destination carries `initial: false` and `pop: true`
   * (the Arcade home's lesson, screens/Home/arcade): a cold Media tab must
   * still get its root underneath, and a warm one is popped back to rather
   * than duplicated. BookDetails lives on the Media tab's stack only.
   */
  const openBook = useCallback(
    (book: { id: string }) =>
      navigation.navigate("SearchTab", { screen: "BookDetails", params: { bookId: book.id }, initial: false }),
    [navigation],
  );
  const openMediaChip = useCallback(
    (tab: "movies" | "series" | "books") =>
      navigation.navigate("SearchTab", { screen: "Search", params: { initialTab: tab }, initial: false, pop: true }),
    [navigation],
  );
  /**
   * "See all" for a movie row: the Movies chip. With a patch (a sort, a
   * genre, a category) the shared filters are set first, so the chip opens
   * on that results view — exactly what its own shelves' See all does.
   * Without one, its browse.
   */
  const seeAllMovies = useCallback(
    (patch: Partial<MovieFilters>) => {
      setMovieFilters({ ...createMovieFilters(), ...patch });
      openMediaChip("movies");
    },
    [setMovieFilters, openMediaChip],
  );
  /**
   * A guest's "Sign in". Today a signed-out user never sees the tabs (the
   * root stack swaps the app for the sign-in screens), so this only matters
   * if guest browsing comes to the app — it navigates only when the root
   * stack really holds the sign-in screens (Media's rule).
   */
  const signIn = useCallback(() => {
    const root = navigation.getParent()?.getParent();
    if (root?.getState()?.routeNames.includes("Auth")) navigation.navigate("Auth", { screen: "Login" });
  }, [navigation]);
  const openSubscribe = useCallback(
    () => (isAuthenticated ? navigation.navigate("Subscribe") : signIn()),
    [isAuthenticated, navigation, signIn],
  );
  /** The Wallet tab with its Deposit sheet open (Subscribe's own "Add money" route). */
  const addMoney = useCallback(
    () =>
      isAuthenticated
        ? navigation.navigate("WalletTab", { screen: "Wallet", params: { openDeposit: true }, pop: true })
        : signIn(),
    [isAuthenticated, navigation, signIn],
  );
  const openWeb = useCallback((url: string | null) => {
    if (isWebUrl(url)) void Linking.openURL(url.trim()).catch(() => {});
  }, []);
  const openTitle = useCallback(
    (title: Pick<ShowcaseTitle, "type" | "id">) => {
      if (title.type === "MOVIE") openMovie(title);
      else if (title.type === "SERIES") openSeries(title);
      else openBook(title);
    },
    [openMovie, openSeries, openBook],
  );
  /** What a promo's button (or a coming-soon card) does. */
  const runPromo = useCallback(
    (promo: ShowcasePromo) => {
      switch (promo.ctaTarget) {
        case "SUBSCRIBE":
          return openSubscribe();
        case "ADD_MONEY":
          return addMoney();
        case "MOVIE":
        case "SERIES":
        case "BOOK":
          if (promo.target) openTitle(promo.target);
          return undefined;
        case "URL":
          return openWeb(promo.url);
        default:
          return undefined;
      }
    },
    [openSubscribe, addMoney, openTitle, openWeb],
  );

  const actions = useMemo<HomeRowActions>(
    () => ({
      openMovie,
      playMovie,
      openSeries,
      openBook,
      seeAllMovies,
      seeAllSeries: () => openMediaChip("series"),
      seeAllBooks: () => openMediaChip("books"),
      // Watch history lives on the Profile stack; `initial: false` keeps the Profile page beneath it.
      seeAllHistory: () => navigation.navigate("Profile", { screen: "WatchHistory", initial: false }),
    }),
    [openMovie, playMovie, openSeries, openBook, seeAllMovies, openMediaChip, navigation],
  );

  /* ---- the two requests the hero, Recently added and New series share ---- */
  const moviesQuery = useMoviesInfinite(NEWEST_MOVIES_QUERY, BROWSE_OPTIONS);
  const seriesQuery = useSeriesInfinite(NEWEST_SERIES_QUERY, BROWSE_OPTIONS);
  // Page one only: React Query keeps this page's identity while the same
  // cache entry pages further on the Media tab, so the hero does not rebuild.
  const newestMovies = moviesQuery.data?.pages[0]?.items;
  const newestSeries = seriesQuery.data?.pages[0]?.items;

  /* ---- the hero ---- */
  // Under a Subscribe promo: the real longest plan's price, then "or" the
  // shortest one — never a typed-in price (signed in only: plans are members-only).
  const planNote = useMemo(() => {
    const plans = visiblePlans(plansQuery.data);
    if (plans.length === 0) return null;
    const daysOf = (n: number) =>
      n === 1 ? t.subscription.planDurationOne : t.subscription.planDuration.replace("{n}", String(n));
    const longest = plans[plans.length - 1];
    const shortest = plans[0];
    const sub = [t.home.planFor.replace("{days}", daysOf(longest.durationDays))];
    if (shortest.id !== longest.id) {
      sub.push(
        t.home.planOr.replace("{price}", formatKyat(shortest.price)).replace("{days}", daysOf(shortest.durationDays)),
      );
    }
    return { text: formatKyat(longest.price), sub: sub.join(" · ") };
  }, [plansQuery.data, t]);

  /** One HERO promo as a slide: its picture or drawn scene, kicker chip, body, date/price and its one button. */
  const buildPromo = useCallback(
    (promo: ShowcasePromo): HubHeroSlide => {
      const title = promoText(language, promo.titleEn, promo.titleMm) ?? "";
      const kicker = promoText(language, promo.kickerEn, promo.kickerMm);
      const custom = promoText(language, promo.ctaLabelEn, promo.ctaLabelMm);
      const guestGate = !isAuthenticated && (promo.ctaTarget === "SUBSCRIBE" || promo.ctaTarget === "ADD_MONEY");
      let primary: HubHeroPrimary | null = null;
      const linksTitle = promo.ctaTarget === "MOVIE" || promo.ctaTarget === "SERIES" || promo.ctaTarget === "BOOK";
      // A button only when it has somewhere to go (the server already drops a
      // slide whose title the viewer cannot open; this is the belt to that).
      const actionable =
        promo.ctaTarget !== "NONE" &&
        !(promo.ctaTarget === "URL" && !isWebUrl(promo.url)) &&
        !(linksTitle && !promo.target);
      if (actionable) {
        let label: string;
        if (guestGate) label = promo.ctaTarget === "SUBSCRIBE" ? t.home.signInToSubscribe : t.home.signInToAddMoney;
        else if (custom) label = custom;
        else if (promo.ctaTarget === "SUBSCRIBE") label = t.home.ctaSubscribe;
        else if (promo.ctaTarget === "ADD_MONEY") label = t.home.ctaAddMoney;
        else if (promo.ctaTarget === "URL") label = t.home.ctaLearnMore;
        else label = t.home.ctaOpen;
        primary = {
          kind: promo.ctaTarget === "SUBSCRIBE" ? "subscribe" : "commit",
          icon: promo.ctaTarget === "ADD_MONEY" ? "add" : promo.ctaTarget === "URL" ? "open-outline" : "arrow-forward",
          label,
          onPress: () => runPromo(promo),
          accessibilityLabel: t.hub.actionTitleA11y.replace("{action}", label).replace("{title}", title),
        };
      }
      const dateText = promo.dateText?.trim() || null;
      const note = dateText
        ? { text: dateText, color: PRESET_NOTE[promo.artPreset] }
        : promo.ctaTarget === "SUBSCRIBE" && planNote
          ? { ...planNote, color: PRESET_NOTE[promo.artPreset] }
          : null;
      return {
        key: `promo:${promo.id}`,
        title,
        imageUrl: promo.imageUrl,
        art: promo.imageUrl ? undefined : <PromoArt preset={promo.artPreset} />,
        badge: kicker ? { label: kicker, ...PRESET_BADGE[promo.artPreset] } : null,
        blurb: promoText(language, promo.bodyEn, promo.bodyMm),
        blurbLines: 3,
        note,
        extra: promo.artPreset === "PAYMENT" ? <PayChips tone="art" /> : null,
        primary,
      };
    },
    [language, isAuthenticated, t, runPromo, planNote],
  );

  const slides = useMemo<HubHeroSlide[]>(() => {
    const episodesOf = (n: number) =>
      n === 1 ? t.hubs.series.episodesOne : t.hubs.series.episodes.replace("{n}", String(n));
    const build = (pick: HeroPick): HubHeroSlide => {
      if (pick.kind === "series") {
        const series = pick.series;
        const isNew = isRecentlyAdded(series.createdAt);
        return {
          key: series.id,
          title: series.title,
          imageUrl: series.posterUrl ?? series.coverUrl,
          isNew,
          accessType: series.accessType,
          // The board's SERIES tag, so a series reads apart from a movie among the promos.
          tags: [t.search.series],
          kicker: isNew ? t.browse.recentlyAdded : t.hub.featured,
          rating: series.rating > 0 ? series.rating : null,
          meta: [yearOf(series), episodesOf(series.episodeCount), series.genre || null],
          blurb: series.description || null,
          primary: {
            kind: "play",
            label: t.player.play,
            // A series opens its page, where the episodes (and Resume) are.
            onPress: () => openSeries(series),
            accessibilityLabel: t.hub.actionTitleA11y.replace("{action}", t.player.play).replace("{title}", series.title),
          },
          secondary: {
            label: t.hub.myList,
            toggled: !!savedIds?.includes(series.id),
            onPress: () => toggleSaved(series.id),
          },
          info: {
            icon: "information-circle-outline",
            onPress: () => openSeries(series),
            accessibilityLabel: t.hub.moreAbout.replace("{title}", series.title),
          },
        };
      }
      const movie = pick.movie;
      const isNew = isRecentlyAdded(movie.createdAt);
      // The board's white Play: the player when the viewer can watch; the
      // movie's page (where Subscribe and the locked note live) when not —
      // and while a signed-in viewer's subscription is still on its way.
      const canWatch = !(movie.accessType !== "FREE" && subscriptionPending) && hasAccess(movie.accessType, isSubscribed);
      return {
        key: movie.id,
        title: movie.title,
        // The stage is portrait: the poster first, the cover if that is all there is.
        imageUrl: movie.posterUrl ?? movie.coverUrl,
        isNew,
        accessType: movie.accessType,
        kicker: isNew ? t.browse.recentlyAdded : t.hub.featured,
        rating: movie.rating > 0 ? movie.rating : null,
        meta: [yearOf(movie), formatDuration(movie.duration), movie.genre || null],
        blurb: movie.description || null,
        primary: {
          kind: "play",
          label: t.player.play,
          onPress: canWatch ? () => playMovie(movie.id) : () => openMovie(movie),
          accessibilityLabel: t.hub.actionTitleA11y.replace("{action}", t.player.play).replace("{title}", movie.title),
        },
        secondary: {
          label: t.hub.myList,
          toggled: !!savedIds?.includes(movie.id),
          onPress: () => toggleSaved(movie.id),
        },
        info: {
          icon: "information-circle-outline",
          onPress: () => openMovie(movie),
          accessibilityLabel: t.hub.moreAbout.replace("{title}", movie.title),
        },
      };
    };
    const titleSlides = heroPicks(newestMovies ?? [], newestSeries ?? []).map(build);
    const promoSlides = (showcase?.hero ?? []).slice(0, HOME_HERO_MAX_PROMOS).map(buildPromo);
    return interleave(titleSlides, promoSlides);
  }, [newestMovies, newestSeries, showcase, buildPromo, t, savedIds, isSubscribed, subscriptionPending, openSeries, openMovie, playMovie, toggleSaved]);
  const heroEmpty = useMemo(
    () => ({ title: t.hub.emptyMoviesTitle, message: t.hub.emptyMoviesBody, seed: "home" }),
    [t],
  );

  /* ---- the rows ---- */
  // Continue watching is listed only while it has (or may still get)
  // something to show (HomeRows explains). The value strip is always the
  // first section under the hero, so it alone takes the first section's gap.
  const continuePresent = useContinueWatchingPresent(isAuthenticated);
  const rows = useMemo<HomeRowKind[]>(
    () =>
      isAuthenticated
        ? [
            "value",
            ...(continuePresent ? (["continue"] as const) : []),
            "spotlight",
            "recent",
            "series",
            "premium",
            "top10",
            "booksBand",
            "books",
            "rated",
            "because",
            "coming",
            "web",
          ]
        : ["value", "spotlight", "recent", "series", "premium", "top10", "booksBand", "rated", "coming", "web"],
    [isAuthenticated, continuePresent],
  );

  /** The spotlight's white button: Play (the player when the viewer can watch), a series' page, a book's reader. */
  const spotlightPrimary = useCallback(
    (title: ShowcaseTitle) => {
      if (title.type === "SERIES") return openSeries(title);
      if (title.type === "BOOK") return navigation.navigate("BookReader", { bookId: title.id });
      const accessType = title.accessType ?? "FREE";
      const canWatch = !(accessType !== "FREE" && subscriptionPending) && hasAccess(accessType, isSubscribed);
      return canWatch ? playMovie(title.id) : openMovie(title);
    },
    [openSeries, navigation, subscriptionPending, isSubscribed, playMovie, openMovie],
  );
  const movieRows = useMemo<Record<"top10" | "rated", MovieRowSpec>>(
    () => ({
      top10: {
        title: t.home.top10,
        variant: "ranked",
        // The Movies hub's Popular shelf spells its query the same way: one cache entry for both.
        query: { sort: "mostViewed", limit: HOME_ROW_LIMIT },
        meta: (movie) => [yearOf(movie), movie.genre || null],
        seeAll: { sort: "mostViewed" },
      },
      rated: {
        title: t.browse.topRated,
        variant: "poster",
        // movieFiltersToQuery's spelling of Top rated (rated titles only) — the hub's shelf and its See all list the same titles.
        query: { ...movieFiltersToQuery({ ...createMovieFilters(), sort: "rating" }), limit: HOME_ROW_LIMIT },
        showRating: true,
        meta: (movie) => [yearOf(movie)],
        seeAll: { sort: "rating" },
      },
    }),
    [t],
  );
  const renderRow = useCallback(
    (kind: HomeRowKind, index: number) => {
      const first = index === 0;
      switch (kind) {
        case "value":
          return <ValueStrip first={first} />;
        case "spotlight":
          return (
            <SpotlightBanner
              spotlight={showcase?.spotlight ?? null}
              onPrimary={spotlightPrimary}
              onDetails={openTitle}
              first={first}
            />
          );
        case "premium":
          return (
            <PremiumBand
              signedIn={isAuthenticated}
              onSubscribe={openSubscribe}
              onAddMoney={addMoney}
              onSignIn={signIn}
              first={first}
            />
          );
        case "booksBand":
          return (
            <BooksBand
              signedIn={isAuthenticated}
              onOpenShelf={actions.seeAllBooks}
              onSignIn={signIn}
              first={first}
            />
          );
        case "coming":
          return (
            <ComingSoonStrip
              promos={showcase?.comingSoon ?? []}
              settings={showcase?.settings ?? null}
              onPromo={runPromo}
              first={first}
            />
          );
        case "web":
          return <AlsoOnWeb webUrl={showcase?.settings.webUrl ?? null} first={first} />;
        case "continue":
          return <ContinueWatchingRow actions={actions} first={first} />;
        case "recent":
          return (
            <RecentlyAddedRow
              movies={newestMovies}
              loading={moviesQuery.isLoading}
              actions={actions}
              first={first}
            />
          );
        case "series":
          return <NewSeriesRow series={newestSeries} loading={seriesQuery.isLoading} actions={actions} first={first} />;
        case "books":
          return <NewBooksRow enabled={isAuthenticated} actions={actions} first={first} />;
        case "top10":
          return <MovieQueryRow spec={movieRows.top10} actions={actions} first={first} />;
        case "rated":
          return <MovieQueryRow spec={movieRows.rated} actions={actions} first={first} />;
        case "because":
          return <BecauseYouWatchedRow actions={actions} first={first} />;
        default:
          return null;
      }
    },
    [
      actions,
      newestMovies,
      newestSeries,
      moviesQuery.isLoading,
      seriesQuery.isLoading,
      isAuthenticated,
      movieRows,
      showcase,
      spotlightPrimary,
      openTitle,
      openSubscribe,
      addMoney,
      signIn,
      runPromo,
    ],
  );

  /* ---- Retry and pull-to-refresh: every row on screen ---- */
  const refetchAll = useCallback(
    () =>
      Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["movies"] }),
        queryClient.invalidateQueries({ queryKey: ["series"] }),
        queryClient.invalidateQueries({ queryKey: homeShowcaseKey(isAuthenticated) }),
        ...(isAuthenticated
          ? [
              queryClient.invalidateQueries({ queryKey: ["books"] }),
              queryClient.invalidateQueries({ queryKey: ["watch-history"] }),
            ]
          : []),
      ]),
    [queryClient, isAuthenticated],
  );
  const [pulling, setPulling] = useState(false);
  const refresh = useCallback(() => {
    setPulling(true);
    void refetchAll().finally(() => setPulling(false));
  }, [refetchAll]);
  const retry = useCallback(() => void refetchAll(), [refetchAll]);

  /* ---- render ---- */
  // The showcase is asked for alongside the two catalogue pages, so the hero
  // does not usually grow its promo slides a moment after it first paints.
  // But it never holds the page hostage: once movies and series are in, the
  // skeleton waits for it only on its FIRST try and for at most
  // HOME_SHOWCASE_GRACE_MS. A slow answer, or one being retried after a
  // network/server error, lets the normal rows show; promos join when it lands.
  const catalogueLoading = moviesQuery.isLoading || seriesQuery.isLoading;
  const [showcaseGraceOver, setShowcaseGraceOver] = useState(false);
  useEffect(() => {
    if (catalogueLoading || !showcaseQuery.isLoading || showcaseGraceOver) return;
    const timer = setTimeout(() => setShowcaseGraceOver(true), HOME_SHOWCASE_GRACE_MS);
    return () => clearTimeout(timer);
  }, [catalogueLoading, showcaseQuery.isLoading, showcaseGraceOver]);
  const waitForShowcase = showcaseQuery.isLoading && showcaseQuery.failureCount === 0 && !showcaseGraceOver;
  let body;
  if (catalogueLoading || waitForShowcase) {
    body = <HomeSkeleton />;
  } else if (moviesQuery.isError && seriesQuery.isError && !moviesQuery.data && !seriesQuery.data) {
    // Both first requests failed and nothing is in hand: the app's error state.
    body = <HubError onAction={retry} busy={moviesQuery.isFetching || seriesQuery.isFetching} />;
  } else {
    body = (
      <HubBrowseList
        scroll={scroll}
        header={
          <HubHero
            slides={slides}
            accessibilityLabel={t.home.featuredTitles}
            empty={heroEmpty}
            scrollY={scroll.scrollY}
            paused={!isFocused}
            pager="dots"
          />
        }
        rows={rows}
        rowKey={rowKey}
        renderRow={renderRow}
        onRefresh={refresh}
        refreshing={pulling}
      />
    );
  }

  return (
    <View style={styles.container}>
      <HubChromeContext.Provider value={chromeHeight}>
        {/* The page the glass blurs; it starts one pixel down so TalkBack reads
            the bar first (see GlassTarget). */}
        <GlassTarget targetRef={blurTargetRef}>{body}</GlassTarget>
      </HubChromeContext.Provider>

      {/* The frosted glass, faded in by scroll — under the bar, over the page. */}
      <GlassBarBackground scrollY={scroll.scrollY} height={chromeHeight} blurTarget={blurTargetRef} />
      {/* touchThrough: the bar's empty space passes touches to the page, as on the Media root. */}
      <AppTopBar transparent touchThrough onLayout={onChromeLayout} />
    </View>
  );
}

/** How long a finished catalogue waits for a slow showcase before painting without it. */
const HOME_SHOWCASE_GRACE_MS = 1500;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
});
