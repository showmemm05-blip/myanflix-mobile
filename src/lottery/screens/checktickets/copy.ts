import { LT_COPY } from "@/lottery/copy";
import { ks, nTickets, spaced } from "@/lottery/data/format";
import type { TicketPile } from "@/lottery/data/piles";
import { ltCopy, type LtWiden } from "@/lottery/i18n";

/**
 * Check my tickets (CheckTickets.dc.html, owner 15 Oct 2026) — this page's
 * words in English and Burmese, like the shared LT_COPY (src/lottery/i18n.ts).
 * The prize-group names ("1st prize" … "Last 2
 * digits") come from data/prizes.ts; every amount is the draw's own Ks
 * (phase 3, 2026-10-19).
 *
 * Every six-digit number is spoken digit by digit (`spaced`).
 */

/** "Thu 22 Oct 2026, 7:35 PM" → "Bought 22 Oct, 7:35 PM" (the board's caption). */
function boughtLine(boughtAt: string): string {
  const m = /^\w{3} (\d{1,2} \w{3}) \d{4}, (.+)$/.exec(boughtAt);
  return m ? `Bought ${m[1]}, ${m[2]}` : `Bought ${boughtAt}`;
}

/** One prize line's amount: "20,000 Ks × 2" on a pile. */
function wonAmount(amount: number, count: number): string {
  return count > 1 ? `${ks(amount)} × ${count}` : ks(amount);
}

/** Under a pile's prize lines: "20,000 Ks on each of your 2 tickets". */
function wonEach(amount: number, count: number): string {
  return `${ks(amount)} on each of your ${count} tickets`;
}

/** "1st prize" or "3rd prize and First 3 digits". */
function prizeNames(pile: TicketPile): string {
  return pile.wins.map((w) => w.group.name).join(" and ");
}

/* ---------- the Burmese twins of the helpers above (used only by CHECK_COPY_MM) ---------- */

/** "ကြာသပတေး 22 အောက်တိုဘာ 2026၊ ည 7:35" → "ဝယ်ယူချိန် 22 အောက်တိုဘာ၊ ည 7:35" (format.ts's Burmese dateTimeLabel, year dropped). */
function boughtLineMm(boughtAt: string): string {
  const m = /^\S+ (\d{1,2} \S+) \d{4}၊ (.+)$/.exec(boughtAt);
  return m ? `ဝယ်ယူချိန် ${m[1]}၊ ${m[2]}` : `ဝယ်ယူချိန် ${boughtAt}`;
}

/** "သင့်လက်မှတ် 2 စောင်တွင် တစ်စောင်လျှင် 20,000 Ks". */
function wonEachMm(amount: number, count: number): string {
  return `သင့်လက်မှတ် ${count} စောင်တွင် တစ်စောင်လျှင် ${ks(amount)}`;
}

/** "ပထမဆု" or "တတိယဆု နှင့် ရှေ့ 3 လုံး" (the group names come from data/prizes.ts, in the current language). */
function prizeNamesMm(pile: TicketPile): string {
  return pile.wins.map((w) => w.group.name).join(" နှင့် ");
}

