import { nTickets, spaced } from "@/lottery/data/format";
import { ltCopy, type LtWiden } from "@/lottery/i18n";

/**
 * My tickets + one ticket, large (Tickets.dc.html, TicketView.dc.html) — the
 * words of these two pages in English and Burmese, like the shared LT_COPY
 * (src/lottery/i18n.ts). Copy rules (spec
 * §0.7): sentence case, "1,000 Ks", no "!", never "lucky" / "win big".
 */
const TICKETS_COPY_EN = {
  title: "My tickets",

  /** The "just bought" note (the board's afterPurchase lever, live from this session). */
  done: {
    lead: (n: number, drawNo: number) => `${nTickets(n)} bought for Draw ${drawNo}.`,
    ids: (ids: readonly string[]) =>
      ids.length === 1 ? ` It has its own ticket ID: ${ids[0]}.` : ` Each has its own ticket ID: ${listing(ids)}.`,
    balance: (amount: string) => ` Wallet balance now ${amount}.`,
    go: "Show the new tickets",
  },

  /** The page while it loads or fails. */
  loading: "Loading your tickets…",
  errorTitle: "Your tickets did not load",
  errorText: "We could not load your tickets. Check your connection and try again.",
  retry: "Try again",

  group: {
    drawAt: (time: string) => `Draw at ${time}`,
    published: (time: string) => `Published ${time}`,
    winning: "Winning number",
    winningA11y: (number: string) => `Winning number ${spaced(number)}`,
    wonTitle: "One of your tickets won",
    wonSub: (id: string, number: string) => `Ticket ${id} · ${number}`,
    wonA11y: (id: string, number: string) => `Won. One of your tickets won: ticket ${id}, number ${spaced(number)}`,
    /**
     * Several won (nine prize groups since 15 Oct 2026: Draw 23 = 058314 + 731560 × 2). No board shows this line
     * with more than one winner; it names every won number, and opens the ticket with the biggest prize.
     */
    wonTitleMany: (n: number) => `${n} of your tickets won`,
    wonSubMany: (piles: readonly { number: string; count: number }[]) =>
      piles.map((p) => (p.count > 1 ? `${p.number} × ${p.count}` : p.number)).join(" · "),
    wonA11yMany: (n: number, piles: readonly { number: string; count: number }[]) =>
      `Won. ${n} of your tickets won: ${piles
        .map((p) => (p.count > 1 ? `${spaced(p.number)}, ${nTickets(p.count)}` : spaced(p.number)))
        .join("; ")}`,
    wonHint: "Opens the ticket",
    wonHintMany: "Opens the ticket with the biggest prize",
    buys: (n: number) => `Bought in ${n} ${n === 1 ? "purchase" : "purchases"}`,
    purchases: "Purchases",
    purchasesA11y: "Purchases, in Lottery history",
  },

  /** Same number, same draw = ONE pile (the cascade). Its caption and its one result. */
  pile: {
    newChip: "New",
    /** The caption read as one line: "3 7 2 6 9 4: 3 tickets, 3,000 Ks, new. Waiting for draw." */
    capA11y: (number: string, count: number, cost: string, isNew: boolean, status: string) =>
      `${spaced(number)}: ${nTickets(count)}, ${cost}${isNew ? ", new" : ""}. ${status}.`,
    /** The bought list under each number: the ticket on the left, when it was bought on the right. */
    cols: { ticket: "Ticket", bought: "Bought" },
    boughtA11y: (pos: number, id: string, at: string) => `Ticket ${pos}, ${id}, bought ${at}`,
  },

  /** No ticket for the current draw (owner, 2026-10-27: the page holds the current draw only). */
  empty: {
    /** "No tickets for Draw 25 yet"; once its sale is over, without "yet"; no draw at all, "No tickets yet". */
    title: (drawNo: number | null, saleOver: boolean) =>
      drawNo === null ? "No tickets yet" : saleOver ? `No tickets for Draw ${drawNo}` : `No tickets for Draw ${drawNo} yet`,
    text: {
      noDraw: "Tickets you buy appear here, one for each purchase, kept by draw.",
      selling: (drawNo: number) => `Tickets you buy for Draw ${drawNo} appear here, one for each purchase.`,
      closed: (drawNo: number) => `Sales for Draw ${drawNo} have closed. Tickets for the next draw appear here once it opens.`,
      published: (drawNo: number) => `Draw ${drawNo} is finished. Tickets for the next draw appear here once it opens.`,
    },
    open: (drawNo: number, close: string) => `Draw ${drawNo} is open for sale until ${close}`,
    action: "Choose numbers",
    /** Shown only when History holds earlier draws' tickets. */
    earlier: "See your earlier tickets in History",
    earlierA11y: "See your earlier tickets, in Lottery history",
  },
} as const;

