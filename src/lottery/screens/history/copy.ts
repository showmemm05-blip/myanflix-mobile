import { nTickets, spaced } from "@/lottery/data/format";
import { ltCopy, ltLanguage, type LtWiden } from "@/lottery/i18n";

/**
 * Lottery history (History.dc.html) — this page's words in English and
 * Burmese, like the shared LT_COPY (src/lottery/i18n.ts).
 */
const HISTORY_COPY_EN = {
  title: "Lottery history",
  sub: "Tickets from earlier draws, and every purchase newest first. Each ticket has its own ticket ID.",

  /** The switch under the head (owner, 2026-10-27): the earlier draws' tickets, or the purchases. */
  view: {
    a11y: "Show in Lottery history",
    tickets: "Tickets",
    purchases: "Purchases",
    /** The option's spoken name: "Tickets from earlier draws, 12 tickets" (the count once it is known). */
    ticketsA11y: (n: number | undefined) =>
      n === undefined ? "Tickets from earlier draws" : `Tickets from earlier draws, ${nTickets(n)}`,
    purchasesA11y: (n: number | undefined) => (n === undefined ? "Purchases" : `Purchases, ${nBuys(n)}`),
    /** Spoken after a change (as My tickets' old filter did). */
    read: {
      tickets: (n: number | undefined) =>
        n === undefined ? "Showing tickets from earlier draws." : `Showing ${nTickets(n)} from earlier draws.`,
      purchases: "Showing your purchases, newest first.",
    },
  },

  /** "Tickets": the earlier draws' cards (the draws that left My tickets when the next draw opened). */
  earlier: {
    loading: "Loading your earlier tickets…",
    errorTitle: "Your earlier tickets did not load",
    errorText: "We could not load your tickets. Check your connection and try again.",
    shownOf: (shown: number, total: number) => `Showing ${nTickets(shown)} of ${total}`,
    loadMore: "Load more tickets",
    loadingMore: "Loading more tickets…",
    /** Over "Load more tickets" when the last page failed (the cards already shown stay). */
    moreFailed: "More tickets did not load. Check your connection and try again.",
    empty: {
      title: "No earlier draws yet",
      text: "Your earlier draws will appear here after the next draw opens.",
    },
  },

  /** The "just bought" note (the board's afterPurchase lever, live from this session). */
  done: {
    lead: (ref: string) => `Purchase ${ref} completed.`,
    body: (n: number, drawNo: number, total: string, balance: string | null) =>
      ` ${nTickets(n)} for Draw ${drawNo}, ${total} paid from your wallet.${balance ? ` Balance now ${balance}.` : ""}`,
    go: "See the new tickets",
  },

  /** The list while it loads, fails, or has more pages. */
  loading: "Loading your purchases…",
  errorTitle: "Your purchases did not load",
  errorText: "We could not load your purchases. Check your connection and try again.",
  retry: "Try again",
  shownOf: (shown: number, total: number) => `Showing ${shown} of ${total} ${total === 1 ? "purchase" : "purchases"}`,
  loadMore: "Load more purchases",
  loadingMore: "Loading more purchases…",

  totals: {
    title: "Totals by draw",
    sub: (tickets: number, buys: number) => `${nTickets(tickets)} in ${nBuys(buys)}`,
    /** Where the row leads: My tickets for the current draw, History's "Tickets" for an earlier one. */
    rowA11y: (drawNo: number, tickets: number, buys: number, amount: string, earlier: boolean) =>
      `Draw ${drawNo}: ${nTickets(tickets)} in ${nBuys(buys)}, ${amount}. ${earlier ? "Shows its tickets in History" : "Opens My tickets"}`,
    paid: "Total paid",
    note: (tickets: number, buys: number, hasFailed: boolean, partial: boolean) =>
      `${nTickets(tickets)} in ${nBuys(buys)}, paid from your MyanFlix wallet.` +
      (hasFailed ? " The attempt that did not complete is not counted." : "") +
      (partial ? " Purchases not loaded yet are not counted." : ""),
  },

  /** Prizes paid into the wallet (the ledger's LOTTERY_PRIZE rows, phase 3). */
  prizes: {
    title: "Prizes received",
    row: "Lottery prize",
    rowA11y: (amount: string, at: string) => `Lottery prize, ${amount}, ${at}`,
    total: "Total prizes",
    note: (n: number, partial: boolean) =>
      `${n === 1 ? "1 prize" : `${n} prizes`} paid into your MyanFlix wallet.` +
      (partial ? " Older wallet entries are not counted." : ""),
    wallet: "See wallet",
    walletA11y: "See wallet, in MyanFlix",
  },

  purchases: {
    title: "Purchases",
    order: "Newest first",
    noRef: "No purchase ref",
    more: (n: number, open: boolean) =>
      open ? (n > 1 ? "Hide ticket IDs" : "Hide ticket ID") : n > 1 ? `Show ${n} ticket IDs` : "Show ticket ID",
    panel: (n: number) => (n > 1 ? `${n} separate tickets from this purchase` : "Ticket from this purchase"),
    nth: (i: number, n: number) => `${i} of ${n}`,
    idA11y: (id: string, nth: string | null) => `Ticket ${id}${nth ? `, ${nth}` : ""}. Opens the ticket`,
    /** Over two numbers in one purchase (a Dream Number pick), the rest are counted. */
    moreNumbers: (n: number) => ` + ${n} more`,
    notCharged: (amount: string) => `${amount} not charged`,
    failed: "Not completed · nothing was charged",
  },

  empty: {
    title: "No purchases yet",
    text: "Your lottery purchases appear here, newest first, with the ticket ID of every ticket.",
    action: "Choose your number",
  },
} as const;

