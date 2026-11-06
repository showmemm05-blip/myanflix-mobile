/**
 * The Lottery's SHARED English copy: the shell, the dock, pills, sheets, the
 * footer and the toasts. Screen groups keep their own words in their own
 * `screens/<area>/copy.ts`.
 *
 * English and Burmese (owner, 4 Nov 2026): `LT_COPY_EN` and its Burmese twin
 * `LT_COPY_MM`, wrapped by `ltCopy` so every read follows the app's language
 * (src/lottery/i18n.ts; terms in docs/lottery-burmese-2026-11-04/GLOSSARY.md).
 * Copy rules (spec §0.7): sentence case, "1,000 Ks", no "!",
 * never "lucky", "win big", "official" or "government"; KBZPay and WavePay are
 * the only ways to add money.
 */

import { ltCopy, type LtWiden } from "@/lottery/i18n";

/** "2 days", "1 hour", "15 minutes". */
function nUnits(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

const LT_COPY_EN = {
  /** The top bar. */
  balanceA11y: (amount: string) => `Wallet balance ${amount}`,
  balanceLoadingA11y: "Wallet balance, loading",
  /**
   * The emblem chip at the top bar's left and its "Leave the lottery?" sheet
   * (owner, 23 Oct 2026: the bare back arrow was tapped by accident, so
   * leaving is a choice). "Lucky draw" is the hub's own game name
   * (t.lottery.luckyDraw), not a promise.
   */
  leave: {
    chip: "MyanFlix",
    chipA11y: "MyanFlix, leave the lottery",
    chipHint: "Shows where you can go",
    title: "Leave the lottery?",
    games: "Lottery games",
    gamesSub: "2D · 3D · Lucky draw and Thai lottery",
    myanflix: "Back to MyanFlix",
    myanflixSub: "Movies, series and books",
    wallet: "Wallet",
    walletSub: "Your balance, deposit and withdraw",
    stay: "Stay here",
    closeA11y: "Close and stay here",
  },

  /** The dock. */
  dockA11y: "Lottery",
  tabs: {
    LotteryHomeTab: "Home",
    LotteryDrawTab: "Draw",
    LotteryResultsTab: "Results",
    LotteryTicketsTab: "Tickets",
    LotteryHistoryTab: "History",
  },

  /** Status pills (icon + word, never colour alone). */
  pills: {
    scheduled: "Opens soon",
    open: "Open for sale",
    paused: "Sales paused",
    closed: "Sales closed",
    published: "Result published",
    waiting: "Waiting for draw",
    won: "Won",
    notwon: "Not won",
    paid: "Paid",
    failed: "Not completed",
    /** A won ticket's prize payment (PrizeClaim board, 24 Oct 2026): the second chip beside Won. */
    requestPayment: "Request payment",
    requested: "Requested",
    rejected: "Rejected",
    expired: "Expired",
  },

  /** The countdown. */
  countdownLabel: "Sales close in",
  countdownA11y: (d: number, h: number, m: number) =>
    `Sales close in ${nUnits(d, "day")}, ${nUnits(h, "hour")} and ${nUnits(m, "minute")}`,

  /** The one draw card. */
  draw: {
    kicker: "Current draw",
    facts: { price: "per ticket", most: "Up to", perNumber: "per number" },
    pausedNote: "Sales are paused for now. Tickets you already hold are safe.",
    closedNote: (closeTime: string, drawTime: string) =>
      `Sales closed at ${closeTime}. The winning number is published after the ${drawTime} draw.`,
    scheduledNote: (drawNo: number) => `Draw ${drawNo} is not on sale yet. Check back soon.`,
    /** The page while the current draw loads, fails, or has not been set up. */
    loading: "Loading the draw…",
    errorTitle: "The draw did not load",
    errorText: "We could not load the current draw. Check your connection and try again.",
    retry: "Try again",
    noneTitle: "No draw yet",
    noneText: "The next draw has not been set up. Check back soon.",
  },

  /** The only two ways to add money. */
  pay: { kbz: "KBZPay", wave: "WavePay" },

  /** The footer. */
  footer: {
    play: "Play for fun and only spend what you can afford.",
    /** Every page: what is real (everything since phase 3; prizes by request since 24 Oct 2026). */
    live: "Draws, tickets, results and prizes are real · Prizes are paid into your wallet after you request them",
  },

  /** Anything the Lottery does not open yet (a prize claim's "Contact support"). */
  previewOnly: "Not available from the Lottery yet.",

  close: "Close",
  processing: "Processing…",
} as const;

const LT_COPY_MM: LtWiden<typeof LT_COPY_EN> = {
  balanceA11y: (amount: string) => `ပိုက်ဆံအိတ် လက်ကျန်ငွေ ${amount}`,
  balanceLoadingA11y: "ပိုက်ဆံအိတ် လက်ကျန်ငွေ၊ ဖွင့်နေသည်",
  leave: {
    chip: "MyanFlix",
    chipA11y: "MyanFlix၊ ထီမှ ထွက်ရန်",
    chipHint: "သွားနိုင်သော နေရာများကို ပြပါမည်",
    title: "ထီမှ ထွက်မည်လား?",
    games: "ထီ ဂိမ်းများ",
    gamesSub: "2D · 3D · ကံစမ်းမဲနှင့် ထိုင်းထီ",
    myanflix: "MyanFlix သို့ ပြန်သွားရန်",
    myanflixSub: "ရုပ်ရှင်၊ ဇာတ်လမ်းတွဲနှင့် စာအုပ်များ",
    wallet: "ပိုက်ဆံအိတ်",
    walletSub: "သင့်လက်ကျန်ငွေ၊ ငွေဖြည့်ခြင်းနှင့် ငွေထုတ်ခြင်း",
    stay: "ဤနေရာတွင် ဆက်နေရန်",
    closeA11y: "ပိတ်ပြီး ဤနေရာတွင် ဆက်နေရန်",
  },

  dockA11y: "ထီ",
  tabs: {
    LotteryHomeTab: "ပင်မ",
    LotteryDrawTab: "ထီထိုးရန်",
    LotteryResultsTab: "ရလဒ်များ",
    LotteryTicketsTab: "လက်မှတ်များ",
    LotteryHistoryTab: "မှတ်တမ်း",
  },

  pills: {
    scheduled: "မကြာမီ ဖွင့်မည်",
    open: "ရောင်းချနေသည်",
    paused: "ရောင်းချမှု ခေတ္တရပ်ထား",
    closed: "ရောင်းချမှု ပိတ်ပြီ",
    published: "ရလဒ် ထွက်ပြီ",
    waiting: "ထီဖွင့်ပွဲ စောင့်ဆဲ",
    won: "ပေါက်သည်",
    notwon: "မပေါက်ပါ",
    /** Also a purchase's "Paid" (history), so "paid" without saying who paid whom. */
    paid: "ပေးချေပြီး",
    failed: "မပြီးဆုံးပါ",
    requestPayment: "ဆုငွေ တောင်းခံရန်",
    requested: "တောင်းခံပြီး",
    rejected: "ငြင်းပယ်ခံရသည်",
    expired: "သက်တမ်းကုန်",
  },

  countdownLabel: "ရောင်းချမှု ပိတ်ရန် ကျန်ချိန်",
  countdownA11y: (d: number, h: number, m: number) =>
    `ရောင်းချမှု ပိတ်ရန် ${d} ရက်၊ ${h} နာရီနှင့် ${m} မိနစ် ကျန်ပါသည်`,

  draw: {
    kicker: "လက်ရှိ ပွဲစဉ်",
    /**
     * DrawCard joins these as "{amount} Ks {price} · {most} {max} {perNumber}", so
     * the Burmese reads "1,000 Ks တစ်စောင်လျှင် · ဂဏန်းတစ်လုံးလျှင် အများဆုံး 5 စောင်":
     * "per number" moves into `most` and `perNumber` holds the count word.
     */
    facts: { price: "တစ်စောင်လျှင်", most: "ဂဏန်းတစ်လုံးလျှင် အများဆုံး", perNumber: "စောင်" },
    pausedNote: "ရောင်းချမှုကို ယခု ခေတ္တရပ်ထားပါသည်။ သင့်တွင် ရှိပြီးသော လက်မှတ်များကို မထိခိုက်ပါ။",
    closedNote: (closeTime: string, drawTime: string) =>
      `ရောင်းချမှုကို ${closeTime} တွင် ပိတ်ပြီးပါပြီ။ ${drawTime} ထီဖွင့်ပွဲ ပြီးနောက် ပေါက်ဂဏန်းကို ထုတ်ပြန်ပါမည်။`,
    scheduledNote: (drawNo: number) => `ပွဲစဉ် ${drawNo} ကို ရောင်းချရန် မဖွင့်ရသေးပါ။ မကြာမီ ပြန်ကြည့်ပါ။`,
    loading: "ပွဲစဉ်ကို ရယူနေသည်…",
    errorTitle: "ပွဲစဉ်ကို ရယူ၍ မရပါ",
    errorText: "လက်ရှိ ပွဲစဉ်ကို ရယူ၍ မရပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်ကြိုးစားကြည့်ပါ။",
    retry: "ထပ်ကြိုးစားကြည့်ရန်",
    noneTitle: "ပွဲစဉ် မရှိသေးပါ",
    noneText: "နောက်ပွဲစဉ်ကို မသတ်မှတ်ရသေးပါ။ မကြာမီ ပြန်ကြည့်ပါ။",
  },

  pay: { kbz: "KBZPay", wave: "WavePay" },

  footer: {
    play: "အပျော်သဘောဖြင့် ကစားပြီး တတ်နိုင်သလောက်သာ သုံးစွဲပါ။",
    live: "ပွဲစဉ်၊ လက်မှတ်၊ ရလဒ်နှင့် ဆုငွေများ အစစ်အမှန် ဖြစ်ပါသည် · ဆုငွေကို သင် တောင်းခံပြီးနောက် သင့်ပိုက်ဆံအိတ်ထဲ ထည့်ပေးပါမည်",
  },

  previewOnly: "ထီကဏ္ဍမှ မသုံးနိုင်သေးပါ။",

  close: "ပိတ်ရန်",
  processing: "ဆောင်ရွက်နေသည်…",
};

export const LT_COPY = ltCopy(LT_COPY_EN, LT_COPY_MM);