const TICKETS_COPY_MM: LtWiden<typeof TICKETS_COPY_EN> = {
  title: "ကျွန်ုပ်၏ လက်မှတ်များ",

  done: {
    lead: (n: number, drawNo: number) => `ပွဲစဉ် ${drawNo} အတွက် ${nTickets(n)} ဝယ်ပြီးပါပြီ။`,
    ids: (ids: readonly string[]) =>
      ids.length === 1
        ? ` ၎င်းတွင် ကိုယ်ပိုင် လက်မှတ် ID ရှိပြီး ${ids[0]} ဖြစ်ပါသည်။`
        : ` လက်မှတ်တစ်စောင်စီတွင် ကိုယ်ပိုင် လက်မှတ် ID ရှိပြီး ${listingMm(ids)} ဖြစ်ပါသည်။`,
    balance: (amount: string) => ` ယခု ပိုက်ဆံအိတ် လက်ကျန်ငွေ ${amount} ဖြစ်ပါသည်။`,
    go: "လက်မှတ်အသစ်များ ပြရန်",
  },

  loading: "သင့်လက်မှတ်များကို ဖွင့်နေသည်…",
  errorTitle: "သင့်လက်မှတ်များကို ဖွင့်၍ မရပါ",
  errorText: "သင့်လက်မှတ်များကို ဖွင့်၍ မရပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်ကြိုးစားကြည့်ပါ။",
  retry: "ထပ်ကြိုးစားကြည့်ရန်",

  group: {
    drawAt: (time: string) => `ထီဖွင့်ချိန် ${time}`,
    published: (time: string) => `ရလဒ် ထွက်ချိန် ${time}`,
    winning: "ပေါက်ဂဏန်း",
    winningA11y: (number: string) => `ပေါက်ဂဏန်း ${spaced(number)}`,
    wonTitle: "သင့်လက်မှတ် တစ်စောင် ပေါက်ပါသည်",
    wonSub: (id: string, number: string) => `လက်မှတ် ${id} · ${number}`,
    wonA11y: (id: string, number: string) =>
      `ပေါက်ပါသည်။ သင့်လက်မှတ် တစ်စောင် ပေါက်ပါသည်။ လက်မှတ် ${id}၊ နံပါတ် ${spaced(number)}`,
    wonTitleMany: (n: number) => `သင့်လက်မှတ် ${n} စောင် ပေါက်ပါသည်`,
    wonSubMany: (piles: readonly { number: string; count: number }[]) =>
      piles.map((p) => (p.count > 1 ? `${p.number} × ${p.count}` : p.number)).join(" · "),
    // Each won number is its own sentence for the screen reader ("။" pauses where the English ";" does).
    wonA11yMany: (n: number, piles: readonly { number: string; count: number }[]) =>
      `ပေါက်ပါသည်။ သင့်လက်မှတ် ${n} စောင် ပေါက်ပါသည်။ ${piles
        .map((p) => (p.count > 1 ? `${spaced(p.number)}၊ ${nTickets(p.count)}` : spaced(p.number)))
        .join("။ ")}`,
    wonHint: "လက်မှတ်ကို ဖွင့်ပါမည်",
    wonHintMany: "ဆုငွေ အများဆုံး ပေါက်သော လက်မှတ်ကို ဖွင့်ပါမည်",
    // No plural in Burmese: one form for 1 and many ("ဝယ်ယူမှု 1 ကြိမ်ဖြင့်").
    buys: (n: number) => `ဝယ်ယူမှု ${n} ကြိမ်ဖြင့် ဝယ်ထားသည်`,
    purchases: "ဝယ်ယူမှုများ",
    purchasesA11y: "ထီ မှတ်တမ်းရှိ ဝယ်ယူမှုများ",
  },

  pile: {
    newChip: "အသစ်",
    capA11y: (number: string, count: number, cost: string, isNew: boolean, status: string) =>
      `${spaced(number)}၊ ${nTickets(count)}၊ ${cost}${isNew ? "၊ အသစ်" : ""}။ ${status}။`,
    cols: { ticket: "လက်မှတ်", bought: "ဝယ်ယူချိန်" },
    // "Ticket 2" is the row's place in the list, "the 2nd ticket" — never a lottery number.
    boughtA11y: (pos: number, id: string, at: string) => `${pos} စောင်မြောက် လက်မှတ်၊ ${id}၊ ${at} တွင် ဝယ်ထားသည်`,
  },

  empty: {
    title: (drawNo: number | null, saleOver: boolean) =>
      drawNo === null
        ? "လက်မှတ် မရှိသေးပါ"
        : saleOver
          ? `ပွဲစဉ် ${drawNo} အတွက် လက်မှတ် မရှိပါ`
          : `ပွဲစဉ် ${drawNo} အတွက် လက်မှတ် မရှိသေးပါ`,
    text: {
      noDraw: "သင်ဝယ်သော လက်မှတ်များ ဤနေရာတွင် ပေါ်လာပါမည်။ ဝယ်ယူမှုတစ်ခုစီအတွက် တစ်စောင်စီ ပြပြီး ပွဲစဉ်အလိုက် စုထားပါမည်။",
      selling: (drawNo: number) =>
        `ပွဲစဉ် ${drawNo} အတွက် သင်ဝယ်သော လက်မှတ်များ ဝယ်ယူမှုတစ်ခုစီအတွက် တစ်စောင်စီ ဤနေရာတွင် ပေါ်လာပါမည်။`,
      closed: (drawNo: number) =>
        `ပွဲစဉ် ${drawNo} အတွက် ရောင်းချမှု ပိတ်ပြီးပါပြီ။ နောက်ပွဲစဉ် ဖွင့်သည်နှင့် ထိုပွဲစဉ်၏ လက်မှတ်များ ဤနေရာတွင် ပေါ်လာပါမည်။`,
      published: (drawNo: number) =>
        `ပွဲစဉ် ${drawNo} ပြီးဆုံးပါပြီ။ နောက်ပွဲစဉ် ဖွင့်သည်နှင့် ထိုပွဲစဉ်၏ လက်မှတ်များ ဤနေရာတွင် ပေါ်လာပါမည်။`,
    },
    open: (drawNo: number, close: string) => `ပွဲစဉ် ${drawNo} ကို ${close} အထိ ရောင်းချနေသည်`,
    action: "ဂဏန်း ရွေးရန်",
    earlier: "ယခင် လက်မှတ်များကို မှတ်တမ်းတွင် ကြည့်ရန်",
    earlierA11y: "ယခင် လက်မှတ်များကို ထီ မှတ်တမ်းတွင် ကြည့်ရန်",
  },
};

