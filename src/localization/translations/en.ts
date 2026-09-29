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
    /** A request that got no answer (offline, timeout, server down). */
    networkError: "Can't reach MyanFlix. Check your connection and try again.",
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
    signup: {
      /** Header from the password step on, once the number is known to be new. */
      title: "Sign up to continue",
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
      /** The new-account variant of `submit` — the button names the outcome. */
      createSubmit: "Sign up",
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
      /**
       * The code step sent the user back here: the server's proof of the
       * password step lasts 10 minutes and ends if the password changes.
       */
      stepExpired: "Please enter your password again to continue.",
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
      /**
       * POST /auth/otp/request's own 409s, for sign-in and reset alike: 60 s
       * between codes of one kind, 8 codes per number per hour of both kinds.
       */
      waitForCode: "Please wait a minute before requesting another code.",
      tooManyCodes: "Too many codes requested for this number. Please try again later.",
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
    /**
     * Reset with a one-time code, then sign in with the new password. Same
     * delivery wording rule as otp.subtitle: a code is "requested", never
     * "sent" — nothing is delivered on any channel yet.
     */
    forgotPassword: {
      title: "Forgot your password?",
      phoneHint:
        "Enter your account's phone number. A 6-digit code will be requested for it, then you can choose a new password.",
      requestCode: "Request code",
      resetTitle: "Choose a new password",
      newPasswordLabel: "New password",
      confirmPasswordLabel: "Confirm new password",
      submit: "Reset password",
      successTitle: "Password changed",
      /** A reset signs out every session and opens none. A reset code does not hold up the sign-in code. */
      successBody: "You've been signed out on every device. Sign in with your new password.",
      backToSignIn: "Back to sign in",
      noAccount: "No account uses this phone number.",
      inactive: "This account is no longer active.",
      tooManyAttempts: "Too many wrong codes. Request a new code and try again.",
      rateLimited: "Too many tries. Please wait a moment and try again.",
      passwordTooLong: "Password must be 72 characters or fewer.",
      genericError: "Couldn't reset your password. Please try again.",
    },
    /**
     * The boot found a saved session but could not reach the server to check
     * it. The session is kept — this is not a sign-out (see SessionOffline).
     */
    offline: {
      title: "Can't reach MyanFlix",
      body: "You're still signed in. Check your internet connection, then try again.",
      stillOffline: "Still can't connect. Check your connection and try again.",
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
    /** Heading above the round-photo cast row on the movie page. */
    cast: "Cast",
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
    /* ---- deleting the account (DELETE /users/me) ---- */
    deleteAccount: "Delete account",
    deleteAccountEntrySubtitle: "Close your account and remove your personal details",
    deleteAccountSubtitle: "This can't be undone.",
    deleteAccountPointData: "Your name, phone number and photo are removed, and you're signed out on every device.",
    deleteAccountPointRecords: "Your deposit, withdrawal and purchase records are kept for bookkeeping.",
    deleteAccountPointMoney:
      "Your wallet must be empty first, and no deposit or withdrawal can be waiting for review.",
    deleteAccountPointPhone: "You can sign up again later with the same phone number, as a new account.",
    deleteAccountButton: "Delete my account",
    deleteAccountConfirmTitle: "Delete your account?",
    deleteAccountConfirmBody: "Your account will be closed for good. This can't be undone.",
    deleteAccountConfirmAction: "Delete",
    deleteAccountBalanceError: "Your wallet still has money in it. Withdraw or spend it before deleting your account.",
    deleteAccountPendingDepositError:
      "You have a deposit waiting for review. Wait until it is approved or rejected, then try again.",
    deleteAccountPendingWithdrawalError:
      "You have a withdrawal waiting for review. Wait until it is approved or rejected, then try again.",
    deleteAccountStaffError: "Staff accounts can't be deleted from the app.",
    deleteAccountFailed: "Couldn't delete your account. Please try again.",
    deleteAccountDoneTitle: "Account deleted",
    deleteAccountDoneBody: "Your account is closed and you've been signed out.",
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
    /** The actors list searches names, so its field must say so rather than promising movies. */
    placeholderPeople: "Search people…",
    /** Its books twin — the authors list searches author names. */
    placeholderAuthors: "Search authors…",
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
    /* The All tab's poster rails — the Movies and Series sections above them
       are list cards under the plain tab nouns (`movies` / `series`). */
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
    /* ---- results header row (count left, filter button right) ----
       Every count is the BACKEND total, never however many pages loaded. With
       a term committed the line names it — the list is frozen while the user
       types, so this is what says which question the rows below answer. */
    resultsForTermCount: "{n} results for “{term}”",
    resultsForTermCountOne: "1 result for “{term}”",
    /** Idle counts — the tab's own noun, so "12 movies" rather than "12 results". */
    countMovies: "{n} movies",
    countMoviesOne: "1 movie",
    countSeries: "{n} series",
    countSeriesOne: "1 series",
    countBooks: "{n} books",
    countBooksOne: "1 book",
    /* The actors list's count line. It carries its own "for “term”" pair
       rather than borrowing the generic resultsForTermCount, which says
       "results" — a person is not a result. */
    countPeople: "{n} people",
    countPeopleOne: "1 person",
    countPeopleForTerm: "{n} people for “{term}”",
    countPeopleForTermOne: "1 person for “{term}”",
    /* The authors list's count line — the same four shapes, its own noun. */
    countAuthors: "{n} authors",
    countAuthorsOne: "1 author",
    countAuthorsForTerm: "{n} authors for “{term}”",
    countAuthorsForTermOne: "1 author for “{term}”",
    /* ---- list cards ---- */
    /** The movie row's pill. Plays when the viewer has access, otherwise opens the details page. */
    watchNow: "Watch Now",
    /** The series row's pill — an episode has to be picked on the details page first. */
    view: "View",
    /* ---- states ---- */
    noResultsTitle: "No matches",
    noResultsBody: "Nothing matched “{term}”. Try a different spelling, or remove a filter.",
    noResultsFiltersBody: "No titles match these filters.",
    idleTitle: "Find something to watch",
    idleBody: "Search by title, actor or director.",
    errorTitle: "Couldn't load results",
    /* The actors list's two empties, deliberately different questions: an
       EMPTY catalogue (no term) versus a term nobody matched. Only the
       second one offers an action, because only it has something to undo. */
    peopleEmptyTitle: "No people yet",
    peopleEmptyBody: "Nobody has been added to the catalogue yet. Cast members show up here as films are added.",
    noPeopleBody: "No one matched “{term}”. Try a different spelling, or clear the search.",
    /* The authors list's two empties — the same pair of questions as above,
       about the shelf instead of the cast. */
    authorsEmptyTitle: "No authors yet",
    authorsEmptyBody: "Nobody has been added to the library yet. Authors show up here as books are added.",
    noAuthorsBody: "No author matched “{term}”. Try a different spelling, or clear the search.",
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
    /** Filter sheet footer — {n} is the backend total for the filtered query. */
    showResults: "Show {n} results",
    showResultsOne: "Show 1 result",
    /** The footer button before the first count lands, or when it fails. */
    showResultsUnknown: "Show results",
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
    filterRating: "Rating",
    filterDuration: "Duration",
    durationShort: "Under 90 min",
    durationMedium: "90–120 min",
    durationLong: "Over 120 min",
    yearPresetThis: "This year",
    yearPresetLast5: "Last 5 years",
    yearPresetOlder: "1999 & older",
    /* ---- the ONE filter control (results header) and the SearchFilters page ---- */
    /** The results header's button — "Filter · 2" once anything is active. */
    filterButton: "Filter",
    /** Three surfaces, one word: the actor rail's heading, the People button
        in the results header, and the title of the actors list it opens. */
    people: "People",
    /** The same button on the BOOKS tab, and the title of the list it opens —
        a book has an author, not a cast. */
    authors: "Authors",
    /** The link beside the filter summary line under the tabs. */
    clearFilters: "Clear",
    /** The filters page's secondary footer button — puts the draft back to defaults. */
    reset: "Reset",
    /** Rating floor chips: Any / 7+ / 8+ / 9+. */
    ratingAny: "Any",
    ratingFloor: "{n}+",
    /** The first duration chip — no runtime bound. */
    durationAny: "Any",
  },
  actors: {
    /**
     * The credits caption under a name — on the actor page and in every
     * ActorsList cell — assembled by utils/actorCredits.ts from the backend
     * totals, never the rows loaded: "1 movie · 2 series", a zero part left
     * out, `noTitles` when both are zero.
     */
    moviesCount: "{n} movies",
    moviesCountOne: "1 movie",
    seriesCount: "{n} series",
    seriesCountOne: "1 series",
    /** Between the two parts of the caption when both are present. */
    creditsJoiner: " · ",
    noTitles: "Nothing here yet",
  },
  /** The actors block's twin, for the authors list and the author page. */
  authors: {
    /** The caption under the name on the author page, and each cell's caption in the list. */
    booksCount: "{n} books",
    booksCountOne: "1 book",
    noBooks: "No books yet",
  },
  settings: {
    preferences: "Preferences",
    languageScreenTitle: "Language / ဘာသာစကား",
    language: "Language",
    downloads: "Downloads & Cache",
    downloadsComingSoon: "Offline downloads aren't available yet.",
    support: "Support",
    privacyPolicy: "Privacy policy",
    privacyPolicySubtitle: "How MyanFlix handles your data",
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
    /** Since the C-4 change the amount leaves the balance at request time and comes back on a reject. */
    withdrawSuccessBody:
      "The amount has been set aside from your balance while an admin reviews your request. If it's rejected, the money goes back to your wallet.",
    withdrawEmpty: "No withdrawals yet",
    withdrawStatus: {
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
    },
    /**
     * The ledger row's chip (components/wallet/TransactionRow.tsx). Settled
     * rows carry none. "refunded" is a withdrawal hold whose request was
     * rejected: the money came back as the Refund row beside it.
     */
    transactionStatus: {
      pending: "Pending",
      failed: "Failed",
      refunded: "Refunded",
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
