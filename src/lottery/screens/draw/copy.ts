/**
 * The Draw area's English copy — Draw, the Confirm sheet and Printed
 * (Draw.dc.html, Confirm.dc.html, Printed.dc.html, word for word). The Confirm
 * sheet lives in components/ because DreamTickets opens it too, but it is the
 * Draw flow's sheet, so its words are kept here with the rest of the flow.
 *
 * Two languages (owner, 4 Nov 2026; lottery/i18n.ts): DRAW_COPY_EN is the
 * boards' English word for word, DRAW_COPY_MM its Burmese twin of the same
 * shape (docs/lottery-burmese-2026-11-04/GLOSSARY.md), and DRAW_COPY answers
 * in whichever the app is set to. Copy rules (spec §0.7): sentence case,
 * "1,000 Ks", no "!", never "lucky", "win big", "official" or "government";
 * KBZPay and WavePay are the only ways to add money.
 *
 * The per-number limit ("up to 20") is the draw's own since phase 2, so every
 * line that says it takes `most`.
 */
import { nTickets, spaced } from "@/lottery/data/format";
import { ltCopy, type LtWiden } from "@/lottery/i18n";

/**
 * The spoken form of a line: every six-digit number in it read digit by digit
 * ("581206 is ready." → "5 8 1 2 0 6 is ready."), as the boards' `srText`.
 */
export function speakNumbers(text: string): string {
  return text.replace(/\b\d{6}\b/g, (run) => spaced(run));
}

/** "1 number" / "3 numbers". */
function nNumbers(n: number): string {
  return n === 1 ? "1 number" : `${n} numbers`;
}

/** "a", "a and b", "a, b and c" (the board's `andList`). */
function andList(parts: readonly string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts.join("");
}

/** Burmese "ဂဏန်း 3 ခု" — one count word, no plural; a count of numbers is ခု (လုံး counts digits: "ဂဏန်း 6 လုံး"). */
function nNumbersMm(n: number): string {
  return `ဂဏန်း ${n} ခု`;
}

