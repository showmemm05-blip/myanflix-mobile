/**
 * The Lottery's STRAY words: what shared components, a few screen parts and
 * the data helpers said on their own before the Lottery spoke two languages —
 * "Draw 24", the six-digit entry's spoken lines, the ticket preview's label,
 * the winning tiles, the nine prize groups' names, a purchase row's spoken
 * line. Moved here on 4 Nov 2026 so they follow the app's language like the
 * screens' own copy (src/lottery/i18n.ts; terms in
 * docs/lottery-burmese-2026-11-04/GLOSSARY.md). Grouped by the component
 * that reads them. Copy rules as in lottery/copy.ts: sentence case,
 * "1,000 Ks", no "!".
 */

import { spaced } from "@/lottery/data/format";
import { ltCopy, type LtWiden } from "@/lottery/i18n";

const COMPONENT_COPY_EN = {
  /** "Draw 24" — a draw's name as a card, a row or a heading prints it on its own. */
  drawNo: (no: number) => `Draw ${no}`,
  /** "Sat 31 Oct, 5:00 PM" — a day and a time on one line (when sales close, a ticket's draw date). */
  dayTime: (day: string, time: string) => `${day}, ${time}`,

  /** components/Countdown. */
  countdown: {
    /** The Home hero's chip: "Draw 24 · " before "Sales close in". */
    chipLead: (drawNo: number) => `Draw ${drawNo} · `,
    /** The chip read as one timer; `spoken` is LT_COPY.countdownA11y. */
    chipA11y: (drawNo: number, spoken: string) => `Draw ${drawNo} is open for sale. ${spoken}.`,
    /** The chip's value: "2d 04h 15m". */
    value: (d: string, h: string, m: string) => `${d}d ${h}h ${m}m`,
    /** The card's unit letters after each figure (nested Text ignores margins, so each carries its own space). */
    units: { d: "d ", h: "h ", m: "m" },
  },

  /** components/DrawCard: the line under the long date. */
  drawCard: {
    times: (drawTime: string, closeTime: string) => `Draw at ${drawTime} · Sales close ${closeTime}`,
  },

  /** components/LotteryTopBar: a pushed page's back control. */
  topBar: {
    /** The back link's word when the page names none. */
    back: "Back",
    /** The back control's spoken name: "Back to Home". */
    backA11y: (to: string) => `Back to ${to}`,
  },

  /** The six-digit entry: components/NumberWindow, ticket/TicketInput and numberEntry.ts. */
  entry: {
    /** The window's spoken name when the caller gives neither a label nor a name. */
    label: "Your six-digit number",
    /** The input's spoken value with no digits. */
    emptyValue: "No digits yet",
    /** Read when the entry empties (unless the caller says otherwise). */
    emptySpoken: "No digits yet.",
    /** A display-only window, read as one line: "Your six-digit number: 3 7 2." */
    windowA11y: (name: string, digits: string) => `${name}: ${digits ? spaced(digits) : "no digits yet"}.`,
    /** The tail of each spoken change when the caller has no help line: "3 of 6 digits." */
    progress: (n: number) => `${n} of 6 digits.`,
    /** Each change, digit by digit: "Your number: 3 7 2. 3 of 6 digits." */
    typed: (digits: string, tail: string) => `Your number: ${spaced(digits)}. ${tail}`,
  },

  /** components/WinningTiles, read as ONE label. */
  winningTiles: {
    a11y: (number: string) => `Winning number ${spaced(number)}`,
    notDrawn: "Winning number not drawn yet",
  },

  /** components/ticket/Ticket. */
  ticket: {
    /**
     * The preview before buying (no ticket ID yet); `number` is null while
     * the number is hidden: "Ticket preview. Ticket number 3 7 2 6 9 4. Draw
     * 24, Saturday 31 October 2026. Price 1,000 Ks. Ticket ID, barcode and QR
     * are added when you buy."
     */
    previewA11y: (number: string | null, drawNo: number, date: string, price: string) =>
      `${number === null ? "Ticket preview with no number yet. " : `Ticket preview. Ticket number ${spaced(number)}. `}Draw ${drawNo}, ${date}. Price ${price}. Ticket ID, barcode and QR are added when you buy.`,
  },

  /**
   * data/prizes.ts: the nine groups' names, by the wire's keys — the boards'
   * names (owner, 15 Oct 2026), also "Checking <name>…".
   */
  prizeGroups: {
    first: "1st prize",
    nearFirst: "Next to 1st prize",
    second: "2nd prize",
    third: "3rd prize",
    fourth: "4th prize",
    fifth: "5th prize",
    front3: "First 3 digits",
    back3: "Last 3 digits",
    back2: "Last 2 digits",
  },

  /** screens/history/PurchaseRow. */
  purchaseRow: {
    /** Between the printed lines: "004821 × 1, 372694 × 2". */
    lineSep: ", ",
    /** Between the spoken lines (history/copy.ts spokenLine). */
    spokenSep: "; ",
    /** The attempt that did not complete, read as one row. */
    failedA11y: (drawNo: number, lines: string, time: string, noRef: string, notCharged: string, failed: string) =>
      `Draw ${drawNo}, ${lines}. ${time}, ${noRef.toLowerCase()}. ${notCharged}. ${failed}.`,
    /** A paid purchase, read as one button. */
    paidA11y: (drawNo: number, lines: string, time: string, ref: string, amount: string, paid: string) =>
      `Draw ${drawNo}, ${lines}. ${time}, purchase ${ref}. ${amount}, ${paid}.`,
  },

  /** screens/results: EarlierResults and PrizeResults. */
  results: {
    /** One of the customer's tickets under an earlier draw; `status` is the pill's word. */
    ticketA11y: (number: string, id: string, status: string) =>
      `Ticket number ${spaced(number)}, ticket ID ${id}, ${status}.`,
    /** A folded group's "Show all 50": "Show all 50 4th prize numbers". */
    showAllA11y: (n: number, group: string) => `Show all ${n} ${group} numbers`,
    /** The same group opened: "Show fewer, 4th prize". */
    showFewerA11y: (group: string) => `Show fewer, ${group}`,
  },

  /** screens/tickets/parts/TicketResult: the win line read as one sentence. */
  ticketResult: {
    spoken: (won: boolean, title: string, sub: string, number: string) =>
      `${won ? "Won" : "Not won"}. ${title}. ${sub}. Your number ${spaced(number)}.`,
  },
} as const;

