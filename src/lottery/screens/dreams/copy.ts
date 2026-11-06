import { LT_COPY } from "@/lottery/copy";
import { ltCopy, type LtWiden } from "@/lottery/i18n";
import { group, nTickets, spaced } from "@/lottery/data/format";
import type { DrawStatus } from "@/lottery/data/sample";
import type { DreamBook } from "@/types/lottery";

/**
 * Group D's English copy: the two dream books (Dream1000 / Dream100.dc.html;
 * the band and the search from the "Dream detail, simpler" canvas › Book,
 * 3 Nov 2026) and their sample-ticket generators (DreamTickets1000 / 100,
 * redone on that canvas's Main the same day), word for word from the boards.
 * English and Burmese (owner, 4 Nov 2026): DREAM_COPY_EN and its Burmese
 * twin, wrapped by `ltCopy` (src/lottery/i18n.ts).
 *
 * The dreams are REAL (the API's dream books, 2026-10-19), and so are the
 * draw and the wallet on the generator page (phase 2); the tickets it makes
 * are samples until they are bought.
 *
 * Every function that puts a lottery number into a sentence has a spoken
 * twin, or takes the number already spaced: a screen reader must hear
 * "0 2 7", never "twenty-seven".
 */

/** The spoken search name's example number, one per book. */
const EXAMPLE: Record<DreamBook, string> = { "1000": "027", "100": "07" };
/** "three" random digits around a three-digit dream number, "four" around a two-digit one. */
const NUM_WORDS = ["no", "one", "two", "three", "four", "five", "six"] as const;

