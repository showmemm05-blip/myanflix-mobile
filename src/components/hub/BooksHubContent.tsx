import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AuthorRail } from "@/components/books/AuthorRail";
import { BookCard, BookCardSkeleton } from "@/components/books/BookCard";
import { BookToggleShelf } from "@/components/books/BookToggleShelf";
import { CategoryBanner } from "@/components/books/CategoryBanner";
import { ShelfRetry } from "@/components/books/ShelfRetry";
import { isRecentlyAdded } from "@/components/movie/mediaItems";
import { HubHero, type HubHeroSlide } from "@/components/hub/HubHero";
import { HubRow, type HubRowItem } from "@/components/hub/HubRow";
import { HubAllGrid, type HubChoiceGroup } from "@/components/hub/HubAllGrid";
import { HubAllToolbar } from "@/components/hub/HubAllToolbar";
import { HubError, HubSkeleton } from "@/components/hub/HubStates";
import { HUB_SECTION_GAP, useHubChromeHeight } from "@/components/hub/hubLayout";
import { featureNewest } from "@/components/hub/hubFeatured";
import type { HubScroll } from "@/components/hub/useHubScroll";
import { useMediaTabNavigation } from "@/components/hub/mediaTabNavigation";
import {
  chaptersKey,
  readingProgressKey,
  useBooksInfinite,
  useBooksList,
  useChapters,
  useReadingProgress,
} from "@/hooks/useBooks";
import { BROWSE_STALE_TIME_MS } from "@/hooks/useMovies";
import { useBookAuthorsInfinite } from "@/hooks/useBookAuthors";
import { useBookCategories } from "@/hooks/useBookCategories";
import { LIST_PAGE_SIZE, flattenPages } from "@/hooks/pagination";
import { useAuthStore } from "@/store/authStore";
import { useReaderPrefsStore } from "@/store/readerPrefsStore";
import { useLanguage } from "@/localization/LanguageProvider";
import { languageLabel, pickEdition } from "@/utils/bookLanguages";
import { theme } from "@/theme";
import type { BookAuthorListItem } from "@/api/bookAuthors.api";
import type { BookCategory } from "@/api/bookCategories.api";
import type { Book, BookChapterSummary, BookEdition, BookReadingProgress, BookType } from "@/types/book";

interface Props {
  /**
   * The Books chip is on screen and the Media tab's root is focused. The hub
   * stays mounted while another chip shows (or a screen is pushed over it) —
   * so it keeps its scroll position, its filters and its data — and only its
   * hero's pager holds still.
   */
  active: boolean;
  /**
   * Owned by the Media screen, which fades its bar in from it. A Books pick in
   * its Categories pop-up brings All books into view through it.
   */
  scroll: HubScroll;
  /**
   * The book category the All books grid shows ("" = every book) — held by
   * the Media screen, so its Categories pop-up can set it and highlight it.
   * The grid's own category chips and a shelf's "See all" change it here too.
   */
  category: string;
  onCategoryChange: (categoryId: string) => void;
  /**
   * Goes up by one on every Books pick in the Categories pop-up: like a
   * shelf's "See all", the grid's format and language go back to "any" and
   * All books is scrolled into view (once laid out, if the hub is only now
   * mounting).
   */
  categoryPickSeq: number;
}
type Translations = ReturnType<typeof useLanguage>["t"];

/** The story pager's five books. */
const HERO_COUNT = 5;
/** Covers on one book shelf (Books.dc.html: every shelf shows 8). */
const SHELF_LIMIT = 8;
/** Portraits on the Authors rail. */
const AUTHOR_LIMIT = 12;
/** A category shelf needs at least this many books to be worth a row. */
const MIN_CATEGORY_BOOKS = 2;
/** The board's two category shelves: the banner one, then a plain one. */
const SHELF_CATEGORIES = 2;
/**
 * Ranked categories asked about: the board's two plus ONE in reserve. The
 * reserve is only fetched once a ranked shelf turns out too thin (bookCount
 * counts unpublished books), so the banner never vanishes while a plain
 * shelf stays — the next category moves up instead.
 */
const SHELF_CANDIDATES = SHELF_CATEGORIES + 1;
/** The "All" category chip — no `categoryId` filter at all. */
const ALL_CATEGORIES = "";
/** The All grid's format radios: anything, or one real BookType. */
type GridFormat = "any" | BookType;
/** The All grid's language radios: anything, or one language code. */
const ANY_LANGUAGE = "any";
/** The two sides of the language shelf (Books.dc.html). */
type ShelfLanguage = "my" | "en";