export const TICKETS_COPY = ltCopy(TICKETS_COPY_EN, TICKETS_COPY_MM);

const TICKET_VIEW_COPY_EN = {
  backToList: "My tickets",
  backA11y: "Back to my tickets",
  title: "Your ticket",
  kicker: (drawNo: number, day: string) => `Draw ${drawNo} · ${day}`,

  turn: "Turn sideways",
  turnHint: "See it larger, the long way. Nothing is cut off.",

  /** "Ticket 2 of 3 with 372694" — the same number, separate tickets. */
  step: {
    of: (i: number, n: number, number: string) => `Ticket ${i} of ${n} with ${number}`,
    ofA11y: (i: number, n: number, number: string) => `Ticket ${i} of ${n} with ${spaced(number)}`,
    only: (number: string) => `Your only ticket with ${number}`,
    onlyA11y: (number: string) => `Your only ticket with ${spaced(number)}`,
    sameSub: "Same number, each ticket bought separately",
    onlySub: "No other tickets with this number",
    prev: (number: string) => `Previous ticket with ${spaced(number)}`,
    next: (number: string) => `Next ticket with ${spaced(number)}`,
  },

  waiting: {
    lead: "Waiting for draw.",
    text: (time: string, day: string) => ` The winning number is published after the ${time} draw on ${day}.`,
  },

  result: {
    kicker: "Result",
    title: (drawNo: number) => `Checked against Draw ${drawNo}`,
    winning: "Winning number",
    yours: "Your number",
    yoursA11y: (number: string) => `Your number ${spaced(number)}`,
    /** The win line's title: what the ticket was paid (the groups it won in go on the line under it). */
    wonKs: (amount: string) => `This ticket won ${amount}`,
    /** Won, but the amount is not known yet (the ticket row is older than the publish): the group names. */
    wonPrize: (names: readonly string[]) => `This ticket won: ${names.join(" + ")}`,
    /** "1st prize · Published Sat 24 Oct 2026, 6:20 PM" — the groups won, then when. */
    wonSub: (names: readonly string[], published: string) =>
      names.length ? `${names.join(" + ")} · ${published}` : published,
    /** No board shows a not-won ticket large; this line is the build's own (BUILD.md, group C). */
    notWonTitle: "No prize for this ticket",
    published: (at: string) => `Published ${at}`,
    /** Under the tiles while the draw's sheet loads. */
    sheetLoading: "Loading the winning numbers…",
    seeAll: "See all results",
  },

  details: {
    title: "Ticket details",
    id: "Ticket ID",
    number: "Number",
    draw: "Draw",
    drawDate: "Draw date",
    bought: "Bought",
    price: "Price",
    ref: "Purchase ref",
    refA11y: (ref: string) => `Purchase ref ${ref}, open in Lottery history`,
    status: "Status",
    winning: "Winning number",
    prize: "Prize",
  },

  side: {
    title: "Ticket sideways",
    sub: (drawNo: number, id: string) => `Draw ${drawNo} · ${id}`,
    close: "Close",
    closeA11y: "Close sideways view",
    hint: "Turn your phone to read it. The whole ticket stays in view.",
  },

  loading: "Loading the ticket…",
  errorTitle: "The ticket did not load",
  errorText: "We could not load this ticket. Check your connection and try again.",
  retry: "Try again",
  missing: {
    title: "This ticket is not here",
    text: "It is not one of your tickets, or there is no ticket with this number. Your tickets are in My tickets, and earlier draws' tickets are in Lottery history.",
  },
} as const;