function cap1(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function nDreams(n: number): string {
  return n === 1 ? "1 dream" : `${group(n)} dreams`;
}

const DREAM_COPY_EN = {
  /** Shared by both pages' top bars. */
  titlePre: "Dream Number",
  bookName: (book: DreamBook) => `Dream Number ${book}`,

  /* ---------- the dream book (Dream1000 / Dream100) ---------- */
  book: {
    backA11y: "Back to Lottery home",
    kicker: "Dream book",
    stampWord: "Dreams",
    /** The band's heading (the book's name is in the top bar). */
    question: "What did you dream about?",

    searchPlaceholder: "Search a dream or a number",
    /** The pill's spoken name (the board's aria-label): no label or help line, so the sentence carries the example, digit by digit; the top bar already names the book. */
    searchA11y: (book: DreamBook) =>
      `Search your dream: a word in English or Burmese, or a number such as ${spaced(EXAMPLE[book])}`,
    clearA11y: "Clear search",

    resultsTitle: "Search results",
    allTitle: "All dreams",
    /** "3 dreams match “cat”" — `said` is the query as shown, or spaced when it is a number. */
    matchCount: (n: number, said: string) =>
      `${n === 0 ? "No dreams match" : n === 1 ? "1 dream matches" : `${n} dreams match`} “${said}”`,
    fullCount: (n: number) => `${nDreams(n)} in the book`,
    loadingCount: "Loading the dream book…",
    failedCount: "Not loaded",
    hint: "Tap a dream to make sample tickets with its number.",

    /** "Fish, ငါး, number 0 2 7. Open." — `names` from dreamBook.dreamNames. */
    cardA11y: (names: string, num: string) => `${names}, number ${spaced(num)}. Open.`,
    gridA11y: "Dreams",

    shownOf: (shown: number, total: number) => `Showing ${shown} of ${group(total)}`,
    loadMore: "Load more dreams",
    loadMoreA11y: (next: number) => `Load more dreams. Shows ${next} more.`,

    emptyTitle: (said: string) => `No dream matches “${said}”.`,
    emptyText: "Try another word or a number.",
    emptyClear: "Clear search",

    /** The book has no named dream yet (the admin is still filling it in). */
    noneTitle: "No dreams yet",
    noneText: "The dream book is still being filled in. Check back soon.",

    errorTitle: "The dream book did not load",
    errorText: "We could not load the dreams. Check your connection and try again.",
    retry: "Try again",

    footerLine: "A dream number is a suggestion from the dream book, not a prediction.",
  },

  /* ---------- the sample-ticket generator (DreamTickets1000 / 100) ---------- */
  gen: {
    backA11y: (book: DreamBook) => `Back to Dream Number ${book}`,

    numberA11y: (num: string) => `Dream number ${spaced(num)}.`,

    /** The page while its dream loads, fails or is not in the book. */
    loading: "Loading the dream…",
    errorTitle: "The dream did not load",
    errorText: "We could not load this dream. Check your connection and try again.",
    retry: "Try again",
    missingTitle: "This dream is not in the book",
    missingText: (book: DreamBook) =>
      `Dream Number ${book} has no dream with this number, or it is switched off. Pick another from the book.`,
    backToBook: (book: DreamBook) => `Back to Dream Number ${book}`,

    /** The one draw line: "Draw 24 · 31 Oct · <b>1,000 Ks</b> a ticket" — the bold run is the screen's. */
    drawLine: (n: number, date: string) => `Draw ${n} · ${date} · `,
    drawLinePrice: " a ticket",
    drawLineA11y: (status: DrawStatus | null, n: number, date: string, price: string) =>
      `${status ? `${LT_COPY.pills[status]}. ` : ""}Draw ${n}, ${date}, ${price} a ticket.`,
    drawLoading: "Loading the draw…",
    drawNone: "No draw on sale yet. You can still pick tickets and copy their numbers.",
    drawErrorTitle: "The draw did not load",

    placeGroup: (num: string) => `Where ${num} goes in the ticket`,
    places: { start: "Start", middle: "Middle", end: "End", mixed: "Mixed" },
    placeSpoken: { start: "at the start", middle: "in the middle", end: "at the end" },
    /** The help line under the places; `num` is shown or spaced by the caller. */
    placeHelp: (pos: "start" | "middle" | "end" | "mixed", num: string, digits: number, mid: number) => {
      const rest = 6 - digits;
      const after = 6 - mid - digits;
      if (pos === "start") return `${num} comes first, then ${NUM_WORDS[rest]} random digits.`;
      if (pos === "middle") {
        return `${cap1(NUM_WORDS[mid])} random ${mid === 1 ? "digit" : "digits"}, then ${num}, then ${NUM_WORDS[after]} more.`;
      }
      if (pos === "end") return `${cap1(NUM_WORDS[rest])} random digits, then ${num} at the end.`;
      return `A mix: some tickets start with ${num}, some have it in the middle and some end with it.`;
    },
    showOthers: "Show other tickets",
    generating: "Making tickets…",
    keepNote: "Tickets you picked stay. The others change.",
    tapToPick: "Tap a ticket to pick it. Picked tickets stay when you show others.",

    ticketsTitle: (num: string) => `Tickets with ${num}`,
    resultsCountSpoken: (n: number, np: number) => `${n} sample tickets, ${np ? `${np} picked.` : "none picked yet."}`,
    resultsBusySpoken: "Making new sample tickets.",
    copyNumbers: (np: number) => (np === 0 ? "Copy all numbers" : np === 1 ? "Copy 1 number" : `Copy ${np} numbers`),
    copiedSome: (nums: readonly string[]) => {
      const lead = nums.length === 1 ? "1 number" : `${nums.length} numbers`;
      const more = nums.length > 3 ? ` and ${nums.length - 3} more.` : ".";
      return `${lead} copied: ${nums.slice(0, 3).join(", ")}${more}`;
    },
    copiedSomeSpoken: (n: number) => `${n === 1 ? "1 number" : `${n} numbers`} copied.`,
    gridA11y: (drawNo: number) => `Sample tickets for Draw ${drawNo}`,

    held: (n: number) => `You hold ${n}`,
    offSale: "Not on sale",
    cardA11y: (num: string, place: string, off: boolean, held: number, drawNo: number) =>
      `Ticket ${spaced(num)}, dream digits ${place}${off ? `, not on sale for Draw ${drawNo}` : ""}${held && !off ? `, you hold ${held}` : ""}`,
    offToast: (num: string, drawNo: number) => `${num} is not on sale for Draw ${drawNo}. Pick another ticket.`,
    offToastSpoken: (num: string, drawNo: number) => `${spaced(num)} is not on sale for Draw ${drawNo}. Pick another ticket.`,
    fullToast: (num: string, most: number) => `You already hold ${most} tickets of ${num}, the most for one number.`,
    fullToastSpoken: (num: string, most: number) =>
      `You already hold ${most} tickets of ${spaced(num)}, the most for one number.`,

    barCaption: (np: number, drawNo: number) => (np ? `${np} picked · Draw ${drawNo}` : `Pick tickets · Draw ${drawNo}`),
    barWallet: (amount: string) => `Wallet ${amount}`,
    barBuy: (np: number, total: string) => `Buy ${nTickets(np)} · ${total}`,
    barBuyA11y: (np: number, total: string, nums: readonly string[], drawNo: number) =>
      `Buy ${nTickets(np)} · ${total} for Draw ${drawNo}: ${nums.map(spaced).join(", ")}`,
    barNone: "Pick the tickets you like",
    bought: (np: number, drawNo: number) => `${nTickets(np)} bought for Draw ${drawNo}.`,

  },
} as const;

/** The book's count in Burmese: one count word, no plural ("အိပ်မက် 1,000 ခု"). */
function nDreamsMm(n: number): string {
  return `အိပ်မက် ${group(n)} ခု`;
}

/**
 * The Burmese twin (2026-11-04, docs/lottery-burmese-2026-11-04/GLOSSARY.md).
 * Counts stay in Latin digits ("ကျပန်း ဂဏန်း 3 လုံး"), so the English number
 * words and cap1 have no Burmese twin. A count of ticket NUMBERS is "နံပါတ် N ခု"
 * ("ဂဏန်း N လုံး" would read as N digits).
 */
const DREAM_COPY_MM: LtWiden<typeof DREAM_COPY_EN> = {
  titlePre: "အိပ်မက် ဂဏန်း",
  bookName: (book: DreamBook) => `အိပ်မက် ဂဏန်း ${book}`,

  book: {
    backA11y: "ထီ ပင်မသို့ ပြန်သွားရန်",
    kicker: "အိပ်မက်စာအုပ်",
    stampWord: "အိပ်မက်",
    question: "ဘာအိပ်မက် မက်ခဲ့ပါသလဲ",

    searchPlaceholder: "အိပ်မက် သို့မဟုတ် ဂဏန်း ရှာဖွေရန်",
    searchA11y: (book: DreamBook) =>
      `သင့်အိပ်မက်ကို ရှာဖွေရန်။ အင်္ဂလိပ် သို့မဟုတ် မြန်မာ စကားလုံး၊ သို့မဟုတ် ${spaced(EXAMPLE[book])} ကဲ့သို့ ဂဏန်း ရိုက်ထည့်ပါ။`,
    clearA11y: "ရှာဖွေမှုကို ရှင်းလင်းရန်",

    resultsTitle: "ရှာဖွေမှု ရလဒ်များ",
    allTitle: "အိပ်မက် အားလုံး",
    matchCount: (n: number, said: string) =>
      n === 0 ? `“${said}” နှင့် ကိုက်ညီသော အိပ်မက် မရှိပါ` : `“${said}” နှင့် ကိုက်ညီသော အိပ်မက် ${n} ခု`,
    fullCount: (n: number) => `စာအုပ်ထဲတွင် ${nDreamsMm(n)}`,
    loadingCount: "အိပ်မက်စာအုပ်ကို ဖွင့်နေသည်…",
    failedCount: "ဖွင့်၍ မရပါ",
    hint: "အိပ်မက်တစ်ခုကို နှိပ်ပြီး ၎င်း၏ ဂဏန်းဖြင့် နမူနာ လက်မှတ်များ ပြုလုပ်ပါ။",

    cardA11y: (names: string, num: string) => `${names}၊ ဂဏန်း ${spaced(num)}။ ဖွင့်ရန်။`,
    gridA11y: "အိပ်မက်များ",

    shownOf: (shown: number, total: number) => `${group(total)} ခုအနက် ${shown} ခုကို ပြထားပါသည်`,
    loadMore: "အိပ်မက် ထပ်ပြရန်",
    loadMoreA11y: (next: number) => `အိပ်မက် ထပ်ပြရန်။ နောက်ထပ် ${next} ခု ပြပါမည်။`,

    emptyTitle: (said: string) => `“${said}” နှင့် ကိုက်ညီသော အိပ်မက် မရှိပါ။`,
    emptyText: "အခြား စကားလုံး သို့မဟုတ် ဂဏန်းဖြင့် ရှာကြည့်ပါ။",
    emptyClear: "ရှာဖွေမှုကို ရှင်းလင်းရန်",

    noneTitle: "အိပ်မက် မရှိသေးပါ",
    noneText: "အိပ်မက်စာအုပ်ကို ဖြည့်သွင်းနေဆဲ ဖြစ်ပါသည်။ မကြာမီ ပြန်ကြည့်ပါ။",

    errorTitle: "အိပ်မက်စာအုပ်ကို ဖွင့်၍ မရပါ",
    errorText: "အိပ်မက်များကို ဖွင့်၍ မရပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်ကြိုးစားကြည့်ပါ။",
    retry: "ထပ်ကြိုးစားကြည့်ရန်",

    footerLine: "အိပ်မက် ဂဏန်းသည် အိပ်မက်စာအုပ်မှ အကြံပြုချက်သာ ဖြစ်ပြီး ကြိုတင်ခန့်မှန်းချက် မဟုတ်ပါ။",
  },

  gen: {
    backA11y: (book: DreamBook) => `အိပ်မက် ဂဏန်း ${book} သို့ ပြန်သွားရန်`,

    numberA11y: (num: string) => `အိပ်မက် ဂဏန်း ${spaced(num)}။`,

    loading: "အိပ်မက်ကို ဖွင့်နေသည်…",
    errorTitle: "အိပ်မက်ကို ဖွင့်၍ မရပါ",
    errorText: "ဤအိပ်မက်ကို ဖွင့်၍ မရပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်ကြိုးစားကြည့်ပါ။",
    retry: "ထပ်ကြိုးစားကြည့်ရန်",
    missingTitle: "ဤအိပ်မက်သည် စာအုပ်ထဲတွင် မရှိပါ",
    missingText: (book: DreamBook) =>
      `အိပ်မက် ဂဏန်း ${book} တွင် ဤဂဏန်းပါသော အိပ်မက် မရှိပါ၊ သို့မဟုတ် ထိုအိပ်မက်ကို ပိတ်ထားပါသည်။ စာအုပ်ထဲမှ အခြားအိပ်မက်တစ်ခု ရွေးပါ။`,
    backToBook: (book: DreamBook) => `အိပ်မက် ဂဏန်း ${book} သို့ ပြန်သွားရန်`,

    /**
     * "ပွဲစဉ် 24 · 31 အောက် · တစ်စောင်လျှင် <b>1,000 Ks</b>": Burmese puts
     * "per ticket" BEFORE the price, so it ends the plain run and the tail
     * after the bold price is empty.
     */
    drawLine: (n: number, date: string) => `ပွဲစဉ် ${n} · ${date} · တစ်စောင်လျှင် `,
    drawLinePrice: "",
    drawLineA11y: (status: DrawStatus | null, n: number, date: string, price: string) =>
      `${status ? `${LT_COPY.pills[status]}။ ` : ""}ပွဲစဉ် ${n}၊ ${date}၊ တစ်စောင်လျှင် ${price}။`,
    /* "ပွဲစဉ် ဖွင့်" would read as the draw OPENING for sale, so loading a draw is ရယူ (as the Home's draw card says). */
    drawLoading: "ပွဲစဉ်ကို ရယူနေသည်…",
    drawNone: "ရောင်းချနေသော ပွဲစဉ် မရှိသေးပါ။ လက်မှတ်များ ရွေးပြီး ၎င်းတို့၏ နံပါတ်များကို ကူးယူနိုင်ပါသေးသည်။",
    drawErrorTitle: "ပွဲစဉ်ကို ရယူ၍ မရပါ",

    placeGroup: (num: string) => `လက်မှတ်ထဲတွင် ${num} ထားမည့်နေရာ`,
    places: { start: "အစ", middle: "အလယ်", end: "အဆုံး", mixed: "ရောနှော" },
    placeSpoken: { start: "အစတွင်", middle: "အလယ်တွင်", end: "အဆုံးတွင်" },
    placeHelp: (pos: "start" | "middle" | "end" | "mixed", num: string, digits: number, mid: number) => {
      const rest = 6 - digits;
      const after = 6 - mid - digits;
      if (pos === "start") return `ရှေ့ဆုံးတွင် ${num} ပါပြီး နောက်တွင် ကျပန်း ဂဏန်း ${rest} လုံး လိုက်ပါသည်။`;
      if (pos === "middle") {
        return `ရှေ့တွင် ကျပန်း ဂဏန်း ${mid} လုံး၊ ပြီးနောက် ${num}၊ ထို့နောက် ကျပန်း ဂဏန်း ${after} လုံး ပါပါသည်။`;
      }
      if (pos === "end") return `ရှေ့တွင် ကျပန်း ဂဏန်း ${rest} လုံး ပါပြီး နောက်ဆုံးတွင် ${num} ပါပါသည်။`;
      return `ရောနှော။ လက်မှတ် အချို့တွင် ${num} က အစ၊ အချို့တွင် အလယ်၊ အချို့တွင် အဆုံး၌ ပါပါသည်။`;
    },
    showOthers: "အခြား လက်မှတ်များ ပြရန်",
    generating: "လက်မှတ်များ ပြုလုပ်နေသည်…",
    keepNote: "ရွေးထားသော လက်မှတ်များ ဆက်ရှိနေပါမည်။ ကျန်လက်မှတ်များ ပြောင်းသွားပါမည်။",
    tapToPick: "လက်မှတ်ကို နှိပ်၍ ရွေးပါ။ အခြား လက်မှတ်များ ပြသည့်အခါ ရွေးထားသော လက်မှတ်များ ဆက်ရှိနေပါမည်။",

    ticketsTitle: (num: string) => `${num} ပါသော လက်မှတ်များ`,
    resultsCountSpoken: (n: number, np: number) =>
      `နမူနာ လက်မှတ် ${n} စောင်၊ ${np ? `${np} စောင် ရွေးထားပါသည်။` : "တစ်စောင်မှ မရွေးရသေးပါ။"}`,
    resultsBusySpoken: "နမူနာ လက်မှတ်အသစ်များ ပြုလုပ်နေသည်။",
    copyNumbers: (np: number) => (np === 0 ? "နံပါတ်အားလုံး ကူးယူရန်" : `နံပါတ် ${np} ခု ကူးယူရန်`),
    copiedSome: (nums: readonly string[]) => {
      const more = nums.length > 3 ? ` နှင့် နောက်ထပ် ${nums.length - 3} ခု။` : "။";
      return `နံပါတ် ${nums.length} ခု ကူးယူပြီးပါပြီ။ ${nums.slice(0, 3).join("၊ ")}${more}`;
    },
    copiedSomeSpoken: (n: number) => `နံပါတ် ${n} ခု ကူးယူပြီးပါပြီ။`,
    gridA11y: (drawNo: number) => `ပွဲစဉ် ${drawNo} အတွက် နမူနာ လက်မှတ်များ`,

    held: (n: number) => `${n} စောင် ဝယ်ထားပြီး`,
    offSale: "မရောင်းပါ",
    cardA11y: (num: string, place: string, off: boolean, held: number, drawNo: number) =>
      `လက်မှတ် ${spaced(num)}၊ အိပ်မက် ဂဏန်း ${place} ပါသည်${off ? `၊ ပွဲစဉ် ${drawNo} အတွက် မရောင်းပါ` : ""}${held && !off ? `၊ သင် ${held} စောင် ဝယ်ထားပြီးပါပြီ` : ""}`,
    offToast: (num: string, drawNo: number) => `${num} ကို ပွဲစဉ် ${drawNo} အတွက် မရောင်းပါ။ အခြား လက်မှတ်တစ်စောင် ရွေးပါ။`,
    offToastSpoken: (num: string, drawNo: number) =>
      `${spaced(num)} ကို ပွဲစဉ် ${drawNo} အတွက် မရောင်းပါ။ အခြား လက်မှတ်တစ်စောင် ရွေးပါ။`,
    fullToast: (num: string, most: number) =>
      `${num} ကို လက်မှတ် ${most} စောင် ဝယ်ထားပြီးဖြစ်၍ ဂဏန်းတစ်လုံးလျှင် ကန့်သတ်ချက် ပြည့်ပါပြီ။`,
    fullToastSpoken: (num: string, most: number) =>
      `${spaced(num)} ကို လက်မှတ် ${most} စောင် ဝယ်ထားပြီးဖြစ်၍ ဂဏန်းတစ်လုံးလျှင် ကန့်သတ်ချက် ပြည့်ပါပြီ။`,

    barCaption: (np: number, drawNo: number) =>
      np ? `${np} စောင် ရွေးထားပြီး · ပွဲစဉ် ${drawNo}` : `လက်မှတ် ရွေးရန် · ပွဲစဉ် ${drawNo}`,
    barWallet: (amount: string) => `ပိုက်ဆံအိတ် ${amount}`,
    barBuy: (np: number, total: string) => `${nTickets(np)} ဝယ်ရန် · ${total}`,
    barBuyA11y: (np: number, total: string, nums: readonly string[], drawNo: number) =>
      `ပွဲစဉ် ${drawNo} အတွက် ${nTickets(np)} ဝယ်ရန်၊ ${total}။ ${nums.map(spaced).join("၊ ")}`,
    barNone: "နှစ်သက်သော လက်မှတ်များ ရွေးပါ",
    bought: (np: number, drawNo: number) => `ပွဲစဉ် ${drawNo} အတွက် ${nTickets(np)} ဝယ်ပြီးပါပြီ။`,
  },
};

export const DREAM_COPY = ltCopy(DREAM_COPY_EN, DREAM_COPY_MM);