/** Shared empty lists, so an unloaded query never hands a memo a fresh `[]`. */
const NO_BOOKS: Book[] = [];
const NO_CATEGORIES: BookCategory[] = [];

function booksCount(t: Translations, n: number): string {
  return n === 1 ? t.authors.booksCountOne : t.authors.booksCount.replace("{n}", String(n));
}

/**
 * The author's name as their author page spells it (NOTES: authorRef.name,
 * else the name denormalised onto the book). Empty when neither has one.
 */
function authorOf(book: Book): string {
  return book.authorRef?.name?.trim() || book.author.trim();
}

/** Burmese, then English, then any other language by code — the language radios' order. */
function byLanguage(a: string, b: string): number {
  const rank = (code: string) => (code === "my" ? 0 : code === "en" ? 1 : 2);
  return rank(a) - rank(b) || a.localeCompare(b);
}

function formatLabel(t: Translations, type: BookType): string {
  return type === "EDITOR" ? t.books.formatEditor : t.books.formatPdf;
}

/** "12 chapters" for the edition this reader would open — only chapters that can actually be read. */
function chaptersLabel(t: Translations, edition: BookEdition | null): string | null {
  const n = edition?.readyChapterCount ?? 0;
  if (n <= 0) return null;
  return n === 1 ? t.books.chapterCountOne : t.books.chapterCount.replace("{n}", String(n));
}

/** Every language a book comes in, each by its own name ("မြန်မာ, English"). */
function languagesLabel(book: Book): string | null {
  return book.languages.map(languageLabel).join(", ") || null;
}

/**
 * The Books hub, as the body of the Media tab's Books chip
 * (docs/mobile-media-page-2026-10-02/design/MediaBooks.dc.html; the hub
 * itself is docs/mobile-hub-pages-2026-10-02, Books.dc.html + NOTES).
 *
 * GET /books, /book-authors and /book-categories are members-only (a guest
 * gets 401), so a signed-out viewer gets the tab's "Sign in to read books"
 * state and none of the hub's queries are ever asked. No action button: the
 * root stack swaps Main for the sign-in screens the moment the session ends.
 */
export const BooksHubContent = memo(function BooksHubContent(props: Props) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) return <SignedOut />;
  return <BooksHub {...props} />;
});

/**
 * A guest's Books chip: "Sign in to read books", centred in the space under
 * the pinned Media bar and chips. No action button: the root stack swaps
 * Main for the sign-in screens the moment the session ends.
 */
function SignedOut() {
  const { t } = useLanguage();
  const chromeHeight = useHubChromeHeight();
  return (
    <View style={[styles.signedOut, { paddingTop: chromeHeight }]}>
      <EmptyState title={t.search.booksSignedOutTitle} message={t.search.booksSignedOutBody} icon="lock-closed-outline" />
    </View>
  );
}

/**
 * The signed-in hub:
 *
 * - the hero, full-bleed from the top of the screen under the Media bar and
 *   its chips — the five newest books,
 *   those with a cover first (GET /books is newest-first and there is no
 *   featured flag; a book without one stands as BookCover's own no-image
 *   cover over a drawn backdrop, and an empty library gets the empty hero),
 *   each a 5:7 cover over its own blurred backdrop: NEW (createdAt within
 *   NEW_TITLE_WINDOW_DAYS), the format tag, the first category, author,
 *   languages and readable chapters.
 *   The main button is "Start reading", or "Continue reading" with
 *   "Chapter N · P% read" under it — the reading progress of the ACTIVE
 *   slide's edition only (its chapter list only when there is a bookmark);
 *   Details opens the book, the round button the author's page (a Books
 *   pick in the Media screen's Categories pop-up shows All books on that
 *   book category — Browse is the MOVIE taxonomy);
 * - New on the shelf (the same newest page), the two biggest book categories
 *   (GET /book-categories, by bookCount) as a banner shelf and a plain one,
 *   each filled by GET /books?categoryId (a too-thin one gives its place to
 *   the next category), "Text or scanned pages" (?type=EDITOR|PDF),
 *   "Burmese or English" (?language=my|en) and the Authors rail
 *   (GET /book-authors, into AuthorDetails / AuthorsList); a shelf whose own
 *   request failed shows a Retry for just that request;
 * - All books — the tab's browse list: the count with the Authors pill,
 *   category chips (GET /book-categories), the format radios,
 *   the language radios (the languages of the newest page, when there are
 *   two or more — the only way to list every book in one language) and the
 *   server's only order, newest first — /books takes no sort, so there are
 *   no sort radios that would pretend otherwise — in a 3-column grid that
 *   pages by itself. Pull to refresh asks every query of the hub again.
 *
 * Loading is the hub skeleton, a failed first page the hub error with Retry.
 */