/** Burmese "a", "a နှင့် b", "a၊ b နှင့် c". */
function andListMm(parts: readonly string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join("၊ ")} နှင့် ${parts[parts.length - 1]}` : parts.join("");
}

/** One number of a purchase and how many tickets of it (a purchase line, or a run of leftover tickets). */
type NumberCount = { readonly number: string; readonly quantity: number };

const DRAW_COPY_EN = {
  /** The number part of the draw card. */
  numberLabel: "Your six-digit number",
  quickPick: "Quick pick",
  clear: "Clear",
  clearA11y: "Clear the number",

  /** The help line under the ticket you type on (spec §3; Draw board, 22 Oct 2026), first match wins. */
  help: {
    dropped: "Only the digits 0 to 9 are kept.",
    /** Nothing typed yet: an invitation, in indigo with the pointing hand (kind "tap"). */
    empty: "Tap your ticket to type your number",
    partial: (count: number) => `${count} of 6 digits`,
    /** All six are in and the draw is being asked whether the number is on sale and how many are held. */
    checking: (number: string) => `Checking ${number}…`,
    /** "Your numbers" holds the most one purchase can carry and the window's number is not among them. */
    listFull: (max: number) => `Your list has ${max} numbers, the most for one purchase. Remove one to add another.`,
    offSale: (number: string, drawNo: number) => `${number} is not on sale for Draw ${drawNo}. Pick another number.`,
    atMost: (number: string, most: number) => `You already hold ${most} tickets of ${number}, the most for one number.`,
    held: (number: string, held: number, left: number) =>
      `${number} is ready. You hold ${nTickets(held)} of it, so you can buy up to ${left} more.`,
    ready: (number: string, most: number) => `${number} is ready. You can buy up to ${most} tickets of it.`,
    /** The window's number is in "Your numbers" already (n = its tickets there). */
    inList: (number: string, n: number) => `${number} is already in your list (${n}).`,
    inListMost: (number: string, n: number) => `${number} is in your list (${n}), the most for one number.`,
    inListMostHeld: (number: string, n: number, held: number) =>
      `${number} is in your list (${n}). With the ${held} you hold, that is the most for one number.`,
  },

  /**
   * "Add to list" (owner, 19 Oct 2026): under Quick pick / Clear. It names the
   * number it adds; the toast and the spoken line say what the list holds now.
   */
  add: {
    plain: "Add to list",
    number: (number: string) => `Add ${number} to your list`,
    oneMore: (number: string) => `Add 1 more of ${number}`,
    toastNew: (number: string, numbers: number) => `${number} added · ${nNumbers(numbers)}`,
    toastMore: (number: string, inList: number) => `1 more of ${number} · ${inList} in your list`,
    sayNew: (number: string, list: string) => `${spaced(number)} added to your list. ${list} Type the next number.`,
    sayMore: (number: string, inList: number, list: string) =>
      `1 more of ${spaced(number)}, ${nTickets(inList)} of it in your list. ${list} Type the next number.`,
  },

  /** "Your numbers": the list you are building for one purchase (replaces "How many tickets"). */
  list: {
    title: "Your numbers",
    clearAll: "Clear all",
    clearAllA11y: "Clear all numbers from your list",
    count: (numbers: number, tickets: number) => `${nNumbers(numbers)} · ${nTickets(tickets)}`,
    totalLabel: (tickets: number) => `Total · ${nTickets(tickets)}`,
    totalSpoken: (tickets: number, total: string) => `Total, ${nTickets(tickets)}: ${total}.`,
    emptyTitle: "Add your first number",
    emptyText: (most: number, maxNumbers: number) =>
      `Type six digits above and tap Add to list. You can add up to ${maxNumbers} different numbers, up to ${most} tickets each.`,

    /**
     * The undo toast on the page (8 s, like the sheet's). Its Undo is also an
     * action on the "Your numbers" heading, where focus lands after a removal.
     */
    removed: (number: string) => `${number} removed`,
    cleared: (numbers: number) => `${nNumbers(numbers)} cleared`,
    undoOne: (number: string) => `Undo: bring back ${spaced(number)}`,
    undoAll: (numbers: number) => `Undo: bring back ${nNumbers(numbers)}`,

    /**
     * The list's polite line: each quantity change, Remove, Clear all and Undo
     * is read out. The board says "Undo is next." because its toast sits right
     * after the heading in the page; the app's toast floats at the top of the
     * screen (over the page, like every toast), so the line says where it is.
     */
    say: {
      list: (numbers: number, tickets: number, total: string) =>
        `Your list: ${nNumbers(numbers)}, ${nTickets(tickets)}, ${total}.`,
      empty: "Your list is empty.",
      set: (number: string, count: number, line: string, most: boolean, list: string) =>
        `${spaced(number)}: ${nTickets(count)}, ${line}.${most ? " That's the most for this number." : ""} ${list}`,
      removed: (number: string, list: string) => `${spaced(number)} removed. ${list} Undo is at the top of the screen.`,
      cleared: (numbers: number) => `Your list is cleared: ${nNumbers(numbers)} removed. Undo is at the top of the screen.`,
      backOne: (number: string, list: string) => `${spaced(number)} is back. ${list}`,
      backAll: (numbers: number, list: string) => `${nNumbers(numbers)} back in your list. ${list}`,
    },
  },

  /**
   * The ticket you type on (owner, 22 Oct 2026; it replaced the separate
   * "Your ticket · Preview"): the ticket ID, barcode, its code and the QR are
   * only known after buying, so they print as ghosts under this one caption.
   */
  ticket: {
    printedAfter: "Printed after purchase",
  },

  /** The wallet line under the total. */
  wallet: {
    over: (balance: string) => `That is more than your wallet balance of ${balance}. You can deposit before you confirm.`,
    paid: (balance: string) => `Paid from your MyanFlix wallet · balance ${balance}`,
    loading: "Paid from your MyanFlix wallet",
  },

  /**
   * The floating buy bar. It buys the whole list, plus a complete, buyable
   * number still in the window (1 ticket, named: "+ 047319 typed").
   */
  bar: {
    enterSix: "Enter all six digits to buy.",
    offSale: "This number is not on sale.",
    /** Short, so the caption stays one line beside the wallet. */
    atMost: (most: number) => `You hold ${most} of this number.`,
    /** Only a typed number (the one-number flow: type, then Buy). */
    ready: (number: string, drawNo: number) => `Number ${number} · Draw ${drawNo}`,
    none: (drawNo: number) => `No numbers yet · Draw ${drawNo}`,
    gap: (number: string) => `Enter how many tickets for ${number}.`,
    list: (numbers: number, drawNo: number) => `${nNumbers(numbers)} · Draw ${drawNo}`,
    listAndTyped: (numbers: number, number: string, drawNo: number) =>
      `${nNumbers(numbers)} + ${number} typed · Draw ${drawNo}`,
    listAndTypedSpoken: (numbers: number, number: string, tickets: number, drawNo: number) =>
      `${nNumbers(numbers)} in your list, plus ${spaced(number)}, typed and not added yet, ${nTickets(tickets)}. Draw ${drawNo}.`,
    wallet: (balance: string) => `Wallet ${balance}`,
    buyBlocked: "Buy tickets",
    addFirst: "Add a number to buy",
    buy: (count: number, total: string) => `Buy ${nTickets(count)} · ${total}`,
  },

  /** Paused / closed: the card's one action. */
  seeTickets: "See your tickets",

  /** The toast after a purchase. */
  bought: (count: number, drawNo: number) => `${nTickets(count)} bought for Draw ${drawNo}.`,

  /**
   * The Confirm sheet v3 · COMPACT (owner, 16 Oct 2026; Confirm.dc.html and
   * Draw.dc.html's sheet, word for word): one slim row per number, the
   * summary, one full-width Confirm. `*Spoken` / `say` are the screen-reader
   * twins (every six-digit number digit by digit, "·" said as a pause).
   */
  confirm: {
    title: "Confirm your tickets",
    /** The scrim's spoken name (Draw board). */
    closeA11y: "Close and keep choosing",
    close: "Close",
    when: (drawNo: number, shortDate: string) => `Draw ${drawNo} · ${shortDate}`,
    whenSpoken: (drawNo: number, longDate: string) => `Draw ${drawNo}, ${longDate}`,
    yourNumber: "Your number",
    yourNumbers: "Your numbers",

    /** One row: number + caption | − qty + | row total | ×, and the limit line only when it matters. */
    row: {
      typed: "Your number",
      dream: (name: string, dreamNumber: string) => `${name} · dream ${dreamNumber}`,
      spoken: (number: string, dream?: { name: string; number: string }) =>
        `Number ${spaced(number)}${
          dream ? `, from the ${dream.name} dream, dream number ${spaced(dream.number)}` : ", the number you typed"
        }.`,
      /** From Draw's list (multi-number Draw board): which of its numbers this row is. */
      inList: "In your list",
      typedNotInList: "Typed, not in your list",
      spokenInList: (number: string) => `Number ${spaced(number)}, in your list.`,
      spokenTypedNotInList: (number: string) => `Number ${spaced(number)}, the number you typed, not in your list.`,
      /** Draw's own "Your numbers" rows carry no caption. */
      spokenPlain: (number: string) => `Number ${spaced(number)}.`,
      fewer: (number: string) => `Fewer tickets for ${spaced(number)}`,
      more: (number: string) => `More tickets for ${spaced(number)}`,
      quantity: (number: string) => `Number of tickets for ${spaced(number)}`,
      remove: (number: string) => `Remove ${spaced(number)}`,
      lineSpoken: (count: number, price: string, total: string) => `${nTickets(count)} × ${price} = ${total}.`,
      empty: (max: number) => `Enter how many, 1 to ${max}.`,
      most: "That's the most for this number",
      mostHeld: (held: number) => `That's the most for this number · you hold ${held}`,
      held: (held: number, left: number) => `You hold ${held} · up to ${left} more`,
      /** A normal row says its limits to screen readers only. */
      rule: (most: number) => `1 to ${most} for this number`,
      noMore: "More tickets is not possible.",
      least: "1 is the least. To drop this number, use Remove.",
    },

    /** The summary: two lines + the ticket-ID caption. */
    count: (numbers: number, tickets: number) => `${nNumbers(numbers)} · ${nTickets(tickets)}`,
    countSpoken: (numbers: number, tickets: number, total: string) =>
      `${nNumbers(numbers)}, ${nTickets(tickets)}. Total ${total}.`,
    total: "Total",
    wallet: "Wallet",
    after: "After",
    afterSpoken: "Balance after",
    /** The wallet has not answered yet: both figures read "—"; Confirm is not held back for it. */
    walletUnknown: "—",
    walletUnknownSpoken: "Wallet balance not loaded yet.",
    shortBy: "Short by",
    idNote: "Each ticket gets its own ticket ID.",
    depositWith: "Deposit with",
    deposit: (method: string) => `Deposit with ${method}`,
    busy: (count: number) => `Buying your ${nTickets(count)}. Keep this screen open.`,

    /** The footer: the reason line when blocked, one full-width Confirm, a quiet Cancel. */
    go: (count: number, total: string) => `Confirm ${nTickets(count)} · ${total}`,
    retry: (count: number, total: string) => `Try again · ${nTickets(count)} · ${total}`,
    whyGap: (number: string) => `Enter how many tickets for ${number}.`,
    whyGapSpoken: (number: string) => `Enter how many tickets for ${spaced(number)}. Then you can confirm.`,
    whyShort: (amount: string) => `Short by ${amount}`,
    whyShortSpoken: (amount: string, several: boolean) =>
      `Short by ${amount}. Lower ${several ? "a quantity" : "the quantity"} or deposit, then confirm.`,
    cancel: "Cancel",
    chooseNumbers: "Choose numbers",

    /** Every row removed. */
    emptyTitle: "No tickets selected",
    emptyOne: (number: string, canUndo: boolean) =>
      canUndo ? `You removed ${number}. Undo brings it back.` : `You removed ${number}. Choose numbers to pick another one.`,
    emptyAll: (canUndo: boolean, drawNo: number) =>
      canUndo
        ? "You removed every number. Undo brings the last one back."
        : `You removed every number. Choose numbers to buy for Draw ${drawNo}.`,

    /** The undo toast inside the sheet. */
    removed: (number: string) => `${number} removed`,
    undo: "Undo",
    undoSpoken: (number: string) => `Undo: bring back ${spaced(number)}`,

    /** The one polite line: each quantity change, Remove and Undo is read out (the board's aria-live line). */
    say: {
      /** "3 numbers, 4 tickets, total 4,000 Ks." (+ the short sentence). */
      sum: (numbers: number, tickets: number, total: string, short: string | null) =>
        `${nNumbers(numbers)}, ${nTickets(tickets)}, total ${total}.${
          short ? ` Not enough in your wallet: short by ${short}. Lower a quantity or deposit, then confirm.` : ""
        }`,
      /** Several rows (Confirm board). */
      set: (number: string, count: number, line: string, most: boolean, sum: string, covered: string) =>
        `${spaced(number)}: ${nTickets(count)}, ${line}.${most ? " That's the most for this number." : ""} ${sum}${covered}`,
      /** One row (Draw board): its total is the whole total. */
      setOne: (number: string, count: number, total: string, most: boolean, short: string | null, covered: boolean) =>
        `${spaced(number)}: ${nTickets(count)}, total ${total}.${most ? " That's the most for this number." : ""}${
          short
            ? ` Not enough in your wallet: short by ${short}. Lower the quantity or deposit, then confirm.`
            : covered
              ? " Your wallet covers it now. You can confirm."
              : ""
        }`,
      covered: (canConfirm: boolean) => ` Your wallet covers it now.${canConfirm ? " You can confirm." : ""}`,
      empty: (number: string, max: number) => `Enter how many tickets for ${spaced(number)}, 1 to ${max}.`,
      removed: (number: string, rest: string) => `${spaced(number)} removed. ${rest} Undo is just above the buttons.`,
      none: "No tickets selected.",
      back: (number: string, count: number, rest: string) => `${spaced(number)} is back, ${nTickets(count)}. ${rest}`,
      backOne: (number: string, count: number, total: string) =>
        `${spaced(number)} is back, ${nTickets(count)}, total ${total}.`,
    },

    /** The answer was lost or the server failed: nothing is known to be charged, and the same purchase can be sent again. */
    errorTitle: "Your purchase did not go through",
    errorBody: "Check your connection and try again. Sending the same purchase again never charges you twice.",

    /**
     * The server refused the purchase (the plain error line above the
     * buttons). Short wallet and empty boxes keep the sheet's own lines; these
     * are the other reasons.
     */
    refused: {
      closed: (drawNo: number) => `Sales for Draw ${drawNo} have closed. Nothing was charged.`,
      paused: (drawNo: number) => `Sales for Draw ${drawNo} are paused for now. Nothing was charged.`,
      notYet: (drawNo: number) => `Draw ${drawNo} is not on sale yet. Nothing was charged.`,
      /** The key had already paid (the answer was lost) and the basket changed since: that purchase stands, nothing more is charged. */
      alreadyBoughtLost: "This purchase had already gone through. Your tickets are in My tickets.",
      offSale: (numbers: readonly string[]) =>
        `${andList(numbers)} ${numbers.length === 1 ? "is" : "are"} not on sale any more and ${
          numbers.length === 1 ? "was" : "were"
        } taken out of this purchase.`,
      limit: (items: readonly { number: string; held: number; left: number }[]) =>
        `${andList(
          items.map((item) => `${item.number}: you hold ${item.held}, up to ${item.left} more`),
        )}. The quantities were lowered to fit.`,
      limitNone: (numbers: readonly string[]) =>
        `${andList(numbers)}: you already hold the most for one number, so ${
          numbers.length === 1 ? "it was" : "they were"
        } taken out of this purchase.`,
      badNumber: "One of the numbers is not six digits. Remove it and try again.",
      other: (message: string) => message || "The purchase was refused. Try again.",
    },
  },

  /** Printed (the purchase success). */
  printed: {
    kicker: "Purchase complete",
    title: (count: number) => `${nTickets(count)} bought`,
    numberA11y: (number: string, count: number) => `Number ${spaced(number)}, ${nTickets(count)}.`,
    /** Several numbers, read as one line (the board's `pr.numSr`). */
    numbersA11y: (lines: readonly NumberCount[]) =>
      `Numbers: ${lines.map((line) => `${spaced(line.number)}, ${nTickets(line.quantity)}`).join("; ")}.`,
    forDraw: (drawNo: number, date: string) => `For Draw ${drawNo} · ${date}`,
    /** The head over the voucher's number lines: each number on the left, its tickets on the right. */
    cols: { number: "Number", tickets: "Tickets" },
    /** The stub of the purchase voucher (the slip above the tear lists the numbers). */
    voucher: "Purchase voucher",
    voucherNo: (ref: string) => `No. ${ref}`,
    voucherA11y: (ref: string) => `Purchase voucher, number ${ref}`,
    rows: {
      bought: "Bought",
      tickets: "Tickets",
      paid: "Amount paid",
      from: "Paid from",
      wallet: "MyanFlix wallet",
      balanceNow: "Balance now",
    },
    each: (count: number, price: string) => `${count} × ${price}`,
    published: (time: string, date: string) => `The winning number is published after the ${time} draw on ${date}.`,
    seeTickets: "See my tickets",
    buyAnother: "Buy another number",
    loading: "Loading your purchase…",
    missingTitle: "Purchase not found",
    missingText: "This purchase could not be found. Your purchases are in Lottery history.",
    errorTitle: "The purchase did not load",
    errorText: "We could not load this purchase. Check your connection and try again.",
    retry: "Try again",
    missingAction: "Choose a number",
  },
} as const;