const TICKET_VIEW_COPY_MM: LtWiden<typeof TICKET_VIEW_COPY_EN> = {
  backToList: "ကျွန်ုပ်၏ လက်မှတ်များ",
  backA11y: "ကျွန်ုပ်၏ လက်မှတ်များသို့ ပြန်သွားရန်",
  title: "သင့်လက်မှတ်",
  kicker: (drawNo: number, day: string) => `ပွဲစဉ် ${drawNo} · ${day}`,

  turn: "ဘေးတိုက် လှည့်ကြည့်ရန်",
  turnHint: "အလျားလိုက် ပိုကြီးအောင် ကြည့်နိုင်ပါသည်။ မည်သည့်အပိုင်းမျှ ဖြတ်မထားပါ။",

  step: {
    of: (i: number, n: number, number: string) => `${number} ပါ လက်မှတ် ${n} စောင်အနက် ${i} စောင်မြောက်`,
    ofA11y: (i: number, n: number, number: string) =>
      `${spaced(number)} ပါ လက်မှတ် ${n} စောင်အနက် ${i} စောင်မြောက်`,
    only: (number: string) => `${number} ပါ သင့်လက်မှတ် တစ်စောင်တည်း`,
    onlyA11y: (number: string) => `${spaced(number)} ပါ သင့်လက်မှတ် တစ်စောင်တည်း`,
    sameSub: "နံပါတ်တူ၊ လက်မှတ်တစ်စောင်စီကို သီးခြား ဝယ်ထားသည်",
    onlySub: "ဤနံပါတ်ဖြင့် အခြား လက်မှတ် မရှိပါ",
    prev: (number: string) => `${spaced(number)} ပါ ယခင် လက်မှတ်`,
    next: (number: string) => `${spaced(number)} ပါ နောက် လက်မှတ်`,
  },

  waiting: {
    lead: "ထီဖွင့်ပွဲ စောင့်ဆဲ။",
    text: (time: string, day: string) => ` ${day}၊ ${time} ထီဖွင့်ပွဲ ပြီးနောက် ပေါက်ဂဏန်းကို ထုတ်ပြန်ပါမည်။`,
  },

  result: {
    kicker: "ရလဒ်",
    title: (drawNo: number) => `ပွဲစဉ် ${drawNo} ရလဒ်နှင့် တိုက်စစ်ထားသည်`,
    winning: "ပေါက်ဂဏန်း",
    yours: "သင့်ဂဏန်း",
    yoursA11y: (number: string) => `သင့်ဂဏန်း ${spaced(number)}`,
    wonKs: (amount: string) => `ဤလက်မှတ် ${amount} ပေါက်ပါသည်`,
    wonPrize: (names: readonly string[]) => `ဤလက်မှတ် ${names.join(" + ")} ပေါက်ပါသည်`,
    wonSub: (names: readonly string[], published: string) =>
      names.length ? `${names.join(" + ")} · ${published}` : published,
    notWonTitle: "ဤလက်မှတ် မပေါက်ပါ",
    published: (at: string) => `ရလဒ် ထွက်ချိန် ${at}`,
    sheetLoading: "ပေါက်ဂဏန်းများကို ဖွင့်နေသည်…",
    seeAll: "ရလဒ် အားလုံး ကြည့်ရန်",
  },

  details: {
    title: "လက်မှတ် အသေးစိတ်",
    id: "လက်မှတ် ID",
    number: "ဂဏန်း",
    draw: "ပွဲစဉ်",
    drawDate: "ထီဖွင့်ရက်",
    bought: "ဝယ်ယူချိန်",
    price: "ဈေးနှုန်း",
    ref: "ဝယ်ယူမှု ရည်ညွှန်း",
    refA11y: (ref: string) => `ဝယ်ယူမှု ရည်ညွှန်း ${ref}၊ ထီ မှတ်တမ်းတွင် ဖွင့်ရန်`,
    status: "အခြေအနေ",
    winning: "ပေါက်ဂဏန်း",
    prize: "ဆုငွေ",
  },

  side: {
    title: "လက်မှတ် ဘေးတိုက်ကြည့်",
    sub: (drawNo: number, id: string) => `ပွဲစဉ် ${drawNo} · ${id}`,
    close: "ပိတ်ရန်",
    closeA11y: "ဘေးတိုက်ကြည့်ခြင်းကို ပိတ်ရန်",
    hint: "ဖတ်ရန် ဖုန်းကို လှည့်ပါ။ လက်မှတ် တစ်စောင်လုံးကို မြင်ရပါမည်။",
  },

  loading: "လက်မှတ်ကို ဖွင့်နေသည်…",
  errorTitle: "လက်မှတ်ကို ဖွင့်၍ မရပါ",
  errorText: "ဤလက်မှတ်ကို ဖွင့်၍ မရပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်ကြိုးစားကြည့်ပါ။",
  retry: "ထပ်ကြိုးစားကြည့်ရန်",
  missing: {
    title: "ဤလက်မှတ်ကို မတွေ့ပါ",
    text: "ဤလက်မှတ်သည် သင့်လက်မှတ် မဟုတ်ပါ၊ သို့မဟုတ် ဤနံပါတ်ဖြင့် လက်မှတ် မရှိပါ။ သင့်လက်မှတ်များကို “ကျွန်ုပ်၏ လက်မှတ်များ” တွင်၊ ယခင် ပွဲစဉ်များ၏ လက်မှတ်များကို ထီ မှတ်တမ်းတွင် ကြည့်နိုင်ပါသည်။",
  },
};

export const TICKET_VIEW_COPY = ltCopy(TICKET_VIEW_COPY_EN, TICKET_VIEW_COPY_MM);

/** "A", "A and B", "A, B and C". */
function listing(items: readonly string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The Burmese list: "A", "A နှင့် B", "A၊ B နှင့် C". */
function listingMm(items: readonly string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join("၊ ")} နှင့် ${items[items.length - 1]}`;
}