/** A Burmese sentence's own full stop dropped before another is added (a copy line may already end in "။"). */
const stop = (text: string) => text.replace(/[။.]\s*$/u, "");

const COMPONENT_COPY_MM: LtWiden<typeof COMPONENT_COPY_EN> = {
  drawNo: (no: number) => `ပွဲစဉ် ${no}`,
  dayTime: (day: string, time: string) => `${day}၊ ${time}`,

  countdown: {
    chipLead: (drawNo: number) => `ပွဲစဉ် ${drawNo} · `,
    chipA11y: (drawNo: number, spoken: string) => `ပွဲစဉ် ${drawNo} ကို ရောင်းချနေပါသည်။ ${stop(spoken)}။`,
    value: (d: string, h: string, m: string) => `${d} ရက် ${h} နာရီ ${m} မိနစ်`,
    units: { d: " ရက် ", h: " နာရီ ", m: " မိနစ်" },
  },

  drawCard: {
    times: (drawTime: string, closeTime: string) => `ထီဖွင့်ချိန် ${drawTime} · ရောင်းချမှု ပိတ်ချိန် ${closeTime}`,
  },

  topBar: {
    back: "နောက်သို့",
    backA11y: (to: string) => `${to} သို့ ပြန်သွားရန်`,
  },

  entry: {
    label: "သင့်ဂဏန်း 6 လုံး",
    emptyValue: "ဂဏန်း မထည့်ရသေးပါ",
    emptySpoken: "ဂဏန်း မထည့်ရသေးပါ။",
    // A display-only window with no digits is a number not out yet (Home's winning number before the first draw).
    windowA11y: (name: string, digits: string) => `${name}: ${digits ? spaced(digits) : "ဂဏန်း မရှိသေးပါ"}။`,
    progress: (n: number) => `ဂဏန်း 6 လုံးအနက် ${n} လုံး။`,
    typed: (digits: string, tail: string) => `သင့်ဂဏန်း: ${spaced(digits)}။ ${tail}`,
  },

  winningTiles: {
    a11y: (number: string) => `ပေါက်ဂဏန်း ${spaced(number)}`,
    notDrawn: "ပေါက်ဂဏန်း မထွက်ရသေးပါ",
  },

  ticket: {
    previewA11y: (number: string | null, drawNo: number, date: string, price: string) =>
      `${number === null ? "ဂဏန်း မပါသေးသော လက်မှတ် ကြိုတင်ကြည့်ရှုမှု။ " : `လက်မှတ် ကြိုတင်ကြည့်ရှုမှု။ လက်မှတ်နံပါတ် ${spaced(number)}။ `}ပွဲစဉ် ${drawNo}၊ ${date}။ ဈေးနှုန်း ${price}။ လက်မှတ် ID၊ ဘားကုဒ်နှင့် QR ကုဒ်ကို ဝယ်ယူသည့်အခါ ထည့်ပေးပါမည်။`,
  },

  // The admin's own Burmese group names (admin lottery.prizeGroups), with Latin digits.
  prizeGroups: {
    first: "ပထမဆု",
    nearFirst: "ပထမဆု ကပ်လျက်",
    second: "ဒုတိယဆု",
    third: "တတိယဆု",
    fourth: "စတုတ္ထဆု",
    fifth: "ပဉ္စမဆု",
    front3: "ရှေ့ 3 လုံး",
    back3: "နောက် 3 လုံး",
    back2: "နောက် 2 လုံး",
  },

  purchaseRow: {
    lineSep: "၊ ",
    // A spoken line already holds a "၊" ("ဂဏန်း 0 0 4 8 2 1၊ လက်မှတ် 1 စောင်"), so lines part with "။".
    spokenSep: "။ ",
    failedA11y: (drawNo: number, lines: string, time: string, noRef: string, notCharged: string, failed: string) =>
      `ပွဲစဉ် ${drawNo}၊ ${lines}။ ${time}၊ ${noRef}။ ${stop(notCharged)}။ ${stop(failed)}။`,
    paidA11y: (drawNo: number, lines: string, time: string, ref: string, amount: string, paid: string) =>
      `ပွဲစဉ် ${drawNo}၊ ${lines}။ ${time}၊ ဝယ်ယူမှု ${ref}။ ${amount}၊ ${stop(paid)}။`,
  },

  results: {
    ticketA11y: (number: string, id: string, status: string) =>
      `လက်မှတ်နံပါတ် ${spaced(number)}၊ လက်မှတ် ID ${id}၊ ${stop(status)}။`,
    showAllA11y: (n: number, group: string) => `${group} ဂဏန်း ${n} ခုလုံး ပြရန်`,
    showFewerA11y: (group: string) => `${group} ဂဏန်းများ လျှော့ပြရန်`,
  },

  ticketResult: {
    spoken: (won: boolean, title: string, sub: string, number: string) =>
      `${won ? "ပေါက်ပါသည်" : "မပေါက်ပါ"}။ ${stop(title)}။ ${stop(sub)}။ သင့်ဂဏန်း ${spaced(number)}။`,
  },
};

export const COMPONENT_COPY = ltCopy(COMPONENT_COPY_EN, COMPONENT_COPY_MM);