const DRAW_COPY_MM: LtWiden<typeof DRAW_COPY_EN> = {
  numberLabel: "သင့်ဂဏန်း 6 လုံး",
  quickPick: "ကျပန်း ရွေးရန်",
  clear: "ရှင်းလင်းရန်",
  clearA11y: "ဂဏန်းကို ရှင်းလင်းရန်",

  help: {
    dropped: "0 မှ 9 အထိ ဂဏန်းများကိုသာ လက်ခံပါသည်။",
    empty: "ဂဏန်း ရိုက်ထည့်ရန် သင့်လက်မှတ်ကို နှိပ်ပါ",
    partial: (count: number) => `ဂဏန်း 6 လုံးအနက် ${count} လုံး`,
    checking: (number: string) => `${number} ကို စစ်ဆေးနေသည်…`,
    listFull: (max: number) =>
      `သင့်စာရင်းတွင် ဂဏန်း ${max} ခု ရှိနေပြီဖြစ်၍ ဝယ်ယူမှုတစ်ကြိမ်အတွက် ကန့်သတ်ချက် ပြည့်ပါပြီ။ နောက်တစ်ခု ထည့်ရန် တစ်ခုကို ဖယ်ရှားပါ။`,
    offSale: (number: string, drawNo: number) => `${number} ကို ပွဲစဉ် ${drawNo} အတွက် မရောင်းပါ။ အခြားဂဏန်း ရွေးပါ။`,
    atMost: (number: string, most: number) =>
      `${number} ကို လက်မှတ် ${most} စောင် ဝယ်ထားပြီးဖြစ်၍ ဂဏန်းတစ်လုံးလျှင် ကန့်သတ်ချက် ပြည့်ပါပြီ။`,
    held: (number: string, held: number, left: number) =>
      `${number} အသင့်ဖြစ်ပါပြီ။ ဤဂဏန်းကို ${nTickets(held)} ဝယ်ထားပြီးဖြစ်၍ နောက်ထပ် ${left} စောင်အထိ ဝယ်နိုင်ပါသည်။`,
    ready: (number: string, most: number) => `${number} အသင့်ဖြစ်ပါပြီ။ ဤဂဏန်းကို လက်မှတ် ${most} စောင်အထိ ဝယ်နိုင်ပါသည်။`,
    inList: (number: string, n: number) => `${number} ကို သင့်စာရင်းထဲ ထည့်ပြီးသား ဖြစ်ပါသည် (${n})။`,
    inListMost: (number: string, n: number) =>
      `${number} ကို သင့်စာရင်းထဲ ထည့်ထားပါသည် (${n})။ ဂဏန်းတစ်လုံးလျှင် ကန့်သတ်ချက် ပြည့်ပါပြီ။`,
    inListMostHeld: (number: string, n: number, held: number) =>
      `${number} ကို သင့်စာရင်းထဲ ထည့်ထားပါသည် (${n})။ ဝယ်ထားပြီး ${held} စောင်နှင့် ပေါင်းလျှင် ဂဏန်းတစ်လုံးအတွက် ကန့်သတ်ချက် ပြည့်ပါပြီ။`,
  },

  add: {
    plain: "စာရင်းထဲ ထည့်ရန်",
    number: (number: string) => `${number} ကို စာရင်းထဲ ထည့်ရန်`,
    oneMore: (number: string) => `${number} ကို 1 စောင် ထပ်ထည့်ရန်`,
    toastNew: (number: string, numbers: number) => `${number} ထည့်ပြီးပါပြီ · ${nNumbersMm(numbers)}`,
    toastMore: (number: string, inList: number) => `${number} နောက်ထပ် 1 စောင် · စာရင်းတွင် ${inList} စောင်`,
    sayNew: (number: string, list: string) =>
      `${spaced(number)} ကို သင့်စာရင်းထဲ ထည့်ပြီးပါပြီ။ ${list} နောက်ဂဏန်းကို ရိုက်ထည့်ပါ။`,
    sayMore: (number: string, inList: number, list: string) =>
      `${spaced(number)} ကို နောက်ထပ် 1 စောင် ထည့်ပြီးပါပြီ။ သင့်စာရင်းတွင် ဤဂဏန်း ${nTickets(inList)} ရှိပါသည်။ ${list} နောက်ဂဏန်းကို ရိုက်ထည့်ပါ။`,
  },

  list: {
    title: "သင့်ဂဏန်းများ",
    clearAll: "အားလုံး ရှင်းလင်းရန်",
    clearAllA11y: "သင့်စာရင်းမှ ဂဏန်းအားလုံး ရှင်းလင်းရန်",
    count: (numbers: number, tickets: number) => `${nNumbersMm(numbers)} · ${nTickets(tickets)}`,
    totalLabel: (tickets: number) => `စုစုပေါင်း · ${nTickets(tickets)}`,
    totalSpoken: (tickets: number, total: string) => `စုစုပေါင်း ${nTickets(tickets)}၊ ${total}။`,
    emptyTitle: "ပထမဆုံး ဂဏန်းကို ထည့်ပါ",
    emptyText: (most: number, maxNumbers: number) =>
      `အပေါ်တွင် ဂဏန်း 6 လုံး ရိုက်ထည့်ပြီး “စာရင်းထဲ ထည့်ရန်” ကို နှိပ်ပါ။ မတူညီသော ဂဏန်း ${maxNumbers} ခုအထိ ထည့်နိုင်ပြီး ဂဏန်းတစ်လုံးလျှင် လက်မှတ် ${most} စောင်အထိ ဝယ်နိုင်ပါသည်။`,

    removed: (number: string) => `${number} ကို ဖယ်ရှားပြီးပါပြီ`,
    cleared: (numbers: number) => `${nNumbersMm(numbers)} ရှင်းလင်းပြီးပါပြီ`,
    undoOne: (number: string) => `နောက်ပြန်ရန်: ${spaced(number)} ကို ပြန်ထည့်ရန်`,
    undoAll: (numbers: number) => `နောက်ပြန်ရန်: ${nNumbersMm(numbers)} ကို ပြန်ထည့်ရန်`,

    say: {
      list: (numbers: number, tickets: number, total: string) =>
        `သင့်စာရင်း: ${nNumbersMm(numbers)}၊ ${nTickets(tickets)}၊ ${total}။`,
      empty: "သင့်စာရင်းတွင် ဂဏန်း မရှိပါ။",
      set: (number: string, count: number, line: string, most: boolean, list: string) =>
        `${spaced(number)}: ${nTickets(count)}၊ ${line}။${most ? " ဤဂဏန်းအတွက် ကန့်သတ်ချက် ပြည့်ပါပြီ။" : ""} ${list}`,
      removed: (number: string, list: string) =>
        `${spaced(number)} ကို ဖယ်ရှားပြီးပါပြီ။ ${list} နောက်ပြန်ရန် ခလုတ်သည် မျက်နှာပြင် အပေါ်ဆုံးတွင် ရှိပါသည်။`,
      cleared: (numbers: number) =>
        `သင့်စာရင်းကို ရှင်းလင်းပြီးပါပြီ၊ ${nNumbersMm(numbers)} ဖယ်ရှားလိုက်ပါသည်။ နောက်ပြန်ရန် ခလုတ်သည် မျက်နှာပြင် အပေါ်ဆုံးတွင် ရှိပါသည်။`,
      backOne: (number: string, list: string) => `${spaced(number)} ကို ပြန်ထည့်ပြီးပါပြီ။ ${list}`,
      backAll: (numbers: number, list: string) => `${nNumbersMm(numbers)} ကို သင့်စာရင်းထဲ ပြန်ထည့်ပြီးပါပြီ။ ${list}`,
    },
  },

  ticket: {
    printedAfter: "ဝယ်ပြီးမှ ပုံနှိပ်မည်",
  },

  wallet: {
    over: (balance: string) =>
      `ဤပမာဏသည် သင့်ပိုက်ဆံအိတ် လက်ကျန်ငွေ ${balance} ထက် များနေပါသည်။ အတည်မပြုမီ ငွေဖြည့်နိုင်ပါသည်။`,
    paid: (balance: string) => `MyanFlix ပိုက်ဆံအိတ်မှ ပေးချေမည် · လက်ကျန်ငွေ ${balance}`,
    loading: "MyanFlix ပိုက်ဆံအိတ်မှ ပေးချေမည်",
  },

  bar: {
    enterSix: "ဝယ်ရန် ဂဏန်း 6 လုံးလုံး ထည့်ပါ။",
    offSale: "ဤဂဏန်းကို မရောင်းပါ။",
    atMost: (most: number) => `ဤဂဏန်းကို ${most} စောင် ဝယ်ထားပြီးပါပြီ။`,
    ready: (number: string, drawNo: number) => `ဂဏန်း ${number} · ပွဲစဉ် ${drawNo}`,
    none: (drawNo: number) => `ဂဏန်း မရှိသေးပါ · ပွဲစဉ် ${drawNo}`,
    gap: (number: string) => `${number} အတွက် လက်မှတ် အရေအတွက် ထည့်ပါ။`,
    list: (numbers: number, drawNo: number) => `${nNumbersMm(numbers)} · ပွဲစဉ် ${drawNo}`,
    listAndTyped: (numbers: number, number: string, drawNo: number) =>
      `${nNumbersMm(numbers)} + ရိုက်ထားသော ${number} · ပွဲစဉ် ${drawNo}`,
    listAndTypedSpoken: (numbers: number, number: string, tickets: number, drawNo: number) =>
      `သင့်စာရင်းတွင် ${nNumbersMm(numbers)}၊ ထို့အပြင် ရိုက်ထားပြီး စာရင်းထဲ မထည့်ရသေးသော ${spaced(number)}၊ ${nTickets(tickets)}။ ပွဲစဉ် ${drawNo}။`,
    wallet: (balance: string) => `ပိုက်ဆံအိတ် ${balance}`,
    buyBlocked: "လက်မှတ် ဝယ်ရန်",
    addFirst: "ဝယ်ရန် ဂဏန်း ထည့်ပါ",
    buy: (count: number, total: string) => `${nTickets(count)} ဝယ်ရန် · ${total}`,
  },

  seeTickets: "သင့်လက်မှတ်များ ကြည့်ရန်",

  bought: (count: number, drawNo: number) => `ပွဲစဉ် ${drawNo} အတွက် ${nTickets(count)} ဝယ်ပြီးပါပြီ။`,

  confirm: {
    // Short: the date line beside it needs the room (the button below says what is confirmed).
    title: "အတည်ပြုရန်",
    closeA11y: "ပိတ်ပြီး ဆက်ရွေးရန်",
    close: "ပိတ်ရန်",
    when: (drawNo: number, shortDate: string) => `ပွဲစဉ် ${drawNo} · ${shortDate}`,
    whenSpoken: (drawNo: number, longDate: string) => `ပွဲစဉ် ${drawNo}၊ ${longDate}`,
    yourNumber: "သင့်ဂဏန်း",
    yourNumbers: "သင့်ဂဏန်းများ",

    row: {
      typed: "သင့်ဂဏန်း",
      dream: (name: string, dreamNumber: string) => `${name} · အိပ်မက် ${dreamNumber}`,
      spoken: (number: string, dream?: { name: string; number: string }) =>
        `ဂဏန်း ${spaced(number)}${
          dream ? `၊ ${dream.name} အိပ်မက်မှ၊ အိပ်မက် ဂဏန်း ${spaced(dream.number)}` : "၊ သင် ရိုက်ထည့်ထားသော ဂဏန်း"
        }။`,
      inList: "သင့်စာရင်းတွင် ပါသည်",
      typedNotInList: "ရိုက်ထား၊ စာရင်းမပါ",
      spokenInList: (number: string) => `ဂဏန်း ${spaced(number)}၊ သင့်စာရင်းတွင် ပါသည်။`,
      spokenTypedNotInList: (number: string) =>
        `ဂဏန်း ${spaced(number)}၊ သင် ရိုက်ထည့်ထားသော ဂဏန်း၊ စာရင်းတွင် မပါပါ။`,
      spokenPlain: (number: string) => `ဂဏန်း ${spaced(number)}။`,
      fewer: (number: string) => `${spaced(number)} အတွက် လက်မှတ် လျှော့ရန်`,
      more: (number: string) => `${spaced(number)} အတွက် လက်မှတ် တိုးရန်`,
      quantity: (number: string) => `${spaced(number)} အတွက် လက်မှတ် အရေအတွက်`,
      remove: (number: string) => `${spaced(number)} ကို ဖယ်ရှားရန်`,
      // Spoken: "×" and "=" are not read well in Burmese, so the line says "per ticket" and "total" in words.
      lineSpoken: (count: number, price: string, total: string) =>
        `${nTickets(count)}၊ တစ်စောင်လျှင် ${price}၊ စုစုပေါင်း ${total}။`,
      empty: (max: number) => `အရေအတွက် 1 မှ ${max} အထိ ထည့်ပါ။`,
      most: "ဤဂဏန်းအတွက် ကန့်သတ်ချက် ပြည့်ပါပြီ",
      mostHeld: (held: number) => `ဤဂဏန်းအတွက် ကန့်သတ်ချက် ပြည့်ပါပြီ · ${held} စောင် ဝယ်ထားပြီး`,
      held: (held: number, left: number) => `${held} စောင် ဝယ်ထားပြီး · နောက်ထပ် ${left} စောင်အထိ`,
      rule: (most: number) => `ဤဂဏန်းအတွက် 1 မှ ${most} စောင်အထိ`,
      noMore: "လက်မှတ် ထပ်တိုး၍ မရပါ။",
      least: "အနည်းဆုံး 1 စောင် ဖြစ်ပါသည်။ ဤဂဏန်းကို ဖယ်လိုပါက “ဖယ်ရှားရန်” ကို နှိပ်ပါ။",
    },

    count: (numbers: number, tickets: number) => `${nNumbersMm(numbers)} · ${nTickets(tickets)}`,
    countSpoken: (numbers: number, tickets: number, total: string) =>
      `${nNumbersMm(numbers)}၊ ${nTickets(tickets)}။ စုစုပေါင်း ${total}။`,
    total: "စုစုပေါင်း",
    wallet: "ပိုက်ဆံအိတ်",
    after: "ဝယ်ပြီး ကျန်ငွေ",
    afterSpoken: "ဝယ်ပြီးနောက် လက်ကျန်ငွေ",
    walletUnknown: "—",
    walletUnknownSpoken: "ပိုက်ဆံအိတ် လက်ကျန်ငွေကို မရယူရသေးပါ။",
    shortBy: "လိုငွေ",
    idNote: "လက်မှတ်တိုင်းတွင် ကိုယ်ပိုင် လက်မှတ် ID ရှိပါမည်။",
    depositWith: "ငွေဖြည့်ရန် နည်းလမ်း",
    deposit: (method: string) => `${method} ဖြင့် ငွေဖြည့်ရန်`,
    busy: (count: number) => `${nTickets(count)} ဝယ်နေပါသည်။ ဤမျက်နှာပြင်ကို မပိတ်ပါနှင့်။`,

    go: (count: number, total: string) => `${nTickets(count)} အတည်ပြုရန် · ${total}`,
    // "N စောင်" without "လက်မှတ်": the block button holds it at full size up to big baskets.
    retry: (count: number, total: string) => `ထပ်ကြိုးစားရန် · ${count} စောင် · ${total}`,
    whyGap: (number: string) => `${number} အတွက် လက်မှတ် အရေအတွက် ထည့်ပါ။`,
    whyGapSpoken: (number: string) =>
      `${spaced(number)} အတွက် လက်မှတ် အရေအတွက် ထည့်ပါ။ ထို့နောက် အတည်ပြုနိုင်ပါသည်။`,
    whyShort: (amount: string) => `လိုငွေ ${amount}`,
    whyShortSpoken: (amount: string, several: boolean) =>
      `${amount} လိုနေပါသည်။ ${several ? "အရေအတွက် တစ်ခုခုကို" : "အရေအတွက်ကို"} လျှော့ပါ သို့မဟုတ် ငွေဖြည့်ပါ၊ ထို့နောက် အတည်ပြုပါ။`,
    cancel: "ပယ်ဖျက်",
    chooseNumbers: "ဂဏန်း ရွေးရန်",

    emptyTitle: "ရွေးထားသော လက်မှတ် မရှိပါ",
    emptyOne: (number: string, canUndo: boolean) =>
      canUndo
        ? `${number} ကို ဖယ်ရှားလိုက်ပါပြီ။ “နောက်ပြန်ရန်” ဖြင့် ပြန်ထည့်နိုင်ပါသည်။`
        : `${number} ကို ဖယ်ရှားလိုက်ပါပြီ။ အခြားဂဏန်း ရွေးရန် “ဂဏန်း ရွေးရန်” ကို နှိပ်ပါ။`,
    emptyAll: (canUndo: boolean, drawNo: number) =>
      canUndo
        ? "ဂဏန်းအားလုံးကို ဖယ်ရှားလိုက်ပါပြီ။ “နောက်ပြန်ရန်” ဖြင့် နောက်ဆုံးဂဏန်းကို ပြန်ထည့်နိုင်ပါသည်။"
        : `ဂဏန်းအားလုံးကို ဖယ်ရှားလိုက်ပါပြီ။ ပွဲစဉ် ${drawNo} အတွက် ဝယ်ရန် “ဂဏန်း ရွေးရန်” ကို နှိပ်ပါ။`,

    removed: (number: string) => `${number} ကို ဖယ်ရှားပြီးပါပြီ`,
    undo: "နောက်ပြန်ရန်",
    undoSpoken: (number: string) => `နောက်ပြန်ရန်: ${spaced(number)} ကို ပြန်ထည့်ရန်`,

    say: {
      sum: (numbers: number, tickets: number, total: string, short: string | null) =>
        `${nNumbersMm(numbers)}၊ ${nTickets(tickets)}၊ စုစုပေါင်း ${total}။${
          short
            ? ` ပိုက်ဆံအိတ်တွင် ငွေ မလုံလောက်ပါ၊ ${short} လိုနေပါသည်။ အရေအတွက် တစ်ခုခုကို လျှော့ပါ သို့မဟုတ် ငွေဖြည့်ပါ၊ ထို့နောက် အတည်ပြုပါ။`
            : ""
        }`,
      set: (number: string, count: number, line: string, most: boolean, sum: string, covered: string) =>
        `${spaced(number)}: ${nTickets(count)}၊ ${line}။${most ? " ဤဂဏန်းအတွက် ကန့်သတ်ချက် ပြည့်ပါပြီ။" : ""} ${sum}${covered}`,
      setOne: (number: string, count: number, total: string, most: boolean, short: string | null, covered: boolean) =>
        `${spaced(number)}: ${nTickets(count)}၊ စုစုပေါင်း ${total}။${most ? " ဤဂဏန်းအတွက် ကန့်သတ်ချက် ပြည့်ပါပြီ။" : ""}${
          short
            ? ` ပိုက်ဆံအိတ်တွင် ငွေ မလုံလောက်ပါ၊ ${short} လိုနေပါသည်။ အရေအတွက်ကို လျှော့ပါ သို့မဟုတ် ငွေဖြည့်ပါ၊ ထို့နောက် အတည်ပြုပါ။`
            : covered
              ? " ယခု ပိုက်ဆံအိတ်ထဲ ငွေ လုံလောက်ပါပြီ။ အတည်ပြုနိုင်ပါသည်။"
              : ""
        }`,
      covered: (canConfirm: boolean) =>
        ` ယခု ပိုက်ဆံအိတ်ထဲ ငွေ လုံလောက်ပါပြီ။${canConfirm ? " အတည်ပြုနိုင်ပါသည်။" : ""}`,
      empty: (number: string, max: number) => `${spaced(number)} အတွက် လက်မှတ် အရေအတွက် 1 မှ ${max} အထိ ထည့်ပါ။`,
      removed: (number: string, rest: string) =>
        `${spaced(number)} ကို ဖယ်ရှားပြီးပါပြီ။ ${rest} နောက်ပြန်ရန် ခလုတ်သည် ခလုတ်များ၏ အပေါ်နားတွင် ရှိပါသည်။`,
      none: "ရွေးထားသော လက်မှတ် မရှိပါ။",
      back: (number: string, count: number, rest: string) =>
        `${spaced(number)} ကို ${nTickets(count)} ဖြင့် ပြန်ထည့်ပြီးပါပြီ။ ${rest}`,
      backOne: (number: string, count: number, total: string) =>
        `${spaced(number)} ကို ${nTickets(count)} ဖြင့် ပြန်ထည့်ပြီးပါပြီ၊ စုစုပေါင်း ${total}။`,
    },

    errorTitle: "သင့်ဝယ်ယူမှု မအောင်မြင်ပါ",
    errorBody:
      "အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်ကြိုးစားကြည့်ပါ။ တူညီသော ဝယ်ယူမှုကို ထပ်ပို့သော်လည်း ငွေ နှစ်ကြိမ် ဖြတ်မည် မဟုတ်ပါ။",

    refused: {
      closed: (drawNo: number) => `ပွဲစဉ် ${drawNo} အတွက် ရောင်းချမှု ပိတ်ပြီးပါပြီ။ ငွေ မဖြတ်ခဲ့ပါ။`,
      paused: (drawNo: number) => `ပွဲစဉ် ${drawNo} အတွက် ရောင်းချမှုကို ယခု ခေတ္တရပ်ထားပါသည်။ ငွေ မဖြတ်ခဲ့ပါ။`,
      notYet: (drawNo: number) => `ပွဲစဉ် ${drawNo} ကို ရောင်းချရန် မဖွင့်ရသေးပါ။ ငွေ မဖြတ်ခဲ့ပါ။`,
      alreadyBoughtLost:
        "ဤဝယ်ယူမှု အောင်မြင်ပြီးသား ဖြစ်ပါသည်။ သင့်လက်မှတ်များကို “ကျွန်ုပ်၏ လက်မှတ်များ” တွင် ကြည့်နိုင်ပါသည်။",
      // Burmese has no is/are or was/were, so the English plural branches fall away; every number is still named.
      offSale: (numbers: readonly string[]) =>
        `${andListMm(numbers)} ကို မရောင်းတော့သဖြင့် ဤဝယ်ယူမှုမှ ဖယ်ထုတ်လိုက်ပါသည်။`,
      limit: (items: readonly { number: string; held: number; left: number }[]) =>
        `${andListMm(
          items.map((item) => `${item.number} (${item.held} စောင် ဝယ်ထားပြီး၊ နောက်ထပ် ${item.left} စောင်အထိ ဝယ်နိုင်)`),
        )}။ ကန့်သတ်ချက်အတွင်း ဝင်စေရန် အရေအတွက်များကို လျှော့ထားပါသည်။`,
      limitNone: (numbers: readonly string[]) =>
        `${andListMm(numbers)}: ဂဏန်းတစ်လုံးလျှင် ကန့်သတ်ချက် ပြည့်အောင် ဝယ်ထားပြီး ဖြစ်သဖြင့် ဤဝယ်ယူမှုမှ ဖယ်ထုတ်လိုက်ပါသည်။`,
      badNumber: "နံပါတ်တစ်ခုသည် ဂဏန်း 6 လုံး မဟုတ်ပါ။ ၎င်းကို ဖယ်ရှားပြီး ထပ်ကြိုးစားကြည့်ပါ။",
      // The server's own message is English: a Burmese reader gets the Burmese line instead.
      other: () => "ဝယ်ယူမှုကို လက်မခံပါ။ ထပ်ကြိုးစားကြည့်ပါ။",
    },
  },

  printed: {
    kicker: "ဝယ်ယူမှု ပြီးဆုံးပါပြီ",
    title: (count: number) => `${nTickets(count)} ဝယ်ပြီးပါပြီ`,
    numberA11y: (number: string, count: number) => `ဂဏန်း ${spaced(number)}၊ ${nTickets(count)}။`,
    numbersA11y: (lines: readonly NumberCount[]) =>
      `ဂဏန်းများ: ${lines.map((line) => `${spaced(line.number)}၊ ${nTickets(line.quantity)}`).join("။ ")}။`,
    forDraw: (drawNo: number, date: string) => `ပွဲစဉ် ${drawNo} အတွက် · ${date}`,
    cols: { number: "ဂဏန်း", tickets: "လက်မှတ်" },
    voucher: "ဝယ်ယူမှု ပြေစာ",
    voucherNo: (ref: string) => `အမှတ် ${ref}`,
    voucherA11y: (ref: string) => `ဝယ်ယူမှု ပြေစာ၊ အမှတ် ${ref}`,
    rows: {
      bought: "ဝယ်ယူချိန်",
      tickets: "လက်မှတ်",
      paid: "ပေးချေသည့် ပမာဏ",
      from: "ပေးချေမှုနည်းလမ်း",
      wallet: "MyanFlix ပိုက်ဆံအိတ်",
      balanceNow: "ယခု လက်ကျန်ငွေ",
    },
    each: (count: number, price: string) => `${count} × ${price}`,
    published: (time: string, date: string) => `ပေါက်ဂဏန်းကို ${date}၊ ${time} ထီဖွင့်ပွဲ ပြီးနောက် ထုတ်ပြန်ပါမည်။`,
    seeTickets: "ကျွန်ုပ်၏ လက်မှတ်များ ကြည့်ရန်",
    buyAnother: "အခြားဂဏန်း ဝယ်ရန်",
    loading: "သင့်ဝယ်ယူမှုကို ဖွင့်နေသည်…",
    missingTitle: "ဝယ်ယူမှု မတွေ့ပါ",
    missingText: "ဤဝယ်ယူမှုကို ရှာမတွေ့ပါ။ သင့်ဝယ်ယူမှုများကို ထီ မှတ်တမ်းတွင် ကြည့်နိုင်ပါသည်။",
    errorTitle: "ဝယ်ယူမှုကို ဖွင့်၍ မရပါ",
    errorText: "ဤဝယ်ယူမှုကို ဖွင့်၍ မရပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်ကြိုးစားကြည့်ပါ။",
    retry: "ထပ်ကြိုးစားကြည့်ရန်",
    missingAction: "ဂဏန်း ရွေးရန်",
  },
};

export const DRAW_COPY = ltCopy(DRAW_COPY_EN, DRAW_COPY_MM);