const CHECK_COPY_EN = {
  /** The top bar: a page pushed inside the Results tab, so its back link says where it goes. */
  top: {
    pre: "Check tickets",
    big: (drawNo: number | undefined) => (drawNo === undefined ? "Results" : `Draw ${drawNo}`),
    back: "Results",
    backA11y: "Back to Results",
  },

  head: {
    title: "Check my tickets",
    sub: (drawNo: number, day: string) => `Draw ${drawNo} · ${day}`,
    published: (at: string) => `Published ${at}`,
  },

  /** The page while the result or the tickets load, or fail. */
  loading: "Loading the result…",
  loadingTickets: "Loading your tickets…",
  errorTitle: "The result did not load",
  errorText: "We could not load this draw's result. Check your connection and try again.",
  ticketsErrorTitle: "Your tickets did not load",
  ticketsErrorText: "We could not load your tickets for this draw. Check your connection and try again.",
  retry: "Try again",
  /** No published draw at all, or this draw is not published yet. */
  noResults: {
    title: "No results yet",
    text: "The first draw's prize results appear here once it is published.",
  },
  notPublished: {
    title: (drawNo: number) => `No result yet for Draw ${drawNo}`,
    text: "Its prize results are published after the draw. Check back then.",
  },

  /** The compact result: 1st prize · Last 2 digits · All prizes ›. */
  strip: {
    valueA11y: (name: string, digits: string) => `${name}: ${spaced(digits)}`,
    allPrizes: "All prizes",
    allPrizesA11y: (drawNo: number) => `All prizes of Draw ${drawNo}`,
  },

  actions: {
    checkAll: (n: number) => `Check all my tickets (${n})`,
    checkOther: (n: number) => `Check the other tickets (${n})`,
    checking: "Checking your tickets…",
    skip: "Skip to the results",
    again: "Watch the check again",
  },

  list: {
    title: (drawNo: number) => `Your Draw ${drawNo} tickets`,
    count: (n: number) => nTickets(n),
  },

  row: {
    bought: boughtLine,
    /** Under a pile: "× 2 · 2,000 Ks" after the number — "× 2" while the draw's price is not known. */
    pileSum: (count: number, cost: string | null) => (cost ? `× ${count} · ${cost}` : `× ${count}`),
    pileSumA11y: (number: string, count: number, cost: string | null, bought: string) =>
      `${spaced(number)}, ${nTickets(count)} on one pile${cost ? `, ${cost}` : ""}. ${bought}.`,
    singleA11y: (id: string, bought: string) => `Ticket ID ${id}. ${bought}.`,
  },

  /** The result panel under each ticket or pile. */
  check: {
    label: "Check",
    a11y: (number: string, count: number) =>
      count === 1
        ? `Check ticket ${spaced(number)}`
        : count === 2
          ? `Check both tickets ${spaced(number)}`
          : `Check all ${count} tickets ${spaced(number)}`,
    waiting: "Waiting its turn…",
    waitingA11y: (number: string) => `${spaced(number)}: waiting its turn.`,
  },

  scan: {
    kicker: (groups: number) => `Checking ${groups} prize groups`,
    count: (i: number, groups: number) => `${i} of ${groups}`,
    group: (name: string) => `${name}…`,
    almost: "Almost there…",
    /** The panel's one steady label while it checks (never the changing group: see ResultPanel). */
    a11y: (number: string, groups: number) => `Checking ${spaced(number)} against ${groups} prize groups.`,
  },

  won: {
    /* A getter, not a value: LT_COPY is bilingual too, so the word is read when it is shown, not once at import. */
    get pill() {
      return LT_COPY.pills.won;
    },
    amount: wonAmount,
    each: wonEach,
    youWon: "You won",
    /**
     * Under "You won": how the prize is paid (by request since 24 Oct 2026 —
     * the Request payment button sits in the gold summary, once every ticket
     * is checked).
     */
    paid: "Request the payment from your prize summary, once every ticket is checked.",
    /** The whole panel as one spoken line. */
    a11y: (pile: TicketPile) => {
      const lines = pile.wins
        .map((w) => `${w.group.name}, ${spaced(w.matched)}, ${wonAmount(w.amount, pile.count)}`)
        .join(". ");
      const each = pile.count > 1 ? ` ${wonEach(pile.each, pile.count)}.` : "";
      return `Won. ${lines}.${each} You won ${ks(pile.total)}. Request the payment from your prize summary, once every ticket is checked.`;
    },
  },

  lost: {
    get pill() {
      return LT_COPY.pills.notwon;
    },
    /** "No prize this draw. Next draw: Saturday 31 October." (the next draw's line only while there is one). */
    text: (nextDraw: string | null) => `No prize this draw.${nextDraw ? ` Next draw: ${nextDraw}.` : ""}`,
    a11y: (nextDraw: string | null) => `Not won. No prize this draw.${nextDraw ? ` Next draw: ${nextDraw}.` : ""}`,
  },

  /** Spoken announcements (the board's one polite live region). */
  live: {
    checking: (number: string) => `Checking ${spaced(number)}.`,
    again: "Checking your tickets again. ",
    /** "0 5 8 3 1 4: won 1st prize, 60,000,000 Ks." · "7 3 1 5 6 0, 2 tickets: each won Last 2 digits, 40,000 Ks in all." */
    result: (pile: TicketPile) => {
      const many = pile.count > 1;
      const lead = `${spaced(pile.number)}${many ? `, ${pile.count} tickets: ` : ": "}`;
      if (!pile.wins.length) return `${lead}not won.`;
      return `${lead}${many ? "each won " : "won "}${prizeNames(pile)}, ${ks(pile.total)}${many ? " in all." : "."}`;
    },
    summary: (title: string, drawNo: number, total: string) =>
      `All tickets checked. ${title}. Total prize for Draw ${drawNo}: ${total}.`,
  },

  /** The gold summary, once every ticket is checked (the prize-claim block under it has its own words: components/claim/copy.ts). */
  summary: {
    kicker: (drawNo: number) => `Draw ${drawNo} · All checked`,
    /** "3 of 4 tickets won" · "1 of 1 ticket won". */
    title: (won: number, of: number) => `${won} of ${nTickets(of)} won`,
    none: "No prize this draw",
    total: (drawNo: number) => `Total prize for Draw ${drawNo}`,
    a11y: (drawNo: number, title: string, total: string) =>
      `Draw ${drawNo}, all checked. ${title}. ${total}. Total prize for Draw ${drawNo}.`,
  },

  /** A published draw you hold no tickets for (not on the board). */
  empty: {
    title: (drawNo: number) => `No tickets for Draw ${drawNo}`,
    text: "Tickets you bought for this draw would be checked here.",
    action: "See all prizes",
  },
} as const;

