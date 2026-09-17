export const en = {
  common: {
    appName: "MyanFlix",
    cancel: "Cancel",
    save: "Save",
    loading: "Loading…",
    retry: "Retry",
    back: "Back",
    close: "Close",
    seeAll: "See all",
    somethingWentWrong: "Something went wrong",
    logOut: "Log out",
    reset: "Reset",
    clear: "Clear",
    done: "Done",
    remove: "Remove",
    all: "All",
    showMore: "Show more",
    showLess: "Show less",
  },
  nav: {
    home: "Home",
    media: "Media",
    wallet: "Wallet",
    library: "Library",
    profile: "Profile",
  },
  auth: {
    login: {
      subtitle: "Log in to continue",
    },
    phone: {
      label: "Phone number",
      placeholder: "09xxxxxxxxx",
      continueButton: "Continue",
      validationError: "Please enter a valid phone number.",
      genericError: "Something went wrong. Please try again.",
      /** Ticket stub. Answers the question a first-timer has: where's Register? */
      stubNote: "One number covers both signing in and signing up.",
    },
    password: {
      /*
       * The hints dropped their `{phone}` token: the identity chip right above
       * them already shows the number, and repeating it is what pushed the two
       * long Burmese hints out of the header block. No code change needed —
       * PhoneAuthFlow's `.replace("{phone}", phone)` is a harmless no-op on a
       * string that carries no token.
       */
      newAccountHint: "This number isn't registered yet — create a password to continue.",
      existingAccountHint: "Enter the password for this number.",
      existingLabel: "Password",
      createLabel: "Create a password",
      confirmLabel: "Confirm password",
      placeholder: "Password",
      confirmPlaceholder: "Confirm password",
      submit: "Continue",
      forgotLink: "Forgot password?",
      validationError: "Password is required.",
      createValidationError: "Password must be at least 8 characters.",
      mismatchError: "Passwords do not match.",
      genericError: "Incorrect password. Please try again.",
      /**
       * The identity chip's accessibility label, on the password step AND the
       * OTP step — the chip has one call site and the chip's job is the same on
       * both, so `otp` deliberately carries no changePhone of its own. Keep
       * this wording step-neutral.
       */
      changePhone: "Change phone number",
      /** Ticket stub, new-account branch. Agrees with createValidationError. */
      stubNote: "Use at least 8 characters. You'll need this password next time you sign in.",
    },
    otp: {
      title: "Enter the code",
      /*
       * "was requested", never "we sent". Nothing is delivered on any channel
       * today — src/sms/sms.service.ts is a stub whose own header says no
       * provider is wired in — so the only thing that demonstrably happened is
       * the request itself, and the row OtpService wrote for it. Passive voice
       * with the request as the subject says that without inventing an actor.
       * "6-digit" and "5 minutes" are read off otp.service.ts (CODE_LENGTH,
       * CODE_TTL_MS), and the expiry is the single most useful thing you can
       * tell someone staring at six empty boxes. This string must never name a
       * channel: the request body carries none, so the server could not have
       * honoured a choice even if it could deliver.
       */
      subtitle: "A 6-digit code was requested for this number. It expires in 5 minutes.",
      placeholder: "6-digit code",
      submit: "Verify",
      /** Not "Resend" — that would claim a prior send. */
      resend: "Request a new code",
      resendCountdown: "Request again in {n}s",
      validationError: "Please enter the 6-digit code.",
      genericError: "Invalid or expired code. Please try again.",
    },
    /**
     * The OTP channel picker. UI ONLY — the choice is remembered on the device
     * and sent nowhere. See components/auth/OtpChannelPicker.tsx.
     */
    channel: {
      label: "Where should codes go?",
      /* Brand names stay Latin in BOTH dictionaries, like the arcade's titles
         and studios. "SMS" is what people say in Burmese too. */
      sms: "SMS",
      telegram: "Telegram",
      viber: "Viber",
      /**
       * The most important string on the screen. It says plainly that nothing
       * arrives yet (so nobody waits for a buzz and concludes the app is
       * broken) AND that the choice was kept anyway (so the picker is not
       * decoration). Never shorten it to one line, never let it truncate,
       * never soften it in translation.
       */
      pending: "Delivery isn't switched on yet — nothing has been sent. Your choice is saved for when it is.",
      /** Reserved: no caller yet. Occupies the same slot as `pending`. */
      unavailable: "{channel} isn't available for this number yet — use SMS.",
    },
    forgotPassword: {
      title: "Forgot your password?",
      /* Dropped "we send you" for the same reason as otp.subtitle: fixing the
         delivery claim on the login screen and leaving it on the screen one
         tap away would just make the app contradict itself. */
      body: "Sign in with your phone number and a one-time code — no password needed. If you still need help, please contact our support team.",
    },
  },
  /**
   * "The Arcade" storefront home. The shelf itself is local mock data
   * (src/data/games.ts) — every game's copy lives under `gameCopy`, keyed by
   * game id, so `mm satisfies typeof en` makes it impossible to ship a game
   * without Burmese copy. Titles, studios, genres and platform tags stay
   * Latin in BOTH languages; only descriptions translate.
   */
  arcade: {
    hero: {
      regionLabel: "Featured games",
      kicker: "Featured game",
      byStudio: "Made by {name}",
      explore: "Explore game",
      allGames: "All games",
      prev: "Previous game",
      next: "Next game",
      goTo: "Show {title}",
      slideLabel: "{n} of {total}",
    },
    badge: {
      live: "Live",
      new: "New",
      trending: "Trending",
      limited: "Limited",
      comingSoon: "Coming soon",
      online: "Online",
    },
    price: {
      free: "Free",
    },
    featured: {
      kicker: "The shelf",
      title: "Featured games",
    },
    promos: {
      kicker: "Spotlights",
      title: "Happening on MyanFlix",
      newRelease: "New release",
      freeToPlay: "Free to play",
      limitedEvent: "Limited-time event",
      expected: "Expected {year}",
    },
    events: {
      seasonUpdate: "Season update",
      multiplayerEvent: "Multiplayer event",
    },
    live: {
      kicker: "On right now",
      title: "Live and busy",
      playing: "playing",
      eventLive: "Event live",
    },
    discover: {
      kicker: "Discover",
      title: "Discover something new",
    },
    explore: {
      kicker: "Beyond games",
      title: "Explore more",
    },
    lanes: {
      film: "Film",
      series: "Series",
      book: "Book",
      music: "Music",
      game: "Game",
      anime: "Anime",
      podcast: "Podcast",
      live: "Live",
    },
    verbs: {
      watch: "Watch",
      read: "Read",
      listen: "Listen",
      play: "Play",
      join: "Join",
    },
    state: {
      preview: "Preview",
      soon: "Soon",
    },
    gameCopy: {
      "game-lacquer-city": "A rain-slicked open city where every alley remembers you. Trade, climb, and uncover the old quarter's secrets.",
      "game-monsoon-run": "Sprint the flooded streets with three friends before the storm closes in.",
      "game-the-long-quiet": "A signal is coming from an empty apartment block. Nobody should be answering.",
      "game-teahouse-letters": "Pour tea, read letters, and mend the lives that pass your counter.",
      "game-orbital-ferry": "Pilot the last ferry between failing stations — and decide who gets to board.",
      "game-the-ninth-floor": "Every night the hotel rearranges itself. Find the room that does not exist.",
      "game-shwe-market-tycoon": "Build the busiest stall in the market — haggle, stock up, and celebrate.",
      "game-emberfall": "Raise a fading ember-kingdom and lead its clans through the long dark.",
      "game-delta-drift": "Outrun the river patrol through delta backwaters in unsanctioned night races.",
      "game-paper-tigers": "Command paper armies across a folding board where the terrain is yours to crease.",
      "game-starlit-bazaar": "A night market strung between constellations. Set up shop when the stars open.",
      "game-signal-thirty": "Thirty minutes of tape. One frequency. Untangle the broadcast before it loops.",
    },
  },
  movie: {
    genre: "Genre",
    duration: "Duration",
    releaseYear: "Release Year",
    rating: "Rating",
    watchButton: "Watch",
    subscribeButton: "Subscribe",
    subscriptionLocked: "Subscribe to start watching",
    notReady: "This movie isn't ready to stream yet",
    speed: "Playback speed",
    free: "Free",
    premium: "Premium",
    playbackError: "Playback error",
    addToFavorites: "Add to favorites",
    removeFromFavorites: "Remove from favorites",
    share: "Share",
    language: "Language",
    similarMovies: "Similar Movies",
    synopsis: "Synopsis",
    details: "Details",
    /** Nullable metadata rows under the player — only shown once the admin has backfilled them. */
    director: "Director",
    country: "Country",
    ageRating: "Age rating",
  },
  player: {
    skipBack: "Skip back 10 seconds",
    skipForward: "Skip forward 10 seconds",
    play: "Play",
    pause: "Pause",
    mute: "Mute",
    unmute: "Unmute",
    enterFullscreen: "Enter fullscreen",
    exitFullscreen: "Exit fullscreen",
    subtitles: "Subtitles",
    subtitlesOff: "Off",
    subtitleSize: "Subtitle size",
    subtitleSizeSmall: "Small",
    subtitleSizeMedium: "Medium",
    subtitleSizeLarge: "Large",
    subtitleBackground: "Subtitle background",
    subtitleBackgroundOn: "On",
    subtitleBackgroundOff: "Off",
    buffering: "Buffering…",
    quality: "Quality",
    /** The master playlist — bandwidth picks the rendition, as it always has. */
    qualityAuto: "Auto",
    /** The same-category rail under a film; tapping a card plays it in place. */
    recommended: "Recommended",
  },
  series: {
    season: "Season {n}",
    episodeCount: "{n} episodes",
    episodesEmpty: "No episodes yet",
    episodesTitle: "Episodes",
    episodesLoadError: "Couldn't load episodes",
    subscribeToWatch: "Subscribe to watch",
    nowPlaying: "Now Playing",
    completed: "Completed",
    similarSeries: "Similar Series",
    /** One translated sentence — never assembled from two counts in the component. */
    seasonSummary: "{s} seasons · {e} episodes",
    startWatching: "Start watching",
    /** The gold mini-pill on a locked episode row. */
    lockedEpisode: "Subscribe",
    unlockedNote: "Unlocked by your subscription — every season and episode, including future ones.",
    seasonsStat: "Seasons",
    episodesStat: "Episodes",
    episodeFallbackTitle: "Episode {n}",
    storyline: "Storyline",
  },
  books: {
    title: "Books",
    searchPlaceholder: "Search books or authors…",
    loadError: "Couldn't load books",
    emptySearchTitle: "No books match that",
    emptySearchBody: "Try a different search or category.",
    emptyLibraryTitle: "The shelf is still being stocked",
    emptyLibraryBody: "New books land here as they're published.",
    notFoundTitle: "We couldn't find that book",
    notFoundBody: "It may have been unpublished or removed.",
    author: "Author",
    byAuthor: "by {author}",
    summary: "Summary",
    format: "Format",
    formatEditor: "Text",
    formatPdf: "Scanned pages",
    chaptersLabel: "Chapters",
    published: "Published",
    availableLanguages: "Available languages",
    readingIn: "Reading in {language}",
    chapterList: "Chapter list",
    /** Burmese has no plural form, so the singular is its own key — same shape as comments.count. */
    chapterCount: "{n} chapters",
    chapterCountOne: "1 chapter",
    pageCount: "{n} pages",
    pageCountOne: "1 page",
    sortOrder: "Reverse the order",
    noChapters: "No chapters yet.",
    chapterComingSoon: "Coming soon",
    startReading: "Start reading",
    continueReading: "Continue reading",
    /* ---- optional Part / Section hierarchy ---- */
    partLabel: "Part {n}",
    sectionsLabel: "Sections",
    pageRange: "p. {from}–{to}",
    pageAt: "p. {n}",
    reader: {
      contents: "Contents",
      partLabel: "Part {n}",
      display: "Display",
      previousChapter: "Previous chapter",
      nextChapter: "Next chapter",
      previousPage: "Previous page",
      nextPage: "Next page",
      /** The Burmese phrase reads total-first — which is why each is ONE string. */
      chapterOf: "Chapter {c} of {t}",
      chapterLabel: "Chapter {n}",
      loadError: "We couldn't load this part of the book.",
      emptyChapter: "This chapter is empty.",
      emptyBook: "This book has nothing to read yet.",
      stillConverting: "This chapter is still being prepared.",
      jumpToPage: "Go to page",
      finished: "You've reached the end.",
      textSize: "Text size",
      smaller: "Smaller text",
      larger: "Larger text",
      fitWidth: "Fit width",
      close: "Close the book",
      themes: {
        paper: "Paper",
        sepia: "Sepia",
        night: "Night",
        amoled: "AMOLED",
      },
      /* ---- reading-settings suite (v2) ---- */
      settingsTitle: "Reading settings",
      settings: "Settings",
      sectionAppearance: "Appearance",
      sectionLayout: "Layout",
      sectionPage: "Page",
      sectionBehavior: "Behavior",
      fontFamily: "Font",
      fontSerif: "Serif",
      fontSans: "Sans",
      fontDyslexic: "Easy read",
      sizeSmall: "Small",
      sizeMedium: "Medium",
      sizeLarge: "Large",
      sizeXL: "Extra large",
      lineSpacing: "Line spacing",
      lineCompact: "Compact",
      lineNormal: "Normal",
      lineRelaxed: "Relaxed",
      readingWidth: "Reading width",
      widthNarrow: "Narrow",
      widthMedium: "Medium",
      widthWide: "Wide",
      widthFull: "Full",
      margins: "Margins",
      marginSmall: "Small",
      marginMedium: "Medium",
      marginLarge: "Large",
      brightness: "Brightness",
      keepAwake: "Keep screen on",
      autoHideControls: "Auto-hide controls",
      fullscreen: "Fullscreen",
      exitFullscreen: "Exit fullscreen",
      alignment: "Alignment",
      alignJustify: "Justified",
      alignLeft: "Left",
      chapterTitleToggle: "Show chapter title",
      estMinutes: "~{n} min",
      chapterPercent: "Chapter {c} of {t} · {p}%",
      bookmark: "Bookmark",
      bookmarks: "Bookmarks",
      addBookmark: "Add bookmark",
      removeBookmark: "Remove bookmark",
      noBookmarks: "No bookmarks yet.",
      notesTab: "Notes",
      highlight: "Highlight",
      removeHighlight: "Remove highlight",
      noAnnotations: "Nothing saved in this book yet.",
      annotationsLocal: "Saved on this device",
      annotationLimit: "Limit reached — delete a few first.",
      hlYellow: "Yellow",
      hlGreen: "Green",
      hlBlue: "Blue",
      hlPink: "Pink",
      note: "Note",
      addNote: "Add note",
      editNote: "Edit note",
      notePlaceholder: "Write a note…",
      saveNote: "Save",
      copied: "Copied",
      textSelection: "Text selection",
      textSelectionHint: "Turns off long-press highlighting.",
      paragraph: "Paragraph",
      copyParagraph: "Copy paragraph",
      searchInBook: "Search in book",
      searchPlaceholder: "Search this book…",
      searchTooShort: "Type at least 2 characters.",
      searching: "Searching…",
      searchCount: "{n} results",
      searchCountOne: "1 result",
      searchNoResults: "No results found.",
      pageLayout: "Page layout",
      layoutSingle: "Single",
      layoutDouble: "Spread",
      layoutScroll: "Scroll",
      fitHeight: "Fit height",
      fitScreen: "Fit screen",
      zoom: "Zoom",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      zoomReset: "Actual size",
      rotate: "Rotate",
      thumbnails: "Pages",
      pageLabel: "Page {n}",
      firstPage: "First page",
      lastPage: "Last page",
      background: "Background",
      bgTheme: "Theme",
      bgBlack: "Black",
      bgGray: "Gray",
      bgWhite: "White",
      direction: "Direction",
      dirLtr: "Left to right",
      dirRtl: "Right to left",
    },
  },
  comments: {
    heading: "Comments",
    /**
     * Burmese has no plural form, so the singular is its own key rather than a
     * suffix rule applied to `count` — same shape as home.hero.dayLeft/daysLeft.
     */
    count: "{n} comments",
    countOne: "1 comment",
    placeholder: "Share what you thought\u2026",
    post: "Post",
    posting: "Posting\u2026",
    reply: "Reply",
    replyPlaceholder: "Write a reply\u2026",
    replyCount: "{n} replies",
    replyCountOne: "1 reply",
    showReplies: "Show replies",
    hideReplies: "Hide replies",
    emptyTitle: "No comments yet",
    emptyBody: "Be the first to say something about this title.",
    signedOutPrompt: "Sign in to join the conversation.",
    you: "You",
    loadError: "Couldn't load comments",
    postError: "Couldn't post your comment. Please try again.",
    /**
     * Relative timestamps. These four keys are read as a group by
     * utils/format.ts formatRelativeTime \u2014 keep all four, and keep "{n}" in the
     * three that count, so a language can put the unit wherever it belongs.
     */
    justNow: "Just now",
    minutesAgo: "{n}m ago",
    hoursAgo: "{n}h ago",
    daysAgo: "{n}d ago",
  },
  subscription: {
    title: "Subscribe",
    subtitle: "Choose a plan to unlock premium movies and series",
    walletBalance: "Wallet balance",
    subscribeButton: "Subscribe",
    insufficientBalance: "Insufficient balance. Top-ups aren't available in the app yet — please contact support.",
    alreadyActive: "You already have an active subscription",
    success: "Subscription activated",
    failure: "Subscription failed",
    noPlans: "No subscription plans are available right now",
    /** Plan length shown on each plan card; "{n}" is the day count. */
    planDuration: "{n} days",
    planDurationOne: "1 day",
    active: "Active",
    inactive: "Inactive",
    expiresOn: "Expires {date}",
  },
  profile: {
    watchHistory: "Watch History",
    favorites: "Favorites",
    settings: "Settings",
    memberSince: "Member since {date}",
    empty: "Nothing here yet",
    /* ---- the Account group and its two sheets ---- */
    account: "Account",
    editProfile: "Edit profile",
    editProfileSubtitle: "The name MyanFlix shows you by.",
    displayNameLabel: "Display name",
    /** The quiet line under the field whenever the name is not too long. */
    displayNameHint: "Leave it empty to be shown by your username.",
    displayNameTooLong: "Display name must be 40 characters or fewer.",
    usernameLabel: "Username",
    phoneLabel: "Phone number",
    phoneNotSet: "Not set",
    loginIdentityNote: "Your username and phone number are how you sign in, so they can't be changed here.",
    /** Generic failure for the rename — the server's own text is written for logs, not for this sheet. */
    profileUpdateFailed: "Couldn't save your profile. Please try again.",
    /* ---- the photo half of the Edit profile sheet ---- */
    photoSection: "Photo",
    photoSectionHint: "Shown on your profile and in the top bar.",
    changePhoto: "Change photo",
    uploadPhoto: "Upload photo",
    removePhoto: "Remove photo",
    /** The three formats the backend accepts; it checks the bytes, not just the name. */
    photoInvalidType: "Please choose a JPEG, PNG, or WebP image.",
    photoTooLarge: "Image must be 5 MB or smaller.",
    photoUploadFailed: "Couldn't update your photo. Please try again.",
    photoRemoveFailed: "Couldn't remove your photo. Please try again.",
    /** Spoken, not shown: the swapped avatar is the only visual confirmation. */
    photoUpdated: "Profile photo updated",
    photoRemoved: "Profile photo removed",
    photoPermissionDenied: "MyanFlix needs permission to open your photos.",
    photoOpenSettings: "Open Settings",
    changePassword: "Change password",
    changePasswordSubtitle: "Use a strong password you don't reuse elsewhere.",
    currentPasswordLabel: "Current password",
    newPasswordLabel: "New password",
    confirmPasswordLabel: "Confirm new password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    passwordTooShort: "New password must be at least 8 characters.",
    passwordMismatch: "The two passwords don't match.",
    passwordCurrentIncorrect: "Your current password is incorrect.",
    passwordUpdateFailed: "Couldn't update your password. Please try again.",
    updatePassword: "Update password",
    passwordUpdatedTitle: "Password updated",
    /**
     * Said out loud because a password change on a phone usually signs you
     * out, and here it deliberately does not — the backend leaves every
     * existing session alone.
     */
    passwordUpdatedBody: "You're still signed in on this device.",
  },
  search: {
    /**
     * One per searchable tab — the field has to name what it will actually
     * search, now that the suggestion panel under it lists that tab's own
     * kind. "All" uses the movies wording because its panel lists movies and
     * committing there lands on the Movies tab; Music has no field at all.
     */
    placeholderMovies: "Search movies…",
    placeholderSeries: "Search series…",
    placeholderBooks: "Search books…",
    noResults: "No results found",
    filterGenre: "Genre",
    filterLanguage: "Language",
    filterYear: "Year",
    allYears: "All years",
    all: "All",
    movies: "Movies",
    series: "Series",
    books: "Books",
    music: "Music",
    musicComingSoon: "Music isn't available yet.",
    booksReady: "Books are here — browse the full shelf.",
    /* The Books tab, signed out. /books is members-only, so a guest's grid is
       empty because of the ACCOUNT, not because of the network — saying so is
       the whole point of these two lines (the tab used to land on the generic
       "couldn't load results" error, which blamed the connection). */
    booksSignedOutTitle: "Sign in to read books",
    booksSignedOutBody: "The library is for members. Sign in or create an account to browse the shelf.",
    filters: "Filters",
    filterAccess: "Access",
    accessAll: "All",
    accessFree: "Free",
    accessSubscription: "Premium",
    recommendedRow: "Recommended for You",
    popularRow: "Popular",
    seriesRow: "Series",
    latestRow: "Latest Releases",
    /** The books shelf on the All tab — same wording the website's shelf uses. */
    newBooksRow: "New on the shelf",
    recent: "Recent searches",
    clearRecent: "Clear",
    /** Inline hint under the field while the term is shorter than SEARCH_MIN_LENGTH. */
    minChars: "Type at least {n} characters",
    /** Shown while the field holds a term the grid has not been asked to run
        yet. The grid deliberately does NOT follow the typing, so this line is
        what tells the user their text is a question waiting to be asked. */
    pendingSearch: "Tap to see results for “{term}”",
    resultsCount: "{n} results",
    /* ---- results band under the search field ---- */
    /** Kicker above the results heading. */
    resultsTitle: "Results",
    resultsForTerm: "Results for “{term}”",
    /** Match counts — always the BACKEND total, never however many pages loaded. */
    resultsFoundMovies: "{n} movies found",
    resultsFoundMoviesOne: "1 movie found",
    resultsFoundSeries: "{n} series found",
    resultsFoundSeriesOne: "1 series found",
    resultsFoundBooks: "{n} books found",
    resultsFoundBooksOne: "1 book found",
    /* ---- states ---- */
    noResultsTitle: "No matches",
    noResultsBody: "Nothing matched “{term}”. Try a different spelling, or remove a filter.",
    noResultsFiltersBody: "No titles match these filters.",
    idleTitle: "Find something to watch",
    idleBody: "Search by title, actor or director.",
    errorTitle: "Couldn't load results",
    /* ---- suggestion panel under the field ----
       One panel per catalogue, so the label and the empty line name the kind
       the rows actually hold. The unsuffixed pair is the MOVIES wording (and
       the "All" tab's, which commits to Movies). */
    suggestionsLabel: "Movie suggestions",
    suggestNoResults: "No movies match “{term}”",
    suggestionsLabelSeries: "Series suggestions",
    suggestNoResultsSeries: "No series match “{term}”",
    suggestionsLabelBooks: "Book suggestions",
    suggestNoResultsBooks: "No books match “{term}”",
    /** Shared by all three panels — a failed page is a failed page. */
    suggestError: "Couldn't load suggestions.",
    /** The panel's footer ROW — a control, not a caption. Tapping it is one of
        the ways a typed term reaches the grid, so it never mentions counts.
        One key for all three kinds: it says "results", not "movies", so it
        reads correctly under a list of series or books too. */
    seeAllResults: "See all results for “{term}”",
    /* ---- field ---- */
    fieldLabel: "Search the catalogue",
    clearField: "Clear search",
    clearAll: "Clear all",
    /** Filter sheet footer — {n} is the backend total for the filtered query. */
    showResults: "Show {n} results",
    showResultsOne: "Show 1 result",
    removeFilter: "Remove: {label}",
    filterSort: "Sort by",
    sortRelevance: "Relevance",
    sortRecentlyAdded: "Recently added",
    sortNewest: "Newest releases",
    sortOldest: "Oldest releases",
    sortRating: "Top rated",
    sortTitle: "Title A–Z",
    sortMostViewed: "Most viewed",
    /** Honest label for the frozen pre-subscription purchase table — never "Most popular". */
    sortMostPurchased: "Most purchased",
    sortMostPurchasedHint: "Based on purchases from the early-access era",
    filterActor: "Cast",
    actorSearchPlaceholder: "Search actors…",
    filterDirector: "Director",
    filterCountry: "Country",
    filterAgeRating: "Age rating",
    filterRating: "Rating",
    filterDuration: "Duration",
    durationShort: "Under 90 min",
    durationMedium: "90–120 min",
    durationLong: "Over 120 min",
    durationCustom: "Custom",
    yearPresetThis: "This year",
    yearPresetLast5: "Last 5 years",
    yearPresetOlder: "1999 & older",
  },
  settings: {
    preferences: "Preferences",
    languageScreenTitle: "Language / ဘာသာစကား",
    language: "Language",
    downloads: "Downloads & Cache",
    downloadsComingSoon: "Offline downloads aren't available yet.",
    support: "Support",
  },
  feedback: {
    entryTitle: "Send feedback",
    entrySubtitle: "Report a problem or suggest an idea",
    sheetTitle: "Send feedback",
    sheetSubtitle: "Tell us what's working and what isn't.",
    category: "What's this about?",
    /** Keys map onto the backend FeedbackCategory enum \u2014 see types/feedback.ts. */
    categories: {
      bug: "Something's broken",
      suggestion: "Suggestion",
      content: "Movies & series",
      payment: "Payments",
      other: "Something else",
    },
    message: "Your message",
    messagePlaceholder: "Tell us what happened, or what you'd like to see\u2026",
    messageHint: "{n}/{max} characters",
    submit: "Send feedback",
    categoryError: "Choose what your feedback is about.",
    messageError: "Please write at least {min} characters.",
    failure: "Couldn't send your feedback. Please try again.",
    /** Shown for the server's 429 \u2014 its own message is written for admins, not for this sheet. */
    rateLimited: "You've sent a lot of feedback in the last hour. Please try again later.",
    successTitle: "Thanks \u2014 we got it",
    successBody: "Our team reads every message that comes in. We'll look into this one.",
    /** Feedback is authenticated, so say so rather than letting it look anonymous. */
    privacyNote: "Sent from your MyanFlix account.",
  },
  notifications: {
    title: "Notifications",
    empty: "No notifications yet",
    markAllRead: "Mark all as read",
  },
  wallet: {
    balance: "Balance",
    transactions: "Transactions",
    recentTransactions: "Recent Transactions",
    totalSpent: "Total Spent",
    subscriptionStat: "Subscription",
    transactionTypes: {
      purchase: "Purchase",
      deposit: "Deposit",
      refund: "Refund",
      subscription: "Subscription",
      withdrawal: "Withdrawal",
      adjustment_credit: "Balance adjustment",
      adjustment_debit: "Balance adjustment",
    },
    depositButton: "Deposit",
    withdrawButton: "Withdraw",
    filterAll: "All",
    withdrawTitle: "Withdraw Funds",
    withdrawAccountType: "Account Type",
    withdrawAccountName: "Account Name",
    withdrawAccountNamePlaceholder: "Full name on the account",
    withdrawAccountNumber: "Account Number / Phone Number",
    withdrawBankName: "Bank Name",
    withdrawBankNamePlaceholder: "e.g. KBZ Bank",
    withdrawBankNameError: "Enter the bank that should receive this withdrawal.",
    withdrawAvailable: "Available balance: {balance}",
    withdrawConfirm: "You are requesting to withdraw {amount}.",
    withdrawNoType: "Select an account type to continue.",
    withdrawAccountError: "Enter the account name and account/phone number to receive your withdrawal.",
    withdrawAmountError: "Enter a valid amount.",
    amountRangeHint: "Amount must be between {min} and {max}.",
    amountRangeError: "Amount must be between {min} and {max}.",
    withdrawInsufficientError: "You can't withdraw more than your available wallet balance.",
    withdrawSubmit: "Submit Withdrawal",
    withdrawFailure: "Couldn't submit withdrawal. Please try again.",
    withdrawSuccessTitle: "Withdrawal requested",
    withdrawSuccessBody: "Your withdrawal is pending admin approval — your balance updates only once it's approved.",
    withdrawEmpty: "No withdrawals yet",
    withdrawStatus: {
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
    },
    depositTitle: "Deposit Funds",
    depositAmount: "Amount (Ks)",
    depositMethod: "Payment Method",
    depositNoMethods: "No payment methods are available right now. Please try again later.",
    depositSendTo: "Send To",
    depositChooseAccount: "Choose an Account",
    depositAccountNumber: "Account Number",
    depositBankName: "Bank",
    depositReferenceLabel: "Transaction Reference",
    depositReferenceHelp: "Enter the exact 6-digit reference number from your {method} payment.",
    depositReferenceError: "Enter the exact 6-digit transaction reference from your payment.",
    depositAmountError: "Enter a valid amount.",
    depositSubmit: "Submit Deposit",
    depositFailure: "Couldn't submit deposit. Please try again.",
    depositSuccessTitle: "Deposit submitted",
    depositSuccessBody: "Your deposit is pending admin approval — your balance will update once it's reviewed.",
    depositEmpty: "No deposits yet",
    depositReference: "Ref {ref}",
    depositStatus: {
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
    },
  },
};

export type TranslationShape = typeof en;
