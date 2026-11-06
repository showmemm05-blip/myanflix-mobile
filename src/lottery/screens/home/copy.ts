import { ltCopy, type LtWiden } from "@/lottery/i18n";

/**
 * Lottery Home's English copy (Main.dc.html, the intuitive Home of 22 Oct
 * 2026, word for word). Draw numbers, dates, times and prices are passed in
 * from the current draw (GET /lottery/draws/current); the previous draw's
 * numbers and amounts from its published sheet (GET /lottery/results); the
 * winners from GET /lottery/draws/:drawNo/winners (number, group, Ks — never
 * a name).
 *
 * English and Burmese (owner, 4 Nov 2026): HOME_COPY_EN and its Burmese twin,
 * wrapped by `ltCopy` (src/lottery/i18n.ts); copy rules: sentence case, "1,000 Ks", no "!", never "lucky / win big
 * / official / government"; KBZPay and WavePay are the only ways to add money.
 */
const HOME_COPY_EN = {
  /** 1 · The current draw card. */
  hero: {
    kicker: "Current draw",
    /** The board's word for an open sale ("Open for sale" elsewhere in the app). */
    openPill: "Sales open",
    times: (drawTime: string, closeTime: string) => `Draw at ${drawTime} · Sales close ${closeTime}`,
    /** Closed: "**Sales closed** at 5:00 PM. Results after the 6:00 PM draw." */
    closedBold: "Sales closed",
    closedRest: (closeTime: string, drawTime: string) => ` at ${closeTime}. Results after the ${drawTime} draw.`,
    /** Not on sale yet. The API does not say when sales open, so the line stays general. */
    scheduledBold: "Opens soon.",
    scheduledRest: (drawNo: number) => ` Sales for Draw ${drawNo} have not opened yet. Check back soon.`,
    pausedBold: "Sales paused.",
    pausedRest: " Tickets you already hold are safe.",
    /** The latest finished draw, already published (nothing newer is set up). */
    publishedBold: "Result published.",
    publishedRest: (drawNo: number) => ` Draw ${drawNo} is finished. Its results are below.`,
    /** The two fanned tickets, read once: "Two sample tickets for Draw 1, printed with the numbers 3 7 2 … and 0 0 4 …" */
    stageA11y: (drawNo: number, front: string, back: string) =>
      `Two sample tickets for Draw ${drawNo}, printed with the numbers ${front} and ${back}.`,
    caption: "Each ticket is printed with your number",
    /** "**1,000 Ks** a ticket · Pick any six digits" */
    factsRest: " a ticket · Pick any six digits",
    choose: "Choose numbers",
    seeResults: "See results",
    myTickets: "My tickets",
  },

  /** 2 · Three ways to pick. */
  pick: {
    title: "Pick numbers your way",
    d1k: { name: "Dream 1000", cap: "3-digit dreams" },
    d100: { name: "Dream 100", cap: "2-digit dreams" },
    rng: { name: "Random", cap: "Let luck pick" },
    tileA11y: (name: string, cap: string) => `${name}. ${cap}.`,
  },

  /** 3 · The previous draw's sheet, compact. */
  results: {
    kicker: "Latest results",
    title: "Previous draw",
    first: "1st prize",
    firstA11y: (number: string, amount: string) => `1st prize number ${number}, ${amount} a ticket.`,
    next: "Next to 1st prize",
    nextA11y: (a: string, b: string, amount: string) => `Next to 1st prize: ${a} and ${b}, ${amount} a ticket.`,
    front3: "First 3",
    back3: "Last 3",
    back2: "Last 2",
    front3A11y: (numbers: string, amount: string) => `First 3 digits ${numbers}, ${amount} a ticket.`,
    back3A11y: (numbers: string, amount: string) => `Last 3 digits ${numbers}, ${amount} a ticket.`,
    back2A11y: (numbers: string, amount: string) => `Last 2 digits ${numbers}, ${amount} a ticket.`,
    /** Several numbers spoken: "4 7 1 or 9 0 5". */
    or: " or ",
    all: "All results",
    check: "Check my tickets",
    checkA11y: "Check my tickets for the previous draw",
    checkSignIn: "Check my tickets. Sign in first.",
    none: {
      title: "No results yet",
      /** The empty window reads "Winning number: no digits yet." */
      windowA11y: "Winning number",
      /** "The first results are published after the 6:00 PM draw on Saturday 31 October 2026." */
      text: (drawTime: string, date: string) => `The first results are published after the ${drawTime} draw on ${date}.`,
      textNoDraw: "Results are published here after each draw.",
    },
    loading: "Loading the results…",
    errorTitle: "The results did not load",
    errorText: "We could not load the results. Check your connection and try again.",
    retry: "Try again",
  },

  /** 4 · Recent winners. */
  winners: {
    title: "Recent winners",
    seeAll: "See all",
    seeAllA11y: "See all, previous draw results",
    sub: (date: string) => `Previous draw · ${date} · ticket numbers only`,
    listA11y: "Winning tickets of the previous draw",
    /** "Ticket 0 5 8 3 1 4, 1st prize, won 60,000,000 Ks" */
    rowA11y: (spacedNumber: string, group: string, amount: string) => `Ticket ${spacedNumber}, ${group}, won ${amount}`,
    amount: (amount: string) => `+ ${amount}`,
    empty: "Winners appear here after the first draw.",
    noneInDraw: "No winning tickets in this draw.",
    loading: "Loading the winners…",
    errorTitle: "The winners did not load",
    errorText: "We could not load the previous draw's winners. Check your connection and try again.",
    retry: "Try again",
  },

  /** 5 · Pick · Buy · Check. */
  steps: {
    title: "How it works",
    items: ["Pick a number", "Buy a ticket", "Check results"] as const,
    /** The strip read as one line: "How it works. Step 1 of 3, Pick a number. Step 2 of 3, …" */
    a11y: (title: string, items: readonly string[]) =>
      `${title}. ${items.map((text, i) => `Step ${i + 1} of ${items.length}, ${text}.`).join(" ")}`,
  },
} as const;

