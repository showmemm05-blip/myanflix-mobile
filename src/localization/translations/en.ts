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
      /**
       * POST /auth/otp/request's 503: the SMS gateway phone could not take the
       * code (offline, or the day's SMS cap is used up). Nothing was kept, so
       * the resend wait is not spent.
       */
      smsUnavailable: "SMS service is temporarily unavailable. Please try again shortly.",
    },
    /**
     * The "Get your code" step (components/auth/OtpMethodPicker.tsx), shown
     * after the password step and after forgot-password's phone step. Nothing
     * is requested until a method is tapped. Only SMS works; Telegram and Viber
     * are shown disabled with `comingSoon`. Brand names stay Latin in BOTH
     * dictionaries.
     */
    method: {
      title: "Get your code",
      subtitle: "Choose how you want to receive your 6-digit code.",
      sms: "Get code by SMS",
      telegram: "Get code by Telegram",
      viber: "Get code by Viber",
      comingSoon: "Coming soon",
      /** Screen-reader label of a disabled method row. */
      comingSoonA11y: "{method}. Coming soon — not available yet.",
      /** On the code step: back to this step, without requesting anything. */
      chooseAnother: "Choose another method",
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
    /** Spoken names of the step rails (the bars over the sign-in title and in the reset top bar). */
    steps: {
      signIn: "Sign-in steps",
      reset: "Password reset steps",
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
    a11y: {
      /** Spoken on a featured game card after its platforms. {rating} = "9.0". */
      rated: "rated {rating}",
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
    rating: "Rating",
    watchButton: "Watch",
    subscribeButton: "Subscribe",
    subscriptionLocked: "Subscribe to start watching",
    notReady: "This movie isn't ready to stream yet",
    speed: "Playback speed",
    free: "Free",
    premium: "Premium",
    /** The crimson tab on a new title's poster. */
    newBadge: "New",
    /** Spoken on a poster card that carries a watch-progress line. {n} = whole percent. */
    watchedPercent: "{n}% watched",
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
    /** The kind line beside the access badge in a detail hero. */
    kindFilm: "Film",
    /** The short stat-strip labels under a detail hero (rating · year · length · age). */
    statRating: "Rating",
    statYear: "Year",
    statLength: "Length",
    statAge: "Age",
    /** The label under the heart in a detail page's action row (the app's Favorites list). */
    favoritesAction: "Favorites",
    /** The landscape rail under Similar Movies — the category's most-watched titles. */
    recommendedTitle: "Recommended for you",
    recommendedSubtitle: "Most watched in {category}",
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
    /** Spoken name of the seek line. */
    seek: "Seek",
    /** Spoken value of the seek line; both are clock times ("18:40"). */
    seekValue: "{position} of {duration}",
    /** The Next-episode control (series only, hidden on the last episode). */
    nextEpisode: "Next episode",
    /** Spoken on the Next-episode control; {title} is the next episode's tag and title. */
    nextEpisodeLabel: "Next episode, {title}",
    /** The portrait control that opens the settings panel on its speed tab. */
    speedAndQuality: "Playback speed and quality",
    /** Spoken name of the tabbed settings panel. */
    settingsTitle: "Player settings",
    /** A control's spoken name with its current state, e.g. "Subtitles, MY". */
    controlState: "{label}, {value}",
    /** Spoken on an episode card: "Episode 3, Teashop at Dawn". */
    episodeCardLabel: "Episode {n}, {title}",
    /** Joins the extra facts read out on an episode card (runtime, Now Playing, Completed). */
    listSeparator: ", ",
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
    startWatching: "Start watching",
    /** The gold mini-pill on a locked episode row. */
    lockedEpisode: "Subscribe",
    unlockedNote: "Unlocked by your subscription — every season and episode, including future ones.",
    seasonsStat: "Seasons",
    episodesStat: "Episodes",
    episodeFallbackTitle: "Episode {n}",
    /** The kind line beside the access badge in the series hero. */
    kindSeries: "Series",
    /** Season + episode as one short code, e.g. "S1 E3". */
    episodeCode: "S{s} E{e}",
    /** The hero line and Play label once the viewer has started the show. */
    continueWatching: "Continue watching",
    /** Under a part-watched episode — whole minutes still to watch. */
    minutesLeft: "{n}m left",
    /** Spoken by the hero's Play button: action, series title, episode. */
    playEpisodeA11y: "{action}, {title}, season {s} episode {e}",
    /** Spoken by an episode row. */
    episodeA11y: "Episode {n}, {title}",
  },
  books: {
    title: "Books",
    searchPlaceholder: "Search books or authors…",
    loadError: "Couldn't load books",
    emptySearchTitle: "No books match that",
    emptySearchBody: "Try a different search or category.",
    notFoundTitle: "We couldn't find that book",
    notFoundBody: "It may have been unpublished or removed.",
    byAuthor: "by {author}",
    format: "Format",
    formatEditor: "Text",
    formatPdf: "Scanned pages",
    chaptersLabel: "Chapters",
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
    /* ---- Marquee Books screens ---- */
    /** The Books hero's overline and the shelf under it — the newest books. */
    newOnShelf: "New on the shelf",
    details: "Details",
    allBooks: "All books",
    /** Overline on a category shelf's banner. */
    category: "Category",
    authorsTitle: "Authors",
    /** Spoken name of the Books filter-chip row. */
    filterLabel: "Filter books",
    moreBy: "More by {author}",
    publishedOn: "Published {date}",
    /* ---- optional Part / Section hierarchy ---- */
    partLabel: "Part {n}",
    sectionsLabel: "Sections",
    pageRange: "p. {from}–{to}",
    pageAt: "p. {n}",
    reader: {
      contents: "Contents",
      partLabel: "Part {n}",
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
      alignment: "Alignment",
      alignJustify: "Justified",
      alignLeft: "Left",
      chapterTitleToggle: "Show chapter title",
      estMinutes: "~{n} min",
      chapterPercent: "Chapter {c} of {t} · {p}%",
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
      /** Overline over the page reader's fit choices. */
      fit: "Fit",
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
    moreReplies: "Show {n} more replies",
    moreRepliesOne: "Show 1 more reply",
    loadingReplies: "Loading replies\u2026",
    repliesLoadError: "Couldn't load more replies",
    emptyTitle: "No comments yet",
    emptyBody: "Be the first to say something about this title.",
    signedOutPrompt: "Sign in to join the conversation.",
    you: "You",
    loadError: "Couldn't load comments",
    postError: "Couldn't post your comment. Please try again.",
    /** The server's two per-account 429s, by code; the second is the daily cap. */
    rateLimited: "You're posting too quickly. Please wait a minute and try again.",
    dailyLimit: "You've reached today's comment limit. Please try again tomorrow.",
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
    insufficientBalance: "Insufficient balance. Add money to your wallet, then try again.",
    /** The button under that notice — opens the Wallet tab's Deposit sheet. */
    addMoney: "Add money",
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
    memberSince: "Member since {date}",
    empty: "Nothing here yet",
    /* ---- the "Your library" group (the Library tab's things, since it became Profile) ---- */
    yourLibrary: "Your library",
    /** The saved-titles row in "Your library" (the owner's name for it; "See all" opens the Favorites page). */
    myList: "My List",
    /** Under the empty Favorites row. */
    favoritesRowEmpty: "Titles you save appear here",
    /** Spoken name of a row's "See all" link: "{name}" is the row's title. */
    seeAllNamed: "See all, {name}",
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
    /* The Books tab, signed out. /books is members-only, so a guest's grid is
       empty because of the ACCOUNT, not because of the network — saying so is
       the whole point of these two lines (the tab used to land on the generic
       "couldn't load results" error, which blamed the connection). */
    booksSignedOutTitle: "Sign in to read books",
    booksSignedOutBody: "The library is for members. Sign in or create an account to browse the shelf.",
    /** The same note on the search screen's Books scope (MediaSearch.dc.html, "guest"). */
    booksSignedOutSearchTitle: "Sign in to search books",
    booksSignedOutSearchBody: "The library is for members. Sign in or create an account to search the shelf.",
    /** The search screen before a search, when the scope's own suggestions failed to load. */
    idleErrorTitle: "Couldn't load suggestions",
    idleErrorBody: "You can still type a search above.",
    /** The search screen's round back button, when it returns to the Media page (MediaSearch.dc.html). */
    backToMedia: "Back to Media",
    filters: "Filters",
    /** The search screen's Books scope before a search — same wording the website's shelf uses. */
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
    /* ---- states ---- */
    noResultsTitle: "No matches",
    noResultsBody: "Nothing matched “{term}”. Try a different spelling, or remove a filter.",
    noResultsFiltersBody: "No titles match these filters.",
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
       the "All" scope's, which commits to Movies). */
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
    /* ---- the Media page's sort names (Netflix's words over honest sources) ----
       Popular = sort=mostViewed; Trending now = mostViewed among releases
       from last year on (there is no trend data); New releases = newest
       (release year). The CategoryDetail page keeps the names above. */
    sortPopular: "Popular",
    sortTrending: "Trending now",
    sortNewReleases: "New releases",
    /** In the Sort & filter sheet's Year group while Trending now is the sort — it owns the years. */
    trendingYearNote: "Trending now covers titles released since {year}.",
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
    /** CategoryDetail's filtered-empty state: the button that clears its filters. */
    clearFilters: "Clear",
    /** The filters page's secondary footer button — puts the draft back to defaults. */
    reset: "Reset",
    /** Rating floor chips: Any / 7+ / 8+ / 9+. */
    ratingAny: "Any",
    ratingFloor: "{n}+",
    /** The first duration chip — no runtime bound. */
    durationAny: "Any",
    /**
     * The one access filter (accessType=FREE): the switch in the Sort & filter
     * sheet, and its chip in the filter row.
     */
    freeOnly: "Free only",
    /* ---- the Sort & filter sheet and the filter row ---- */
    /** The sheet's title and the pill that opens it (with a count badge once anything is active). */
    sortAndFilter: "Sort & filter",
    sortAndFilterActiveA11y: "Sort & filter, {n} active",
    /** The filter row's last link — removes every value its chips stand for. */
    clearAll: "Clear all",
    /** A Media results view that the filters emptied: the button that clears them (the genre stays). */
    clearFiltersButton: "Clear filters",
    /** The sheet's folded group: Rating and Length (movies). */
    moreFilters: "More filters",
    /** The sheet's link to the full Filters page. */
    allFilters: "All filters",
    allFiltersA11y: "All filters, on a full page",
    /** A grid's next page failed: an inline line with Retry (never a "Load more" button). */
    nextPageError: "Couldn't load more.",
    nextPageRetryA11y: "Retry loading more",
    /* ---- the search screen before a search (All / Movies scopes) ----
       "Trending" is the most-watched titles (movies sort=mostViewed) — there is
       no search-trend data, so the caption says what the list really is. */
    trendingTitle: "Trending searches",
    trendingCaption: "Most watched on MyanFlix",
    /** The top-rated three, renamed from the plain "Movies". */
    popularMovies: "Popular movies",
    /** The search screen's door to the Browse page. */
    browseCategories: "Browse categories",
    browseCategoriesBody: "Find movies by category",
    /** Spoken rank on a trending row: "Number 1, …". */
    rankA11y: "Number {n}",
    /** Spoken part of a poster's label when it carries a rating. */
    ratedA11y: "rated {n}",
    /** The poster's play disc, spoken with the title. */
    watchNowA11y: "Watch Now, {title}",
    /** A recent-search chip, spoken. */
    searchAgainA11y: "Search again for {term}",
    clearRecentA11y: "Clear recent searches",
    /* ---- Marquee: the filter row under the tabs ---- */
    /** Every chip in the filter row removes its own value. */
    removeFilterA11y: "{label}, remove filter",
    /** The filter row's Clear all, spoken. */
    clearFiltersA11y: "Clear filters",
    /* ---- Marquee: the filters page ---- */
    /** The line under the page title — {kind} is Movies or Series. */
    filtersContext: "{kind} · results for “{term}”",
    /** A facet heading's right-hand note. */
    selectedCount: "{n} selected",
    facetAny: "Any",
    ratingAnyA11y: "Any rating",
    ratingFloorA11y: "{n} and up",
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
    /** The quiet caption beside the Series and Movies headings on a person's page. */
    newestFirst: "Newest first",
  },
  /** The Browse page (every category) and the category page's own new parts. */
  browse: {
    title: "Categories",
    count: "{n} categories",
    countOne: "1 category",
    /** Movie-only counts: the API has no per-category series count. */
    moviesCount: "{n} movies",
    moviesCountOne: "1 movie",
    moreCategories: "More categories",
    searchA11y: "Search",
    empty: "No categories yet",
    /** The small crimson line above a category page's name. */
    categoryOverline: "Category",
    topRated: "Top rated",
    recentlyAdded: "Recently added",
    allMovies: "All {name} movies",
    allSeries: "All {name} series",
  },
  /**
   * The Movies / Series / Books hubs (docs/mobile-hub-pages-2026-10-02) — the
   * Media tab's root, one per chip (docs/mobile-media-page-2026-10-02). The
   * chips reuse search.movies / series / books / music and the Categories
   * chip browse.title; the shelves and the results view reuse the search.sort*
   * names (Trending now, Popular, New releases…) and search.count*.
   */
  hub: {
    /** The hero carousel's spoken name. */
    featuredMovies: "Featured movies",
    /** The kicker on a featured title that is not NEW. */
    featured: "Featured",
    /** Spoken with a slide's first line: "Featured movies, 2 of 5". */
    slidePosition: "{n} of {total}",
    /** A story-pager segment, and the announcement on every change of slide. */
    slideLabel: "{n} of {total}: {title}",
    /** Home's dots pager: the arrows' spoken names, and "3 / 12" when there are too many dots to fit. */
    previousSlide: "Previous slide",
    nextSlide: "Next slide",
    slideCounter: "{n} / {total}",
    /** The hero's watchlist toggle (the Library's Favorites list). */
    myList: "My List",
    /** Spoken on the hero's info button. */
    moreAbout: "More about {title}",
    /** Spoken on the hero's main button: "Play, The Last Monsoon". */
    actionTitleA11y: "{action}, {title}",
    freeToWatch: "Free to watch",
    freeSubtitle: "No subscription needed",
    allMovies: "All movies",
    noMoviesInGenre: "No movies in this genre yet.",
    noMoviesYet: "No movies yet.",
    /** The A–Z sort's short name in the Sort & filter sheet and its chip. */
    sortAz: "A–Z",
    /** The EMPTY hero — what each hub's hero says when there is nothing to feature yet. */
    emptyMoviesTitle: "No movies yet",
    emptyMoviesBody: "New movies will appear here.",
    emptySeriesTitle: "No series yet",
    emptySeriesBody: "New series will appear here.",
    /** Series exist, but none has an episode yet — only those can be featured. */
    emptyEpisodesTitle: "No episodes yet",
    emptyEpisodesBody: "New episodes will appear here.",
    emptyBooksTitle: "No books yet",
    emptyBooksBody: "New books will appear here.",
    /** The small tag on the Music chip. */
    soon: "Soon",
    /** The chip row's spoken name. */
    sectionsA11y: "Media sections",
    /* ---- the Netflix-style results view and Categories overlay ---- */
    /** The chip row's round ✕ in a results view: {type} is Movies or Series. */
    clearSelectionA11y: "Clear, back to {type}",
    /** The chip row's picked genre or category, which reopens the overlay. */
    changeCategoryA11y: "{name}, change category",
    /** The overlay's spoken name: "Movies categories". */
    categoriesOverlayA11y: "{type} categories",
    /** The overlay's heading over the genres (the admin categories sit under browse.title). */
    genresHeading: "Genres",
    categoriesLoadError: "Couldn't load the categories.",
    /** The overlay's Books segment for a guest — book categories are members-only. */
    booksCategoriesSignIn: "Sign in to see book categories",
    /** Its button. */
    signIn: "Sign in",
    noMoviesInCategory: "No movies in this category yet.",
    /** The same, naming the picked category: "No movies in Thriller yet." */
    noMoviesInNamedCategory: "No movies in {category} yet.",
    /** The Music chip's page (MediaMusic.dc.html). */
    musicSoonTitle: "Music is coming soon",
    musicSoonBody: "Songs and albums will play right here.",
  },
  /** Page-specific strings of each hub, one block per page (the shared ones are in `hub`). */
  hubs: {
    /** The Series hub (Series.dc.html). */
    series: {
      /** The hero carousel's spoken name, and the kicker on a title that is neither NEW nor started. */
      featured: "Featured series",
      /** The hero's main button once the viewer has started the show; {code} is series.episodeCode ("S1 E3"). */
      resumeCode: "Resume {code}",
      /** …and before they have: "Play S1 E1". */
      playCode: "Play {code}",
      /** The resume label for an episode with no number. */
      resume: "Resume",
      seasons: "{n} seasons",
      seasonsOne: "1 season",
      episodes: "{n} episodes",
      episodesOne: "1 episode",
      newSeries: "New series",
      allSeries: "All series",
      noSeriesInGenre: "No series in this genre yet.",
      noSeriesYet: "No series yet.",
      /** A category picked in the Categories overlay holds no series (yet). */
      noSeriesInCategory: "No series in this category yet.",
      /** The same, naming it: "No series in Thriller yet." */
      noSeriesInNamedCategory: "No series in {category} yet.",
      /**
       * A category's count while more pages remain — GET /series cannot
       * filter by category, so its series are counted as pages load: "12+ series".
       */
      countAtLeast: "{n}+ series",
    },
    /**
     * The Books hub (Books.dc.html — the Media tab's Books chip). Reuses
     * books.* (startReading, continueReading, formatEditor/Pdf, newOnShelf,
     * details, allBooks, category, format, moreBy, loadError),
     * authors.booksCount and library.newestFirst.
     */
    books: {
      /** The hero carousel's spoken name. */
      featured: "Featured books",
      /** The second line on "Continue reading": "Chapter 3 · 40% read". {chapter} is books.reader.chapterLabel. */
      progressLine: "{chapter} · {percent}% read",
      /** …when the bookmarked chapter's number is not known (yet). */
      percentRead: "{percent}% read",
      /** The format shelf's heading — its toggle is books.formatEditor / formatPdf. */
      formatTitle: "Text or scanned pages",
      /** The language shelf's heading — its toggle shows each language by its own name. */
      languageTitle: "Burmese or English",
      /** The All grid's first format radio. */
      anyFormat: "Any format",
      /** The All grid's count under a category chip; the unfiltered count is authors.booksCount. */
      countInCategory: "{n} in {category}",
      noMatches: "No books match these filters yet.",
      noBooksYet: "No books on the shelf yet.",
      noBooksInFormat: "No books in this format yet.",
      noBooksInLanguage: "No books in this language yet.",
      /** Spoken on the category banner's "See all" pill. */
      seeAllCategory: "See all, {category}",
      /** The All grid's language radios: the first one, and the row's spoken name. */
      anyLanguage: "Any language",
      languageGroup: "Language",
      /** In place of the category shelves when GET /book-categories failed. */
      categoriesError: "Couldn't load the book categories.",
    },
  },
  /** The actors block's twin, for the authors list and the author page. */
  /**
   * The Home tab (owner, 2026-10-08: Home is movies, series and books —
   * HomeMovies.dc.html). Only the words no other section already has: the
   * rows reuse library.continueWatching, browse.recentlyAdded,
   * hubs.series.newSeries, books.newOnShelf, browse.topRated, hub.myList,
   * hub.featured and common.seeAll.
   */
  home: {
    /** The hero carousel's spoken name (it mixes movies and series). */
    featuredTitles: "Featured titles",
    top10: "Top 10 most viewed",
    /** "Because you watched The Last Monsoon". */
    becauseYouWatched: "Because you watched {title}",
    /** The quiet line under it: "More Drama". */
    moreOf: "More {name}",
    /* ---- the showcase (owner, 2026-10-08: HomeMobile.dc.html) ---- */
    /** A promo slide's button when the team left the label empty. */
    ctaSubscribe: "Subscribe",
    ctaAddMoney: "Add money",
    ctaOpen: "Open",
    ctaLearnMore: "Learn more",
    signInToSubscribe: "Sign in to subscribe",
    signInToAddMoney: "Sign in to add money",
    /** Under a Subscribe promo: "10,000 Ks" then "for 30 days · or 4,000 Ks for 10 days". */
    planFor: "for {days}",
    planOr: "or {price} for {days}",
    /* the value strip */
    whyKicker: "Why MyanFlix",
    whyTitle: "Made for Myanmar, on any connection",
    valueStoriesTitle: "Myanmar stories",
    valueStoriesLine: "Movies, series and books in one app.",
    valueHdTitle: "HD that adapts",
    valueHdLine: "240p to 720p, switching with your connection.",
    valueBooksTitle: "Books with chapters",
    valueBooksLine: "Read chapter by chapter, free when you sign in.",
    valuePayTitle: "Pay the Myanmar way",
    valuePayLine: "KBZPay or WavePay.",
    /* the spotlight */
    spotlightA11y: "Spotlight",
    spotlightChip: "Spotlight",
    spotlightNewestChip: "Newest movie",
    spotlightPicked: "Picked by the MyanFlix team",
    spotlightNewest: "The newest movie on MyanFlix",
    /** The spotlight's button on a book. */
    read: "Read",
    /* the Premium band */
    premiumAside: "Pay from your wallet",
    premiumTitle: "Every Premium movie and series. One plan.",
    premiumBody: "A plan unlocks everything marked Premium on MyanFlix. Renewing adds the days onto your current expiry.",
    planEveryPremium: "Every Premium movie and series",
    planStreams: "Streams at 240p–720p",
    bestValue: "Best value",
    /** Under a plan's price: "400 Ks a day", or "about 333 Ks a day" when it does not divide evenly. */
    planPerDay: "{price} a day",
    planPerDayAbout: "about {price} a day",
    planA11y: "{name} plan, {price} for {days}",
    planBestA11y: "{name} plan, {price} for {days}, best value",
    /** An active subscriber: "Your plan" over "Premium · expires 8/11/2026". */
    yourPlan: "Your plan",
    yourPlanLine: "{plan} · expires {date}",
    extend: "Extend",
    premiumNote: "Top up with any of these, then subscribe from your balance. No auto-charge: a plan simply ends unless you renew.",
    plansUnavailable: "The plans couldn't be loaded right now.",
    /** The payment chips' spoken name. */
    payMethodsA11y: "Ways to add money: {list}",
    /* the books band */
    booksTitle: "Read on MyanFlix",
    booksPitch: "Novels and stories, chapter by chapter, in a reader that keeps your place.",
    openShelf: "Open the shelf",
    signInToRead: "Sign in to read",
    booksFree: "Books are free to read when you sign in.",
    /* coming soon */
    comingKicker: "On the way",
    comingTitle: "Coming soon to MyanFlix",
    /** A card's chip when the team gave no date. */
    comingSoonChip: "Coming soon",
    gamesTitle: "Games",
    gamesLine: "Games are on the way to MyanFlix.",
    /* the bottom card */
    webTitle: "Also on the web",
    webBody: "Same account, same wallet, in any browser.",
    webOpenA11y: "Open MyanFlix on the web, {address}",
  },
  authors: {
    /** The caption under the name on the author page, and each cell's caption in the list. */
    booksCount: "{n} books",
    booksCountOne: "1 book",
    noBooks: "No books yet",
    /** Spoken name of the Authors search field. */
    searchLabel: "Search authors",
  },
  /** Library tab, Watch History, Favorites and the Profile activity rails (Marquee, 2026-10-02). */
  library: {
    continueWatching: "Continue watching",
    /** A count of titles; `titlesCountOne` when n is 1. */
    titlesCount: "{n} titles",
    titlesCountOne: "1 title",
    /** Favorites live in this phone's storage only — said wherever they are counted. */
    savedOnPhone: "Saved on this phone",
    savedCount: "{n} saved on this phone",
    /** Watch History's order, beside its count. */
    newestFirst: "Newest first",
    /** Under "Nothing here yet" on the Library's resume panel when nothing is watched or saved. */
    emptyBody: "What you watch and save will gather here.",
    browse: "Browse",
    historyEmptyBody: "Movies and episodes you play will show up here.",
    favoritesEmptyBody: "Tap Add to favorites on any movie or series to keep it here.",
    /** "{time}" is a runtime such as "47m" or "1h 2m". */
    timeLeft: "{time} left",
    /** A title played to 95% or more — the app's "start over" point. */
    watched: "Watched",
    today: "Today",
    yesterday: "Yesterday",
    sortBy: "Sort by",
    sortRecent: "Recently saved",
    sortTitle: "Title A–Z",
    sortYear: "Release year",
    sortRating: "Rating",
    /** Spoken name of the Favorites sort + filter row. */
    sortAndFilter: "Sort and filter",
    done: "Done",
    /** Spoken name of a poster's heart button. */
    removeNamed: "Remove from favorites: {title}",
    /** Spoken name of the gold crown on a subscriber's avatar. */
    premiumMember: "Premium member",
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
    /** The bell's spoken label while the unread dot shows. */
    titleUnread: "Notifications, unread",
    empty: "No notifications yet",
    markAllRead: "Mark all as read",
    /** The line under the page title; {n} comes from the bell's unread count. */
    unreadCount: "{n} unread",
    allRead: "All read",
    /** Spoken first on an unread row. */
    unread: "Unread",
  },
  wallet: {
    balance: "Balance",
    transactions: "Transactions",
    recentTransactions: "Recent Transactions",
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
    /* ---- Wallet redesign (2026-10-01): balance, overview, history, steps ---- */
    availableBalance: "Available balance",
    hideBalance: "Hide balance",
    showBalance: "Show balance",
    /** Spoken in place of the amount while the balance is hidden. */
    balanceHiddenA11y: "Balance hidden",
    balanceUpdated: "Balance updated: {amount}",
    balanceStale: "Couldn't refresh — showing the last known balance",
    /** A pending withdrawal's hold; the money already left the balance (C-4). */
    onHold: "{amount} on hold for withdrawal",
    historyButton: "History",
    allTime: "All time",
    /** A total summed over the newest rows only, because not every row could be loaded. */
    awaitingApproval: "Awaiting approval",
    today: "Today",
    yesterday: "Yesterday",
    listError: "Couldn't load this list",
    searchPlaceholder: "Search amount, reference or name",
    searchA11y: "Search transactions",
    clearFilters: "Clear filters",
    filterType: "Type",
    filterStatus: "Status",
    anyStatus: "Any status",
    anyType: "Any type",
    filterDate: "Date",
    filterCompleted: "Completed",
    filterFailedRefunded: "Failed or refunded",
    filterAdjustment: "Adjustment",
    range7: "Last 7 days",
    range30: "Last 30 days",
    range90: "Last 90 days",
    resultsCount: "{count} results",
    resultsCountOne: "{count} result",
    /** Client-side matches over the pages loaded so far, out of the server's total. */
    loadedNote: "Showing matches from {loaded} of {total} loaded",
    loadMore: "Load more",
    noMatches: "No matching transactions",
    noMatchesHint: "Try a different search, type or date range.",
    amountInA11y: "plus {amount}",
    amountOutA11y: "minus {amount}",
    amountHiddenA11y: "Amount hidden",
    copyAccountNumber: "Copy account number",
    copied: "Account number copied",
    stepOf: "Step {n} of {total}",
    /** The short step count in a money flow's header, beside the title. */
    stepCount: "{n} of {total}",
    continue: "Continue",
    depositStepAmount: "Amount and method",
    depositStepConfirm: "Send the money, then confirm",
    depositNextNote:
      "Next, send the money to this account and enter the 6-digit reference. Your balance updates once staff confirm the transfer.",
    withdrawStepAccount: "Where should we send it?",
    withdrawStepAmount: "How much?",
    summaryAmount: "Amount",
    summaryReceivingAccount: "Receiving account",
  },
  /**
   * The 6-digit withdrawal code (approved 2026-10-05,
   * docs/withdrawal-code-2026-10-05/design). The wording is the boards' own;
   * the server's `message` is never shown — screens pick these by its `code`.
   */
  withdrawalCode: {
    /** The code pages' header (CreateCode / ConfirmCode / ChangeCode). */
    title: "Withdrawal code",
    /** The forgot-code pages' header (ForgotCode). */
    forgotHeader: "Forgot code",
    createTitle: "Create your withdrawal code",
    createBody: "You'll enter it every time you withdraw. Keep it secret.",
    confirmTitle: "Enter it again",
    confirmBody: "Type the same 6 digits to confirm your code.",
    easyHint: "Don't use easy codes like 123456 or 111111.",
    looksGood: "Looks good. Tap Next.",
    codesMatch: "Codes match.",
    tooEasy: "Too easy to guess. Try a different code.",
    mismatch: "Codes don't match. Start over.",
    same: "Use a code different from your old one.",
    startOver: "Start over",
    next: "Next",
    saveCode: "Save code",
    done: "Done",
    /** Spoken after every key on the code keypad. */
    digitsEntered: "{n} of 6 digits entered",
    deleteDigit: "Delete last digit",
    enterTitle: "Enter your withdrawal code",
    enterBody: "To send {amount} to {account}.",
    forgot: "Forgot code?",
    wrong: "Wrong code. {n} tries left.",
    wrongOne: "Wrong code. 1 try left.",
    locked: "Too many tries. Try again in {n} minutes.",
    lockedOne: "Too many tries. Try again in 1 minute.",
    required: "Enter your 6-digit withdrawal code.",
    invalidFormat: "The code must be 6 digits.",
    alreadySet: "You already have a withdrawal code. Use Change code instead.",
    notSet: "Create a withdrawal code first.",
    smsTitle: "Verify it's you",
    /** {phone} is masked: "09 •••• ••• 471". */
    smsBody: "We sent a 6-digit code by SMS to {phone}.",
    smsWrong: "Wrong or expired code. Try again.",
    smsTooMany: "Too many wrong tries. Send a new code.",
    smsResendIn: "Send a new code in {n}s",
    smsResend: "Send a new code",
    verify: "Verify",
    newTitle: "Create a new code",
    resetNewBody: "Your old code stops working. You'll use this one from now on.",
    currentTitle: "Enter your current code",
    currentBody: "Then you'll choose a new one.",
    changedTitle: "Code changed",
    changedBody: "Use your new code next time you withdraw. Your old code no longer works.",
    /** The note under "Withdrawal requested" after a first code (CodeCreated "created"). */
    createdTitle: "Withdrawal code created",
    createdBody: "You'll need it every time you withdraw. You can change it in Profile.",
    /** The same note after "Forgot code?" (CodeCreated "reset"); also Profile's forgot-code done page. */
    resetTitle: "New withdrawal code saved",
    resetBody: "Your old code no longer works. Use the new one from now on.",
    noPhone: "Your account has no phone number to send a code to. Please contact support.",
    smsPhoneInvalid: "Your phone number can't get SMS codes. Please contact support.",
    resetExpired: "This step has expired. Please start again.",
    statusError: "Couldn't check your withdrawal code. Please try again.",
    checkError: "Couldn't check the code. Please try again.",
    saveError: "Couldn't save your code. Please try again.",
    smsError: "Couldn't send the code. Please try again.",
    /** Profile > Account. */
    profileRow: "Withdrawal code",
    profileCreate: "Create code",
    profileChange: "Change code",
  },
};

export type TranslationShape = typeof en;