const CHECK_COPY_MM: LtWiden<typeof CHECK_COPY_EN> = {
  top: {
    pre: "လက်မှတ် စစ်ရန်",
    big: (drawNo: number | undefined) => (drawNo === undefined ? "ရလဒ်များ" : `ပွဲစဉ် ${drawNo}`),
    back: "ရလဒ်များ",
    backA11y: "ရလဒ်များသို့ ပြန်သွားရန်",
  },

  head: {
    title: "ကျွန်ုပ်၏ လက်မှတ်များ စစ်ရန်",
    sub: (drawNo: number, day: string) => `ပွဲစဉ် ${drawNo} · ${day}`,
    published: (at: string) => `ရလဒ် ထွက်ချိန် ${at}`,
  },

  loading: "ရလဒ်ကို ဖွင့်နေသည်…",
  loadingTickets: "သင့်လက်မှတ်များကို ဖွင့်နေသည်…",
  errorTitle: "ရလဒ်ကို ဖွင့်၍ မရပါ",
  errorText: "ဤပွဲစဉ်၏ ရလဒ်ကို ဖွင့်၍ မရပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်ကြိုးစားကြည့်ပါ။",
  ticketsErrorTitle: "သင့်လက်မှတ်များကို ဖွင့်၍ မရပါ",
  ticketsErrorText: "ဤပွဲစဉ်အတွက် သင့်လက်မှတ်များကို ဖွင့်၍ မရပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်ကြိုးစားကြည့်ပါ။",
  retry: "ထပ်ကြိုးစားကြည့်ရန်",
  noResults: {
    title: "ရလဒ် မထွက်သေးပါ",
    text: "ပထမဆုံး ပွဲစဉ်၏ ဆုရလဒ်များ ထုတ်ပြန်ပြီးသည်နှင့် ဤနေရာတွင် ပေါ်လာပါမည်။",
  },
  notPublished: {
    title: (drawNo: number) => `ပွဲစဉ် ${drawNo} ၏ ရလဒ် မထွက်သေးပါ`,
    text: "ထီဖွင့်ပွဲ ပြီးမှ ဆုရလဒ်များကို ထုတ်ပြန်ပါမည်။ ထိုအချိန်တွင် ပြန်ကြည့်ပါ။",
  },

  strip: {
    valueA11y: (name: string, digits: string) => `${name}: ${spaced(digits)}`,
    allPrizes: "ဆုအားလုံး",
    allPrizesA11y: (drawNo: number) => `ပွဲစဉ် ${drawNo} ၏ ဆုအားလုံး`,
  },

  actions: {
    checkAll: (n: number) => `ကျွန်ုပ်၏ လက်မှတ်အားလုံး စစ်ရန် (${n})`,
    checkOther: (n: number) => `ကျန်လက်မှတ်များ စစ်ရန် (${n})`,
    checking: "သင့်လက်မှတ်များကို စစ်နေသည်…",
    skip: "ကျော်ပြီး ရလဒ် ကြည့်ရန်",
    again: "စစ်ဆေးမှုကို ပြန်ကြည့်ရန်",
  },

  list: {
    title: (drawNo: number) => `ပွဲစဉ် ${drawNo} အတွက် သင့်လက်မှတ်များ`,
    count: (n: number) => nTickets(n),
  },

  row: {
    bought: boughtLineMm,
    pileSum: (count: number, cost: string | null) => (cost ? `× ${count} · ${cost}` : `× ${count}`),
    pileSumA11y: (number: string, count: number, cost: string | null, bought: string) =>
      `${spaced(number)}၊ ${nTickets(count)}ကို တစ်ပုံတည်း စုထားသည်${cost ? `၊ ${cost}` : ""}။ ${bought}။`,
    singleA11y: (id: string, bought: string) => `လက်မှတ် ID ${id}။ ${bought}။`,
  },

  check: {
    label: "စစ်ရန်",
    a11y: (number: string, count: number) =>
      count === 1
        ? `လက်မှတ် ${spaced(number)} ကို စစ်ရန်`
        : count === 2
          ? `နံပါတ် ${spaced(number)} လက်မှတ် နှစ်စောင်လုံးကို စစ်ရန်`
          : `နံပါတ် ${spaced(number)} လက်မှတ် ${count} စောင်လုံးကို စစ်ရန်`,
    waiting: "အလှည့် စောင့်နေသည်…",
    waitingA11y: (number: string) => `${spaced(number)}၊ အလှည့် စောင့်နေသည်။`,
  },

  scan: {
    kicker: (groups: number) => `ဆုအုပ်စု ${groups} ခု စစ်နေသည်`,
    count: (i: number, groups: number) => `${i} / ${groups}`,
    group: (name: string) => `${name}…`,
    almost: "ပြီးခါနီးပါပြီ…",
    a11y: (number: string, groups: number) => `${spaced(number)} ကို ဆုအုပ်စု ${groups} ခုနှင့် တိုက်စစ်နေသည်။`,
  },

  won: {
    get pill() {
      return LT_COPY.pills.won;
    },
    amount: wonAmount,
    each: wonEachMm,
    youWon: "သင်ပေါက်သည့် ဆုငွေ",
    paid: "လက်မှတ်အားလုံး စစ်ပြီးသည်နှင့် ဆု အကျဉ်းချုပ်မှ ဆုငွေ တောင်းခံပါ။",
    a11y: (pile: TicketPile) => {
      const lines = pile.wins
        .map((w) => `${w.group.name}၊ ${spaced(w.matched)}၊ ${wonAmount(w.amount, pile.count)}`)
        .join("။ ");
      const each = pile.count > 1 ? ` ${wonEachMm(pile.each, pile.count)}။` : "";
      return `ပေါက်ပါသည်။ ${lines}။${each} သင် ဆုငွေ ${ks(pile.total)} ပေါက်ပါသည်။ လက်မှတ်အားလုံး စစ်ပြီးသည်နှင့် ဆု အကျဉ်းချုပ်မှ ဆုငွေ တောင်းခံပါ။`;
    },
  },

  lost: {
    get pill() {
      return LT_COPY.pills.notwon;
    },
    text: (nextDraw: string | null) => `ဤပွဲစဉ်တွင် ဆု မပေါက်ပါ။${nextDraw ? ` နောက်ထီဖွင့်ရက်: ${nextDraw}။` : ""}`,
    a11y: (nextDraw: string | null) =>
      `မပေါက်ပါ။ ဤပွဲစဉ်တွင် ဆု မပေါက်ပါ။${nextDraw ? ` နောက်ထီဖွင့်ရက်: ${nextDraw}။` : ""}`,
  },

  live: {
    checking: (number: string) => `${spaced(number)} ကို စစ်နေသည်။`,
    again: "သင့်လက်မှတ်များကို ထပ်စစ်နေသည်။ ",
    /** "0 5 8 3 1 4၊ ပထမဆု ပေါက်ပါသည်။ ဆုငွေ 60,000,000 Ks။" · "7 3 1 5 6 0၊ လက်မှတ် 2 စောင်၊ တစ်စောင်စီ နောက် 2 လုံး ပေါက်ပါသည်။ စုစုပေါင်း ဆုငွေ 40,000 Ks။" */
    result: (pile: TicketPile) => {
      const many = pile.count > 1;
      const lead = `${spaced(pile.number)}${many ? `၊ လက်မှတ် ${pile.count} စောင်၊ ` : "၊ "}`;
      if (!pile.wins.length) return `${lead}မပေါက်ပါ။`;
      return `${lead}${many ? "တစ်စောင်စီ " : ""}${prizeNamesMm(pile)} ပေါက်ပါသည်။ ${many ? "စုစုပေါင်း " : ""}ဆုငွေ ${ks(pile.total)}။`;
    },
    summary: (title: string, drawNo: number, total: string) =>
      `လက်မှတ်အားလုံး စစ်ပြီးပါပြီ။ ${title}။ ပွဲစဉ် ${drawNo} အတွက် စုစုပေါင်း ဆုငွေ ${total}။`,
  },

  summary: {
    kicker: (drawNo: number) => `ပွဲစဉ် ${drawNo} · အားလုံး စစ်ပြီး`,
    /** "လက်မှတ် 4 စောင်အနက် 3 စောင် ပေါက်သည်" (nTickets gives "လက်မှတ် 4 စောင်"). */
    title: (won: number, of: number) => `${nTickets(of)}အနက် ${won} စောင် ပေါက်သည်`,
    none: "ဤပွဲစဉ်တွင် ဆု မပေါက်ပါ",
    total: (drawNo: number) => `ပွဲစဉ် ${drawNo} အတွက် စုစုပေါင်း ဆုငွေ`,
    a11y: (drawNo: number, title: string, total: string) =>
      `ပွဲစဉ် ${drawNo}၊ အားလုံး စစ်ပြီးပါပြီ။ ${title}။ ပွဲစဉ် ${drawNo} အတွက် စုစုပေါင်း ဆုငွေ ${total}။`,
  },

  empty: {
    title: (drawNo: number) => `ပွဲစဉ် ${drawNo} အတွက် လက်မှတ် မရှိပါ`,
    text: "ဤပွဲစဉ်အတွက် လက်မှတ် ဝယ်ထားပါက ဤနေရာတွင် စစ်ပေးပါမည်။",
    action: "ဆုအားလုံး ကြည့်ရန်",
  },
};

export const CHECK_COPY = ltCopy(CHECK_COPY_EN, CHECK_COPY_MM);