/**
 * The Burmese twin (glossary: docs/lottery-burmese-2026-11-04/GLOSSARY.md).
 * Dates and times arrive already in Burmese from data/format.ts. The pick
 * tiles keep the short "အိပ်မက် 1000" (the English tile says "Dream 1000",
 * not "Dream Number 1000") because each tile name is one line in a third of
 * the row. "Let luck pick" becomes "the app picks for you": the Lottery never
 * promises luck.
 */
const HOME_COPY_MM: LtWiden<typeof HOME_COPY_EN> = {
  hero: {
    kicker: "လက်ရှိ ပွဲစဉ်",
    openPill: "ရောင်းချနေသည်",
    times: (drawTime: string, closeTime: string) => `ထီဖွင့်ချိန် ${drawTime} · ရောင်းချမှု ပိတ်ချိန် ${closeTime}`,
    closedBold: "ရောင်းချမှု ပိတ်ပြီ",
    closedRest: (closeTime: string, drawTime: string) =>
      ` (${closeTime})။ ${drawTime} ထီဖွင့်ပွဲ ပြီးနောက် ရလဒ် ထွက်ပါမည်။`,
    scheduledBold: "မကြာမီ ဖွင့်မည်။",
    scheduledRest: (drawNo: number) => ` ပွဲစဉ် ${drawNo} အတွက် ရောင်းချမှု မဖွင့်ရသေးပါ။ မကြာမီ ပြန်ကြည့်ပါ။`,
    pausedBold: "ရောင်းချမှု ခေတ္တရပ်ထားသည်။",
    pausedRest: " သင့်တွင် ရှိပြီးသော လက်မှတ်များကို မထိခိုက်ပါ။",
    publishedBold: "ရလဒ် ထွက်ပြီ။",
    publishedRest: (drawNo: number) => ` ပွဲစဉ် ${drawNo} ပြီးဆုံးပါပြီ။ ရလဒ်များကို အောက်တွင် ကြည့်နိုင်ပါသည်။`,
    stageA11y: (drawNo: number, front: string, back: string) =>
      `ပွဲစဉ် ${drawNo} အတွက် နမူနာ လက်မှတ် 2 စောင်။ ဂဏန်း ${front} နှင့် ${back} ကို ရိုက်နှိပ်ထားပါသည်။`,
    caption: "လက်မှတ်တိုင်းတွင် သင့်ဂဏန်းကို ရိုက်နှိပ်ပေးပါသည်",
    /** After the bold price: "**1,000 Ks** တစ်စောင်လျှင် · …" — the same order as the Draw card's fact line (src/lottery/copy.ts draw.facts). */
    factsRest: " တစ်စောင်လျှင် · ကြိုက်ရာ ဂဏန်း 6 လုံး ရွေးနိုင်သည်",
    choose: "ဂဏန်း ရွေးရန်",
    seeResults: "ရလဒ် ကြည့်ရန်",
    myTickets: "ကျွန်ုပ်၏ လက်မှတ်များ",
  },

  pick: {
    title: "သင်နှစ်သက်သလို ဂဏန်း ရွေးပါ",
    d1k: { name: "အိပ်မက် 1000", cap: "အိပ်မက် 3 လုံး" },
    d100: { name: "အိပ်မက် 100", cap: "အိပ်မက် 2 လုံး" },
    rng: { name: "ကျပန်း", cap: "အက်ပ် ရွေးမည်" },
    tileA11y: (name: string, cap: string) => `${name}။ ${cap}။`,
  },

  results: {
    kicker: "နောက်ဆုံး ရလဒ်",
    title: "ယခင် ပွဲစဉ်",
    first: "ပထမဆု",
    firstA11y: (number: string, amount: string) => `ပထမဆု ဂဏန်း ${number}၊ တစ်စောင်လျှင် ${amount}။`,
    next: "ပထမဆု ကပ်လျက်",
    nextA11y: (a: string, b: string, amount: string) =>
      `ပထမဆု ကပ်လျက် ဂဏန်း ${a} နှင့် ${b}၊ တစ်စောင်လျှင် ${amount}။`,
    front3: "ရှေ့ 3 လုံး",
    back3: "နောက် 3 လုံး",
    back2: "နောက် 2 လုံး",
    front3A11y: (numbers: string, amount: string) => `ရှေ့ ဂဏန်း 3 လုံး ${numbers}၊ တစ်စောင်လျှင် ${amount}။`,
    back3A11y: (numbers: string, amount: string) => `နောက် ဂဏန်း 3 လုံး ${numbers}၊ တစ်စောင်လျှင် ${amount}။`,
    back2A11y: (numbers: string, amount: string) => `နောက် ဂဏန်း 2 လုံး ${numbers}၊ တစ်စောင်လျှင် ${amount}။`,
    or: " သို့မဟုတ် ",
    all: "ရလဒ် အားလုံး",
    check: "လက်မှတ်များ စစ်ရန်",
    checkA11y: "ယခင် ပွဲစဉ်အတွက် ကျွန်ုပ်၏ လက်မှတ်များ စစ်ရန်",
    checkSignIn: "ကျွန်ုပ်၏ လက်မှတ်များ စစ်ရန်။ အရင် ဝင်ရောက်ပါ။",
    none: {
      title: "ရလဒ် မထွက်သေးပါ",
      windowA11y: "ပေါက်ဂဏန်း",
      text: (drawTime: string, date: string) =>
        `ပထမဆုံး ရလဒ်များကို ${date}၊ ${drawTime} ထီဖွင့်ပွဲ ပြီးနောက် ထုတ်ပြန်ပါမည်။`,
      textNoDraw: "ထီဖွင့်ပွဲ ပြီးတိုင်း ရလဒ်များကို ဤနေရာတွင် ထုတ်ပြန်ပါမည်။",
    },
    loading: "ရလဒ်များကို ဖွင့်နေသည်…",
    errorTitle: "ရလဒ်များကို ဖွင့်၍ မရပါ",
    errorText: "ရလဒ်များကို ဖွင့်၍ မရပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်ကြိုးစားကြည့်ပါ။",
    retry: "ထပ်ကြိုးစားကြည့်ရန်",
  },

  winners: {
    title: "ဆုပေါက်သူများ",
    seeAll: "အားလုံး ကြည့်ရန်",
    seeAllA11y: "အားလုံး ကြည့်ရန်၊ ယခင် ပွဲစဉ် ရလဒ်များ",
    sub: (date: string) => `ယခင် ပွဲစဉ် · ${date} · လက်မှတ်နံပါတ်များသာ`,
    listA11y: "ယခင် ပွဲစဉ်၏ ဆုပေါက် လက်မှတ်များ",
    rowA11y: (spacedNumber: string, group: string, amount: string) =>
      `လက်မှတ် ${spacedNumber}၊ ${group}၊ ${amount} ပေါက်သည်`,
    amount: (amount: string) => `+ ${amount}`,
    empty: "ပထမဆုံး ထီဖွင့်ပွဲ ပြီးနောက် ဆုပေါက်သူများ ဤနေရာတွင် ပေါ်လာပါမည်။",
    noneInDraw: "ဤပွဲစဉ်တွင် ဆုပေါက် လက်မှတ် မရှိပါ။",
    loading: "ဆုပေါက်သူများကို ဖွင့်နေသည်…",
    errorTitle: "ဆုပေါက်သူများကို ဖွင့်၍ မရပါ",
    errorText: "ယခင် ပွဲစဉ်၏ ဆုပေါက်သူများကို ဖွင့်၍ မရပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်ကြိုးစားကြည့်ပါ။",
    retry: "ထပ်ကြိုးစားကြည့်ရန်",
  },

  steps: {
    title: "အသုံးပြုပုံ",
    items: ["ဂဏန်း ရွေးပါ", "လက်မှတ် ဝယ်ပါ", "ရလဒ် စစ်ပါ"],
    /** "အသုံးပြုပုံ။ အဆင့် 3 ဆင့်အနက် အဆင့် 1၊ ဂဏန်း ရွေးပါ။ …" */
    a11y: (title: string, items: readonly string[]) =>
      `${title}။ ${items.map((text, i) => `အဆင့် ${items.length} ဆင့်အနက် အဆင့် ${i + 1}၊ ${text}။`).join(" ")}`,
  },
};

export const HOME_COPY = ltCopy(HOME_COPY_EN, HOME_COPY_MM);