function BooksHub({ active, scroll, category: gridCategory, onCategoryChange: setGridCategory, categoryPickSeq }: Props) {
  const { t } = useLanguage();
  const navigation = useMediaTabNavigation();
  const queryClient = useQueryClient();
  const readingLanguage = useReaderPrefsStore((state) => state.readingLanguage);

  /* ---- the newest books: the hero, New on the shelf, and the unfiltered All grid ---- */
  // `{ limit: 30 }` is the search screen's own Books grid key with no term, so the two share it.
  // 5-minute window: "back to the app" no longer re-asks every loaded page
  // (pull-to-refresh and Retry still do — refetch ignores staleTime).
  const recentQuery = useBooksInfinite({ limit: LIST_PAGE_SIZE }, { staleTime: BROWSE_STALE_TIME_MS });
  const firstPage = recentQuery.data?.pages[0]?.items ?? NO_BOOKS;

  /* ---- category shelves: the two biggest book categories (one more in reserve) ---- */
  const categoriesQuery = useBookCategories();
  const categories = categoriesQuery.data ?? NO_CATEGORIES;
  // bookCount also counts unpublished books, so it only RANKS the shelves;
  // each shelf's own GET /books answer decides whether it shows, and its count.
  const shelfCandidates = useMemo(
    () =>
      categories
        .filter((category) => category.bookCount >= MIN_CATEGORY_BOOKS)
        .sort((a, b) => b.bookCount - a.bookCount)
        .slice(0, SHELF_CANDIDATES),
    [categories],
  );
  const categoryA = shelfCandidates[0] ?? null;
  const categoryB = shelfCandidates[1] ?? null;
  const categoryC = shelfCandidates[2] ?? null;
  const queryA = useBooksList(
    { categoryId: categoryA?.id, limit: SHELF_LIMIT },
    { enabled: !!categoryA, staleTime: BROWSE_STALE_TIME_MS },
  );
  const queryB = useBooksList(
    { categoryId: categoryB?.id, limit: SHELF_LIMIT },
    { enabled: !!categoryB, staleTime: BROWSE_STALE_TIME_MS },
  );
  const tooThinA = !!queryA.data && queryA.data.items.length < MIN_CATEGORY_BOOKS;
  const tooThinB = !!queryB.data && queryB.data.items.length < MIN_CATEGORY_BOOKS;
  const needReserve = tooThinA || tooThinB;
  const queryC = useBooksList(
    { categoryId: categoryC?.id, limit: SHELF_LIMIT },
    { enabled: !!categoryC && needReserve, staleTime: BROWSE_STALE_TIME_MS },
  );

  /* ---- Text or scanned pages ---- */
  const [formatChoice, setFormatChoice] = useState<BookType | null>(null);
  // Until the reader picks a side, open on a side the newest books actually have.
  const rowFormat: BookType =
    formatChoice ??
    (firstPage.some((book) => book.type === "PDF") && !firstPage.some((book) => book.type === "EDITOR")
      ? "PDF"
      : "EDITOR");
  const formatQuery = useBooksList(
    { type: rowFormat, limit: SHELF_LIMIT },
    { enabled: !!recentQuery.data, staleTime: BROWSE_STALE_TIME_MS },
  );

  /* ---- Burmese or English — only when the newest books come in both ---- */
  const showLanguageShelf =
    firstPage.some((book) => book.languages.includes("my")) && firstPage.some((book) => book.languages.includes("en"));
  const [shelfLanguage, setShelfLanguage] = useState<ShelfLanguage>("my");
  const languageQuery = useBooksList(
    { language: shelfLanguage, limit: SHELF_LIMIT },
    { enabled: showLanguageShelf, staleTime: BROWSE_STALE_TIME_MS },
  );

  /* ---- the Authors rail: the Authors list's own first page (shared cache), minus anyone with no books ---- */
  const authorsQuery = useBookAuthorsInfinite("");
  const shelfAuthors = useMemo(
    () => flattenPages(authorsQuery.data?.pages).filter((author) => author.bookCount > 0).slice(0, AUTHOR_LIMIT),
    [authorsQuery.data],
  );

  /* ---- All books (its category is the Media screen's — see Props) ---- */
  const [gridFormat, setGridFormat] = useState<GridFormat>("any");
  const [gridLanguage, setGridLanguage] = useState(ANY_LANGUAGE);
  // A pick in the Categories pop-up: any format, any language (React's
  // "adjust state while rendering", so the grid asks once, already reset)…
  const [seenPickSeq, setSeenPickSeq] = useState(categoryPickSeq);
  if (categoryPickSeq !== seenPickSeq) {
    setSeenPickSeq(categoryPickSeq);
    setGridFormat("any");
    setGridLanguage(ANY_LANGUAGE);
  }
  // …and All books brought into view — including the pick that mounted this hub.
  const requestScrollToAll = scroll.requestScrollToAll;
  const scrolledForPick = useRef(0);
  useEffect(() => {
    if (categoryPickSeq === scrolledForPick.current) return;
    scrolledForPick.current = categoryPickSeq;
    requestScrollToAll();
  }, [categoryPickSeq, requestScrollToAll]);
  const filtering = gridCategory !== ALL_CATEGORIES || gridFormat !== "any" || gridLanguage !== ANY_LANGUAGE;
  const filteredQuery = useBooksInfinite(
    {
      categoryId: gridCategory !== ALL_CATEGORIES ? gridCategory : undefined,
      type: gridFormat !== "any" ? gridFormat : undefined,
      language: gridLanguage !== ANY_LANGUAGE ? gridLanguage : undefined,
      limit: LIST_PAGE_SIZE,
    },
    { enabled: filtering },
  );
  const gridQuery = filtering ? filteredQuery : recentQuery;
  const gridBooks = useMemo(() => flattenPages(gridQuery.data?.pages), [gridQuery.data]);
  // The languages the newest page comes in. The first page only — never the
  // pages the grid streams in later, which would grow the controls above the
  // reader's position and jump the list.
  const gridLanguages = useMemo(() => {
    const codes = new Set<string>();
    for (const book of firstPage) for (const code of book.languages) codes.add(code);
    if (gridLanguage !== ANY_LANGUAGE) codes.add(gridLanguage);
    return [...codes].sort(byLanguage);
  }, [firstPage, gridLanguage]);

  /* ---- navigation ---- */
  const openBook = useCallback(
    (book: Pick<Book, "id">) => navigation.navigate("BookDetails", { bookId: book.id }),
    [navigation],
  );
  const openAuthor = useCallback(
    (authorId: string) => navigation.navigate("AuthorDetails", { authorId }),
    [navigation],
  );
  const goToAuthor = useCallback((author: BookAuthorListItem) => openAuthor(author.id), [openAuthor]);
  const openAuthors = useCallback(() => navigation.navigate("AuthorsList"), [navigation]);
  // The reader is a root-stack modal; it re-checks every hint against the
  // loaded book (preferred language → bookmark → first ready chapter).
  const readBook = useCallback(
    (bookId: string, editionId?: string, chapterId?: string) =>
      navigation.navigate("BookReader", { bookId, editionId, chapterId }),
    [navigation],
  );

  /* ---- the hero ---- */
  const heroBooks = useMemo(() => featureNewest(firstPage, (book) => !!book.coverUrl, HERO_COUNT), [firstPage]);
  const [heroIndex, setHeroIndex] = useState(0);
  const activeBook = heroBooks[Math.min(heroIndex, Math.max(0, heroBooks.length - 1))] ?? null;
  const activeEdition = activeBook ? pickEdition(activeBook.editions, readingLanguage) : null;
  // Asked for the slide on screen only. The chapter list (for "Chapter N")
  // only once there is a bookmark that names a chapter.
  const activeProgressQuery = useReadingProgress(activeBook?.id ?? "", activeEdition?.id);
  const activeProgress = activeProgressQuery.data ?? null;
  const activeChaptersQuery = useChapters(
    activeBook?.id ?? "",
    activeProgress && activeProgress.progress > 0 && activeProgress.chapterId ? activeEdition?.id : undefined,
  );
  const activeChapters = activeChaptersQuery.data;

  const slides = useMemo<HubHeroSlide[]>(
    () =>
      heroBooks.map((book) => {
        const isActive = book.id === activeBook?.id;
        const edition = isActive ? activeEdition : pickEdition(book.editions, readingLanguage);
        // The other slides only READ the cache — a book read earlier in this
        // session already shows "Continue reading" before it is swiped to.
        const progress = isActive
          ? activeProgress
          : edition
            ? (queryClient.getQueryData<BookReadingProgress | null>(readingProgressKey(book.id, edition.id)) ?? null)
            : null;
        const bookmarked = !!progress && progress.progress > 0;
        const chapters =
          bookmarked && edition
            ? isActive
              ? activeChapters
              : queryClient.getQueryData<BookChapterSummary[]>(chaptersKey(book.id, edition.id))
            : undefined;
        const chapter = bookmarked && progress.chapterId ? chapters?.find((c) => c.id === progress.chapterId) : undefined;
        const percent = progress ? Math.min(100, Math.max(0, Math.round(progress.progress))) : 0;
        const sublabel = bookmarked
          ? chapter
            ? t.hubs.books.progressLine
                .replace("{chapter}", t.books.reader.chapterLabel.replace("{n}", chapter.number))
                .replace("{percent}", String(percent))
            : t.hubs.books.percentRead.replace("{percent}", String(percent))
          : null;
        const label = bookmarked ? t.books.continueReading : t.books.startReading;
        const isNew = isRecentlyAdded(book.createdAt);
        const authorId = book.authorRef?.id ?? book.authorId ?? null;
        const authorName = authorOf(book);
        return {
          key: book.id,
          title: book.title,
          imageUrl: book.coverUrl,
          isNew,
          tags: [formatLabel(t, book.type)],
          kicker: book.categories[0]?.name ?? (isNew ? t.browse.recentlyAdded : t.hub.featured),
          // No name, no lead: never the person glyph on its own.
          metaLead: authorName ? { icon: "person-outline", text: authorName } : null,
          meta: [languagesLabel(book), chaptersLabel(t, edition)],
          blurb: book.description || null,
          primary: {
            kind: "read",
            label,
            sublabel,
            disabled: !book.editions.some((e) => e.readyChapterCount > 0),
            onPress: () =>
              readBook(book.id, edition?.id, bookmarked ? (progress.chapterId ?? undefined) : undefined),
            accessibilityLabel: t.hub.actionTitleA11y.replace("{action}", label).replace("{title}", book.title),
          },
          secondary: {
            label: t.books.details,
            icon: "information-circle-outline",
            onPress: () => openBook(book),
            accessibilityLabel: t.hub.actionTitleA11y.replace("{action}", t.books.details).replace("{title}", book.title),
          },
          info: authorId && authorName
            ? {
                icon: "person-outline",
                onPress: () => openAuthor(authorId),
                accessibilityLabel: t.books.moreBy.replace("{author}", authorName),
              }
            : null,
          onOpen: () => openBook(book),
        };
      }),
    [
      heroBooks,
      activeBook,
      activeEdition,
      activeProgress,
      activeChapters,
      readingLanguage,
      queryClient,
      t,
      readBook,
      openBook,
      openAuthor,
    ],
  );
  const heroEmpty = useMemo(
    () => ({ title: t.hub.emptyBooksTitle, message: t.hub.emptyBooksBody, seed: "books" }),
    [t],
  );

  /* ---- the shelves ---- */
  const coverItem = useCallback(
    (book: Book, meta: HubRowItem["meta"], markNew = false): HubRowItem => ({
      key: book.id,
      title: book.title,
      imageUrl: book.coverUrl,
      byline: authorOf(book),
      isNew: markNew && isRecentlyAdded(book.createdAt),
      meta,
      onPress: () => openBook(book),
    }),
    [openBook],
  );

  const newItems = useMemo(
    () => firstPage.slice(0, SHELF_LIMIT).map((book) => coverItem(book, [formatLabel(t, book.type)], true)),
    [firstPage, coverItem, t],
  );
  /** A category shelf's card: the format under the author, as on New on the shelf. */
  const categoryItem = useCallback(
    (book: Book) => coverItem(book, [formatLabel(t, book.type)]),
    [coverItem, t],
  );

  // The two category shelves, in rank order. A loaded shelf with fewer than
  // two visible books is skipped and the next candidate (the reserve, fetched
  // only then) takes its place, so the first shown is always the banner. A
  // shelf still loading, or one that failed, keeps its place.
  const categorySlots: Array<{ category: BookCategory; query: typeof queryA }> = [];
  for (const [category, query] of [
    [categoryA, queryA],
    [categoryB, queryB],
    [categoryC, queryC],
  ] as const) {
    if (categorySlots.length === SHELF_CATEGORIES) break;
    if (!category) continue;
    if (query.data && query.data.items.length < MIN_CATEGORY_BOOKS) continue;
    categorySlots.push({ category, query });
  }
  const formatItems = useMemo(
    () =>
      (formatQuery.data?.items ?? NO_BOOKS).map((book) =>
        coverItem(book, [chaptersLabel(t, pickEdition(book.editions, readingLanguage))]),
      ),
    [formatQuery.data, coverItem, readingLanguage, t],
  );
  const languageItems = useMemo(
    () => (languageQuery.data?.items ?? NO_BOOKS).map((book) => coverItem(book, [languagesLabel(book)])),
    [languageQuery.data, coverItem],
  );

  /** A shelf's "See all": the All grid on that category (any format, any language), scrolled into view. */
  const showAll = useCallback(
    (categoryId: string) => {
      setGridCategory(categoryId);
      setGridFormat("any");
      setGridLanguage(ANY_LANGUAGE);
      scroll.scrollToAll();
    },
    [scroll, setGridCategory],
  );

  /* ---- the All grid's controls ---- */
  const categoryChips = useMemo<HubChoiceGroup | null>(() => {
    // The one picked stays listed even when it holds no books yet (the
    // Categories pop-up lists every shelf), so the chip row still shows it.
    const listed = categories.filter((category) => category.bookCount > 0 || category.id === gridCategory);
    if (listed.length === 0) return null;
    return {
      label: t.books.category,
      options: [
        { value: ALL_CATEGORIES, label: t.common.all },
        ...listed.map((category) => ({ value: category.id, label: category.name })),
      ],
      value: gridCategory,
      onChange: setGridCategory,
    };
  }, [categories, gridCategory, setGridCategory, t]);

  const formatRadios = useMemo<HubChoiceGroup>(
    () => ({
      label: t.books.format,
      options: [
        { value: "any", label: t.hubs.books.anyFormat },
        { value: "EDITOR", label: t.books.formatEditor },
        { value: "PDF", label: t.books.formatPdf },
      ],
      value: gridFormat,
      onChange: (value) => setGridFormat(value as GridFormat),
    }),
    [gridFormat, t],
  );

  // Only when there is a choice to make: two or more languages on the newest page.
  const languageRadios = useMemo<HubChoiceGroup[] | null>(
    () =>
      gridLanguages.length < 2
        ? null
        : [
            {
              label: t.hubs.books.languageGroup,
              options: [
                { value: ANY_LANGUAGE, label: t.hubs.books.anyLanguage },
                ...gridLanguages.map((code) => ({ value: code, label: languageLabel(code) })),
              ],
              value: gridLanguage,
              onChange: setGridLanguage,
            },
          ],
    [gridLanguages, gridLanguage, t],
  );

  const gridTotal = gridQuery.data?.pages[0]?.total ?? 0;
  const gridCategoryName =
    gridCategory !== ALL_CATEGORIES ? (categories.find((category) => category.id === gridCategory)?.name ?? null) : null;
  const gridLoading = gridQuery.isLoading || gridQuery.isPlaceholderData;
  const gridFailed = gridQuery.isError && !gridQuery.data;
  const gridCount = gridLoading
    ? null
    : gridFailed
      ? ""
      : gridCategoryName
        ? t.hubs.books.countInCategory.replace("{n}", String(gridTotal)).replace("{category}", gridCategoryName)
        : booksCount(t, gridTotal);
  const authorsPill = useMemo(
    () => ({ label: t.search.authors, icon: "create-outline" as const, onPress: openAuthors }),
    [t, openAuthors],
  );
  const clearGridFilters = useCallback(() => {
    setGridCategory(ALL_CATEGORIES);
    setGridFormat("any");
    setGridLanguage(ANY_LANGUAGE);
  }, [setGridCategory]);

  const renderCell = useCallback(
    (book: Book, width: number) => (
      <BookCard
        title={book.title}
        author={authorOf(book)}
        coverUrl={book.coverUrl}
        category={formatLabel(t, book.type)}
        width={width}
        onPress={() => openBook(book)}
      />
    ),
    [openBook, t],
  );
  const fetchNextBooks = gridQuery.fetchNextPage;
  // `cancelRefetch: false`: a second call while a page is on its way joins
  // it instead of asking again (the Movies and Series grids do the same).
  const loadMore = useCallback(() => void fetchNextBooks({ cancelRefetch: false }), [fetchNextBooks]);
  const retryGrid = gridQuery.refetch;

  /* ---- Retry and pull-to-refresh: every query the hub is showing ---- */
  const hasFirstPage = !!recentQuery.data;
  const refetchAll = useCallback(() => {
    // Only the queries that are switched on: `refetch()` ignores `enabled`.
    const asked: Promise<unknown>[] = [recentQuery.refetch(), categoriesQuery.refetch(), authorsQuery.refetch()];
    if (categoryA) asked.push(queryA.refetch());
    if (categoryB) asked.push(queryB.refetch());
    if (categoryC && needReserve) asked.push(queryC.refetch());
    if (hasFirstPage) asked.push(formatQuery.refetch());
    if (showLanguageShelf) asked.push(languageQuery.refetch());
    if (filtering) asked.push(filteredQuery.refetch());
    return Promise.allSettled(asked);
    // The refetch functions are bound once per observer.
  }, [
    recentQuery.refetch,
    categoriesQuery.refetch,
    authorsQuery.refetch,
    categoryA,
    queryA.refetch,
    categoryB,
    queryB.refetch,
    categoryC,
    needReserve,
    queryC.refetch,
    hasFirstPage,
    formatQuery.refetch,
    showLanguageShelf,
    languageQuery.refetch,
    filtering,
    filteredQuery.refetch,
  ]);
  const [pulling, setPulling] = useState(false);
  const refresh = useCallback(() => {
    setPulling(true);
    void refetchAll().finally(() => setPulling(false));
  }, [refetchAll]);

  const retryHub = useCallback(() => void refetchAll(), [refetchAll]);

  if (recentQuery.isLoading) return <HubSkeleton variant="cover" />;

  if (recentQuery.isError && !recentQuery.data) {
    return <HubError title={t.books.loadError} onAction={retryHub} busy={recentQuery.isFetching} />;
  }

  // An empty library has nothing to put on a shelf: the empty hero, then
  // straight to All books (its count, the Authors pill and its message).
  const hasBooks = firstPage.length > 0;

  const formatCount = formatQuery.data ? booksCount(t, formatQuery.data.total) : null;
  const languageCount = languageQuery.data ? booksCount(t, languageQuery.data.total) : null;

  const pageTop = (
    <View>
      <HubHero
        slides={slides}
        variant="cover"
        accessibilityLabel={t.hubs.books.featured}
        empty={heroEmpty}
        scrollY={scroll.scrollY}
        onIndexChange={setHeroIndex}
        paused={!active}
      />
      {hasBooks ? (
        <View style={styles.rows}>
          <HubRow
            variant="cover"
            title={t.books.newOnShelf}
            items={newItems}
            onSeeAll={() => showAll(ALL_CATEGORIES)}
          />

          {categoriesQuery.isLoading ? <CategoryShelfSkeleton /> : null}
          {categoriesQuery.isError && !categoriesQuery.data ? (
            <ShelfRetry message={t.hubs.books.categoriesError} onRetry={() => categoriesQuery.refetch()} />
          ) : null}
          {categorySlots.map(({ category, query }, index) => (
            <CategoryShelf
              key={category.id}
              category={category}
              banner={index === 0}
              books={query.data?.items}
              total={query.data?.total ?? null}
              loading={query.isPending}
              failed={query.isError && !query.data}
              onRetry={() => query.refetch()}
              toItem={categoryItem}
              onSeeAll={showAll}
            />
          ))}

          <BookToggleShelf
            title={t.hubs.books.formatTitle}
            count={formatCount}
            options={[
              { value: "EDITOR", label: t.books.formatEditor },
              { value: "PDF", label: t.books.formatPdf },
            ]}
            value={rowFormat}
            onChange={(value) => setFormatChoice(value as BookType)}
            items={formatItems}
            loading={formatQuery.isPending}
            emptyMessage={t.hubs.books.noBooksInFormat}
            error={formatQuery.isError && !formatQuery.data}
            onRetry={() => formatQuery.refetch()}
          />
          {showLanguageShelf ? (
            <BookToggleShelf
              title={t.hubs.books.languageTitle}
              count={languageCount}
              options={[
                { value: "my", label: languageLabel("my") },
                { value: "en", label: languageLabel("en") },
              ]}
              value={shelfLanguage}
              onChange={(value) => setShelfLanguage(value as ShelfLanguage)}
              items={languageItems}
              loading={languageQuery.isPending}
              emptyMessage={t.hubs.books.noBooksInLanguage}
              error={languageQuery.isError && !languageQuery.data}
              onRetry={() => languageQuery.refetch()}
            />
          ) : null}

          <AuthorRail
            title={t.books.authorsTitle}
            authors={shelfAuthors}
            loading={authorsQuery.isLoading}
            onPressAuthor={goToAuthor}
            onSeeAll={openAuthors}
            seeAllLabel={t.common.seeAll}
            seeAllTone="text"
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <HubAllGrid
        scroll={scroll}
        header={pageTop}
        title={t.books.allBooks}
        toolbar={<HubAllToolbar countLabel={gridCount} people={authorsPill} />}
        chips={categoryChips}
        radios={formatRadios}
        note={t.library.newestFirst}
        moreRadios={languageRadios}
        items={gridBooks}
        keyExtractor={bookKey}
        renderCell={renderCell}
        renderSkeletonCell={renderSkeletonCell}
        loading={gridLoading}
        error={gridFailed}
        onRetry={retryGrid}
        emptyMessage={filtering ? t.hubs.books.noMatches : t.hubs.books.noBooksYet}
        emptyAction={filtering ? { label: t.common.reset, onPress: clearGridFilters } : null}
        hasNextPage={!!gridQuery.hasNextPage}
        fetchingNextPage={gridQuery.isFetchingNextPage}
        refetching={gridQuery.isFetching && !gridQuery.isFetchingNextPage}
        nextPageFailed={gridQuery.isFetchNextPageError}
        onLoadMore={loadMore}
        onRefresh={refresh}
        refreshing={pulling}
      />
    </View>
  );
}

interface CategoryShelfProps {
  category: BookCategory;
  /** The first category shelf wears the board's banner; the second is a plain row. */
  banner: boolean;
  /** GET /books?categoryId — undefined until it answers. */
  books: Book[] | undefined;
  /** That response's own total (bookCount counts unpublished books). */
  total: number | null;
  loading: boolean;
  /** The shelf's request failed with nothing cached. */
  failed: boolean;
  onRetry: () => void;
  toItem: (book: Book) => HubRowItem;
  /** The All grid on this category. */
  onSeeAll: (categoryId: string) => void;
}

/**
 * One category shelf: the banner (or the plain heading) over its covers —
 * placeholder covers while it loads, and its own Retry under the heading
 * when its request failed, so a failure never removes the shelf silently.
 */
function CategoryShelf({ category, banner, books, total, loading, failed, onRetry, toItem, onSeeAll }: CategoryShelfProps) {
  const { t } = useLanguage();
  const items = useMemo(() => (books ?? NO_BOOKS).map((book) => toItem(book)), [books, toItem]);
  const seeAll = () => onSeeAll(category.id);
  const heading = banner ? (
    <CategoryBanner
      name={category.name}
      lead={books?.[0] ?? null}
      count={total !== null ? booksCount(t, total) : null}
      onSeeAll={seeAll}
      seeAllAccessibilityLabel={t.hubs.books.seeAllCategory.replace("{category}", category.name)}
    />
  ) : null;

  if (failed) {
    return (
      <View>
        {heading ?? (
          <SectionHeader
            title={category.name}
            titleLines={3}
            onSeeAll={seeAll}
            seeAllLabel={t.common.seeAll}
            seeAllTone="text"
          />
        )}
        <ShelfRetry message={t.common.somethingWentWrong} onRetry={onRetry} />
      </View>
    );
  }

  return (
    <HubRow
      variant="cover"
      title={category.name}
      items={items}
      loading={loading}
      header={heading ?? undefined}
      onSeeAll={seeAll}
    />
  );
}

/** While the book categories load: the banner's block and three covers, so the rows below never jump. */
function CategoryShelfSkeleton() {
  const { t } = useLanguage();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={t.common.loading}>
      <View style={styles.bannerSkeleton}>
        <Skeleton height={148} radius="lg" />
      </View>
      <View style={styles.coverSkeletons}>
        {[0, 1, 2].map((i) => (
          <BookCardSkeleton key={i} width={COVER_SKELETON_WIDTH} />
        ))}
      </View>
    </View>
  );
}

/** HubRow's cover width (Books.dc.html: 116pt). */
const COVER_SKELETON_WIDTH = 116;

const bookKey = (book: Book) => book.id;
const renderSkeletonCell = (width: number) => <BookCardSkeleton width={width} />;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  rows: { gap: HUB_SECTION_GAP, paddingTop: 10 },
  /** The signed-out state starts below the pinned Media bar and chips. */
  signedOut: { flex: 1 },
  bannerSkeleton: { paddingHorizontal: theme.layout.screenPadding, marginBottom: 14 },
  coverSkeletons: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: theme.layout.screenPadding,
    overflow: "hidden",
  },
});