const HISTORY_COPY_MM: LtWiden<typeof HISTORY_COPY_EN> = {
  title: "ထီ မှတ်တမ်း",
  sub: "ယခင် ပွဲစဉ်များမှ လက်မှတ်များနှင့် ဝယ်ယူမှုတိုင်းကို ပြပါသည်။ ဝယ်ယူမှုများကို အသစ်ဆုံးမှ စ၍ စီထားပါသည်။ လက်မှတ်တိုင်းတွင် ကိုယ်ပိုင် လက်မှတ် ID ရှိပါသည်။",

  view: {
    a11y: "ထီ မှတ်တမ်းတွင် ပြရန်",
    tickets: "လက်မှတ်များ",
    purchases: "ဝယ်ယူမှုများ",
    ticketsA11y: (n: number | undefined) =>
      n === undefined ? "ယခင် ပွဲစဉ်များမှ လက်မှတ်များ" : `ယခင် ပွဲစဉ်များမှ လက်မှတ်များ၊ ${nTickets(n)}`,
    purchasesA11y: (n: number | undefined) => (n === undefined ? "ဝယ်ယူမှုများ" : `ဝယ်ယူမှုများ၊ ${nBuysMm(n)}`),
    read: {
      tickets: (n: number | undefined) =>
        n === undefined
          ? "ယခင် ပွဲစဉ်များမှ လက်မှတ်များကို ပြနေပါသည်။"
          : `ယခင် ပွဲစဉ်များမှ ${nTickets(n)}ကို ပြနေပါသည်။`,
      purchases: "သင့်ဝယ်ယူမှုများကို အသစ်ဆုံးမှ စ၍ ပြနေပါသည်။",
    },
  },

  earlier: {
    loading: "သင့်ယခင် လက်မှတ်များကို ဖွင့်နေသည်…",
    errorTitle: "သင့်ယခင် လက်မှတ်များကို ဖွင့်၍ မရပါ",
    errorText: "သင့်လက်မှတ်များကို ဖွင့်၍ မရပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်ကြိုးစားကြည့်ပါ။",
    shownOf: (shown: number, total: number) => `${nTickets(total)}အနက် ${shown} စောင်ကို ပြထားပါသည်`,
    loadMore: "လက်မှတ် ထပ်ပြရန်",
    loadingMore: "နောက်ထပ် လက်မှတ်များကို ဖွင့်နေသည်…",
    moreFailed: "နောက်ထပ် လက်မှတ်များကို ဖွင့်၍ မရပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်ကြိုးစားကြည့်ပါ။",
    empty: {
      title: "ယခင် ပွဲစဉ် မရှိသေးပါ",
      text: "နောက်ပွဲစဉ် ဖွင့်ပြီးသည့်အခါ သင့်ယခင် ပွဲစဉ်များ ဤနေရာတွင် ပေါ်လာပါမည်။",
    },
  },

  done: {
    lead: (ref: string) => `ဝယ်ယူမှု ${ref} ပြီးဆုံးပါပြီ။`,
    /** Keeps the English's leading space: it follows the bold lead in the same line. */
    body: (n: number, drawNo: number, total: string, balance: string | null) =>
      ` ပွဲစဉ် ${drawNo} အတွက် ${nTickets(n)}၊ သင့်ပိုက်ဆံအိတ်မှ ${total} ပေးချေပြီးပါပြီ။${balance ? ` ယခု လက်ကျန်ငွေ ${balance} ဖြစ်ပါသည်။` : ""}`,
    go: "လက်မှတ်အသစ်များ ကြည့်ရန်",
  },

  loading: "သင့်ဝယ်ယူမှုများကို ဖွင့်နေသည်…",
  errorTitle: "သင့်ဝယ်ယူမှုများကို ဖွင့်၍ မရပါ",
  errorText: "သင့်ဝယ်ယူမှုများကို ဖွင့်၍ မရပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်ကြိုးစားကြည့်ပါ။",
  retry: "ထပ်ကြိုးစားကြည့်ရန်",
  shownOf: (shown: number, total: number) => `${nBuysMm(total)}အနက် ${shown} ကြိမ်ကို ပြထားပါသည်`,
  loadMore: "ဝယ်ယူမှု ထပ်ပြရန်",
  loadingMore: "နောက်ထပ် ဝယ်ယူမှုများကို ဖွင့်နေသည်…",

  totals: {
    title: "ပွဲစဉ်အလိုက် စုစုပေါင်း",
    sub: (tickets: number, buys: number) => `${nBuysMm(buys)}တွင် ${nTickets(tickets)}`,
    rowA11y: (drawNo: number, tickets: number, buys: number, amount: string, earlier: boolean) =>
      `ပွဲစဉ် ${drawNo}၊ ${nBuysMm(buys)}တွင် ${nTickets(tickets)}၊ ${amount}။ ${earlier ? "၎င်း၏ လက်မှတ်များကို မှတ်တမ်းတွင် ပြပါမည်" : "ကျွန်ုပ်၏ လက်မှတ်များကို ဖွင့်ပါမည်"}`,
    paid: "ပေးချေငွေ စုစုပေါင်း",
    note: (tickets: number, buys: number, hasFailed: boolean, partial: boolean) =>
      `${nBuysMm(buys)}တွင် ${nTickets(tickets)}၊ သင့် MyanFlix ပိုက်ဆံအိတ်မှ ပေးချေထားပါသည်။` +
      (hasFailed ? " မပြီးဆုံးခဲ့သော ဝယ်ယူမှုကို ထည့်မတွက်ပါ။" : "") +
      (partial ? " မဖွင့်ရသေးသော ဝယ်ယူမှုများကို ထည့်မတွက်ပါ။" : ""),
  },

  prizes: {
    title: "ရရှိပြီးသော ဆုငွေများ",
    row: "ထီဆုငွေ",
    rowA11y: (amount: string, at: string) => `ထီဆုငွေ၊ ${amount}၊ ${at}`,
    total: "ဆုငွေ စုစုပေါင်း",
    note: (n: number, partial: boolean) =>
      `ဆုငွေ ${n} ကြိမ်ကို သင့် MyanFlix ပိုက်ဆံအိတ်ထဲ ထည့်ပေးပြီးပါပြီ။` +
      (partial ? " ပိုက်ဆံအိတ် မှတ်တမ်းဟောင်းများကို ထည့်မတွက်ပါ။" : ""),
    wallet: "ပိုက်ဆံအိတ် ကြည့်ရန်",
    walletA11y: "MyanFlix ရှိ ပိုက်ဆံအိတ် ကြည့်ရန်",
  },

  purchases: {
    title: "ဝယ်ယူမှုများ",
    order: "အသစ်ဆုံး အရင်",
    noRef: "ဝယ်ယူမှု ရည်ညွှန်း မရှိ",
    more: (n: number, open: boolean) =>
      open ? "လက်မှတ် ID ဖျောက်ရန်" : n > 1 ? `လက်မှတ် ID ${n} ခု ပြရန်` : "လက်မှတ် ID ပြရန်",
    panel: (n: number) => (n > 1 ? `ဤဝယ်ယူမှုမှ သီးခြား လက်မှတ် ${n} စောင်` : "ဤဝယ်ယူမှုမှ လက်မှတ်"),
    nth: (i: number, n: number) => `${n} စောင်အနက် ${i} စောင်မြောက်`,
    idA11y: (id: string, nth: string | null) => `လက်မှတ် ${id}${nth ? `၊ ${nth}` : ""}။ လက်မှတ်ကို ဖွင့်ပါမည်`,
    /** A count of numbers takes ခု (လုံး counts digits). */
    moreNumbers: (n: number) => ` + နောက်ထပ် ${n} ခု`,
    notCharged: (amount: string) => `${amount} မဖြတ်ခဲ့ပါ`,
    failed: "မပြီးဆုံးပါ · ငွေ မဖြတ်ခဲ့ပါ",
  },

  empty: {
    title: "ဝယ်ယူမှု မရှိသေးပါ",
    text: "သင့်ထီ ဝယ်ယူမှုများ လက်မှတ်တိုင်း၏ လက်မှတ် ID နှင့်အတူ အသစ်ဆုံးမှ စ၍ ဤနေရာတွင် ပေါ်လာပါမည်။",
    action: "ဂဏန်း ရွေးရန်",
  },
};

export const HISTORY_COPY = ltCopy(HISTORY_COPY_EN, HISTORY_COPY_MM);

/** "Draw 24, number 0 0 4 8 2 1, 1 ticket" — one purchase line as a screen reader should hear it. */
export function spokenLine(number: string, quantity: number): string {
  if (ltLanguage() === "mm") return `ဂဏန်း ${spaced(number)}၊ ${nTickets(quantity)}`;
  return `number ${spaced(number)}, ${nTickets(quantity)}`;
}

function nBuys(n: number): string {
  return n === 1 ? "1 purchase" : `${n} purchases`;
}

/** "ဝယ်ယူမှု 3 ကြိမ်" — the Burmese count (no plural; the admin's own `buysCount` wording). */
function nBuysMm(n: number): string {
  return `ဝယ်ယူမှု ${n} ကြိမ်`;
}
