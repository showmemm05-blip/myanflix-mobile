import { nTickets, spaced } from "@/lottery/data/format";
import { ltCopy, type LtWiden } from "@/lottery/i18n";

/**
 * Results (Results.dc.html, round 2: the whole prize sheet) — this page's
 * words in English and Burmese, like the shared LT_COPY (src/lottery/i18n.ts).
 * The prize-group names ("1st prize" … "Last 2
 * digits") come from data/prizes.ts; every amount is the API's Ks for that
 * draw (the Thai prize in Baht at the draw's exchange rate).
 */
const RESULTS_COPY_EN = {
  title: "Results",
  sub: "Each draw has nine prize groups, 173 winning numbers in all, published after the draw. Winners request their prize in the app; it is paid into their MyanFlix wallet once the admin confirms.",

  /** The page while the results load, fail, or there are none yet. */
  loading: "Loading the results…",
  errorTitle: "The results did not load",
  errorText: "We could not load the results. Check your connection and try again.",
  retry: "Try again",
  empty: {
    title: "No results yet",
    text: "The first draw's prize results appear here once it is published.",
  },

  latest: {
    kicker: "Latest result",
    /** "Saturday 24 October 2026 · Draw at 2:00 PM" (the time waits for the draw to load). */
    date: (day: string, time: string | undefined) => (time ? `${day} · Draw at ${time}` : day),
    published: (at: string) => `Published ${at}`,
    /** The bold lead of the "your tickets" box: "You have 4 tickets for Draw 23." */
    mineLead: (n: number, drawNo: number) => `You have ${nTickets(n)} for Draw ${drawNo}.`,
    mineRest: " Open them one by one and see what each one won.",
    none: (drawNo: number) => `You had no tickets for Draw ${drawNo}.`,
    mineLoading: "Looking for your tickets…",
    checkMine: "Check my tickets",
  },

  /** The prize sheet inside the latest card (board `lt-pzs`). */
  sheet: {
    title: "Prize results",
    lead: "173 winning numbers in 9 groups. Amounts are per winning ticket. One ticket can win in more than one group, and its prizes add up.",
    /** "Amounts in Ks at 1 Baht = 120 Ks" — the draw's exchange rate (data/format.ts rateLabel). */
    rate: (rate: string) => `Amounts in Ks at ${rate}`,
    perTicket: (what: string) => `Per ticket · ${what}`,
    nNumbers: (n: number) => (n === 1 ? "1 number" : `${n} numbers`),
    /** Next to 1st prize: the 1st prize number one less and one more. */
    nextWhat: "1st prize ±1",
    nextWhatA11y: "the 1st prize number plus or minus 1",
    /** One accessible line per group head: "2nd prize. 2,000,000 Ks per ticket, 5 numbers." */
    headA11y: (name: string, amount: string, what: string) => `${name}. ${amount} per ticket, ${what}.`,
    firstA11y: (number: string) => `1st prize number ${spaced(number)}.`,
    /** "2nd prize numbers: 1 9 4 7 2 6, 3 8 2 0 5 1, …" */
    listA11y: (name: string, numbers: readonly string[]) => `${name} numbers: ${numbers.map(spaced).join(", ")}.`,
    /** 4th / 5th: "4th prize numbers, first 10 of 50: …" (board `pz.g4.label`). */
    gridA11y: (name: string, numbers: readonly string[], total: number, open: boolean) =>
      `${name} numbers, ${open ? `all ${total}` : `first ${numbers.length} of ${total}`}: ${numbers.map(spaced).join(", ")}.`,
    digitKicker: "Digit prizes",
    /** The digits that do not count, drawn as dots (471••• · •••248 · ••••60). */
    dots: (n: number) => "•".repeat(n),
    startsWith: (digits: string) => `Starts with ${spaced(digits)}`,
    endsWith: (digits: string) => `Ends with ${spaced(digits)}`,
    showAll: (n: number) => `Show all ${n}`,
    showFewer: "Show fewer",
  },

  next: {
    kicker: "Next result",
    title: (drawNo: number, time: string, day: string) => `Draw ${drawNo}, after ${time} on ${day}`,
    notDrawn: "Not drawn yet.",
    close: (drawNo: number, time: string) => `Ticket sales for Draw ${drawNo} close at ${time} that day.`,
    hold: (n: number, drawNo: number) => `You hold ${nTickets(n)} for Draw ${drawNo}.`,
    holdNone: (drawNo: number) => `You hold no tickets for Draw ${drawNo} yet.`,
    seeThem: "See them",
    seeThemA11y: "See your tickets",
  },

  check: {
    title: "Check a number",
    sub: "Pick a draw and type a number. We show every prize it wins.",
    drawLabel: "Draw",
    drawA11y: (drawNo: number) => `Draw ${drawNo}`,
    drawGroupA11y: "Draw to check against",
    drawLine: (drawNo: number, day: string, latest: boolean) => `Draw ${drawNo} · ${day}${latest ? " · latest" : ""}`,
    label: "Six-digit number",
    button: "Check number",
    busy: "Checking…",
    clear: "Clear",
    clearA11y: "Clear the number",
    help: {
      empty: "Type any number from 000000 to 999999.",
      partial: (n: number) => `${n} of 6 digits.`,
      ready: (number: string, drawNo: number) => `${number} is ready to check against Draw ${drawNo}.`,
      short: (n: number) => `Type all six digits to check. ${n} of 6 so far.`,
      dropped: "Only the digits 0 to 9 are kept.",
      checking: (drawNo: number) => `Checking all 9 prize groups of Draw ${drawNo}.`,
      checked: (drawNo: number) => `Checked against all 9 prize groups of Draw ${drawNo}.`,
    },
    idleTitle: (drawNo: number) => `Compared with all 9 prize groups of Draw ${drawNo}`,
    idleBody:
      "Six-digit prizes need all six digits; digit prizes need the first 3, the last 3 or the last 2. Leading zeros count: 004219 is not 4219.",
    idleBodyA11y:
      "Six-digit prizes need all six digits; digit prizes need the first 3, the last 3 or the last 2. Leading zeros count: 0 0 4 2 1 9 is not 4 2 1 9.",
    wonTitle: (n: number, drawNo: number) => `Wins ${n === 1 ? "1 prize" : `${n} prizes`} in Draw ${drawNo}`,
    noneTitle: (drawNo: number) => `No prize in Draw ${drawNo}`,
    /** How a prize line matched (board `l.how` / `l.howSr`). */
    allSix: "All six digits",
    allSixA11y: "All six digits match.",
    startsWith: (digits: string) => `Starts with ${digits}`,
    startsWithA11y: (digits: string) => `Starts with ${spaced(digits)}.`,
    endsWith: (digits: string) => `Ends with ${digits}`,
    endsWithA11y: (digits: string) => `Ends with ${spaced(digits)}.`,
    totalTerm: "Total per ticket",
    paidNote: "For each ticket with this number. Winners request the payment from Check my tickets.",
    noneBody: (drawNo: number) => ` matches none of the 9 prize groups of Draw ${drawNo}.`,
    mineOne: (id: string) => `Your ticket ${id} has this number.`,
    mineMany: (ids: readonly string[], together?: string) =>
      `You have ${ids.length} tickets with this number: ${joinAnd(ids)}.${together ? ` Together they win ${together}.` : ""}`,
    checkMine: "Check my tickets",
    seeTicket: "See this ticket",
    /** The one polite announcement per outcome (board `chk.live`). */
    live: {
      checking: (number: string, drawNo: number) => `Checking ${spaced(number)} against Draw ${drawNo}.`,
      /** "0 5 8 3 1 4: won 1st prize, 60,000,000 Ks. Draw 23." */
      won: (number: string, said: readonly string[], total: string | null, drawNo: number) =>
        `${spaced(number)}: won ${said.join("; ")}${total ? `. Total ${total} per ticket` : ""}. Draw ${drawNo}.`,
      none: (number: string, drawNo: number) => `${spaced(number)}: no prize in Draw ${drawNo}.`,
    },
  },

  earlier: {
    title: "Earlier results",
    range: (from: number, to: number) => `Draws ${from} to ${to}`,
    last2: "Last 2 digits",
    rowA11y: (drawNo: number, day: string, first: string, last2: string) =>
      `Draw ${drawNo}, ${day}. 1st prize ${spaced(first)}. Last 2 digits ${spaced(last2)}.`,
    rowHint: "Shows this draw's prize results and your tickets",
    sheetLabel: (drawNo: number) => `Draw ${drawNo} prize results`,
    /** "4th prize · 50 numbers" for the long groups, the plain name otherwise. */
    groupName: (name: string, count: number, big: boolean) => (big ? `${name} · ${count} numbers` : name),
    each: (amount: string) => `${amount} each`,
    /** "4th prize: 0 1 2 …, and 46 more." (board `g.sr`). */
    groupA11y: (name: string, shown: readonly string[], more: number, amount: string) =>
      `${name}, ${amount} each: ${shown.map(spaced).join(", ")}${more > 0 ? `, and ${more} more` : ""}.`,
    digitA11y: (name: string, list: readonly string[], amount: string) =>
      `${name}: ${list.map(spaced).join(" or ")}, ${amount} each.`,
    mine: (drawNo: number) => `Your tickets for Draw ${drawNo}`,
    none: (drawNo: number) => `You had no tickets for Draw ${drawNo}.`,
    mineLoading: "Loading your tickets…",
    mineError: "Your tickets did not load.",
    retry: "Try again",
    /** "4 tickets · 4,000 Ks" (the amount waits for the draw's price). */
    foot: (n: number, amount: string | null) => (amount ? `${nTickets(n)} · ${amount}` : nTickets(n)),
    bought: (at: string) => `Bought ${at}`,
    ticketHint: "Opens the ticket",
  },
} as const;

/**
 * Burmese (glossary: docs/lottery-burmese-2026-11-04/GLOSSARY.md). Counts use
 * one form with a count word: numbers ခု, digits လုံး, tickets စောင်, groups ခု.
 * "each" in the earlier panel is the per-ticket amount (sheet.lead), so it is
 * "တစ်စောင်လျှင်" here.
 */
const RESULTS_COPY_MM: LtWiden<typeof RESULTS_COPY_EN> = {
  title: "ရလဒ်များ",
  sub: "ပွဲစဉ်တိုင်းတွင် ဆုအုပ်စု 9 ခု၊ ပေါက်ဂဏန်း စုစုပေါင်း 173 ခု ရှိပြီး ၎င်းတို့ကို ထီဖွင့်ပွဲ ပြီးနောက် ထုတ်ပြန်ပါသည်။ ပေါက်သူများက အက်ပ်ထဲမှ ဆုငွေ တောင်းခံပါသည်။ စီမံခန့်ခွဲသူ အတည်ပြုသည်နှင့် ဆုငွေကို ၎င်းတို့၏ MyanFlix ပိုက်ဆံအိတ်ထဲ ထည့်ပေးပါသည်။",

  loading: "ရလဒ်များကို ဖွင့်နေသည်…",
  errorTitle: "ရလဒ်များကို ဖွင့်၍ မရပါ",
  errorText: "ရလဒ်များကို ဖွင့်၍ မရပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်ကြိုးစားကြည့်ပါ။",
  retry: "ထပ်ကြိုးစားကြည့်ရန်",
  empty: {
    title: "ရလဒ် မထွက်သေးပါ",
    text: "ပထမဆုံး ပွဲစဉ်၏ ဆုရလဒ်များကို ထုတ်ပြန်ပြီးသည်နှင့် ဤနေရာတွင် ပေါ်လာပါမည်။",
  },

  latest: {
    kicker: "နောက်ဆုံး ရလဒ်",
    date: (day: string, time: string | undefined) => (time ? `${day} · ထီဖွင့်ချိန် ${time}` : day),
    published: (at: string) => `ရလဒ် ထွက်ချိန် ${at}`,
    mineLead: (n: number, drawNo: number) => `သင့်တွင် ပွဲစဉ် ${drawNo} အတွက် ${nTickets(n)} ရှိပါသည်။`,
    mineRest: " တစ်စောင်ချင်း ဖွင့်ပြီး ဆု ပေါက်မပေါက် ကြည့်ပါ။",
    none: (drawNo: number) => `ပွဲစဉ် ${drawNo} အတွက် သင့်တွင် လက်မှတ် မရှိခဲ့ပါ။`,
    mineLoading: "သင့်လက်မှတ်များကို ရှာနေသည်…",
    checkMine: "ကျွန်ုပ်၏ လက်မှတ်များ စစ်ရန်",
  },

  sheet: {
    title: "ဆုရလဒ်များ",
    lead: "ဆုအုပ်စု 9 ခုတွင် ပေါက်ဂဏန်း 173 ခု ရှိပါသည်။ ဆုငွေ ပမာဏများသည် ပေါက်သော လက်မှတ် တစ်စောင်စီအတွက် ဖြစ်ပါသည်။ လက်မှတ် တစ်စောင်သည် ဆုအုပ်စု တစ်ခုထက်ပို၍ ပေါက်နိုင်ပြီး ထိုဆုငွေများကို ပေါင်းရပါသည်။",
    rate: (rate: string) => `ငွေလဲနှုန်း ${rate} ဖြင့် တွက်ထားသော Ks ပမာဏများ`,
    perTicket: (what: string) => `လက်မှတ် တစ်စောင်လျှင် · ${what}`,
    nNumbers: (n: number) => `ဂဏန်း ${n} ခု`,
    nextWhat: "ပထမဆု ±1",
    nextWhatA11y: "ပထမဆု ဂဏန်းထက် 1 ငယ်သည့် ဂဏန်းနှင့် 1 ကြီးသည့် ဂဏန်း",
    headA11y: (name: string, amount: string, what: string) => `${name}။ လက်မှတ် တစ်စောင်လျှင် ${amount}၊ ${what}။`,
    firstA11y: (number: string) => `ပထမဆု ဂဏန်း ${spaced(number)}။`,
    listA11y: (name: string, numbers: readonly string[]) => `${name} ဂဏန်းများ: ${numbers.map(spaced).join("၊ ")}။`,
    gridA11y: (name: string, numbers: readonly string[], total: number, open: boolean) =>
      `${name} ဂဏန်းများ၊ ${open ? `${total} ခုလုံး` : `${total} ခုအနက် ပထမ ${numbers.length} ခု`}: ${numbers.map(spaced).join("၊ ")}။`,
    digitKicker: "ရှေ့နှင့် နောက် ဂဏန်း ဆုများ",
    dots: (n: number) => "•".repeat(n),
    startsWith: (digits: string) => `${spaced(digits)} ဖြင့် စသည်`,
    endsWith: (digits: string) => `${spaced(digits)} ဖြင့် ဆုံးသည်`,
    showAll: (n: number) => `အားလုံး ${n} ခု ပြရန်`,
    showFewer: "လျှော့ပြရန်",
  },

  next: {
    kicker: "နောက်ထွက်မည့် ရလဒ်",
    title: (drawNo: number, time: string, day: string) => `ပွဲစဉ် ${drawNo}၊ ${day} ${time} နောက်ပိုင်း`,
    notDrawn: "ထီ မဖွင့်ရသေးပါ။",
    close: (drawNo: number, time: string) => `ပွဲစဉ် ${drawNo} အတွက် လက်မှတ် ရောင်းချမှုကို ထိုနေ့ ${time} တွင် ပိတ်ပါမည်။`,
    hold: (n: number, drawNo: number) => `သင့်တွင် ပွဲစဉ် ${drawNo} အတွက် ${nTickets(n)} ရှိပါသည်။`,
    holdNone: (drawNo: number) => `သင့်တွင် ပွဲစဉ် ${drawNo} အတွက် လက်မှတ် မရှိသေးပါ။`,
    seeThem: "ကြည့်ရန်",
    seeThemA11y: "သင့်လက်မှတ်များကို ကြည့်ရန်",
  },

  check: {
    title: "ဂဏန်း စစ်ရန်",
    sub: "ပွဲစဉ် ရွေးပြီး ဂဏန်း ရိုက်ထည့်ပါ။ ထိုဂဏန်း ပေါက်သော ဆုအားလုံးကို ပြပေးပါမည်။",
    drawLabel: "ပွဲစဉ်",
    drawA11y: (drawNo: number) => `ပွဲစဉ် ${drawNo}`,
    drawGroupA11y: "စစ်မည့် ပွဲစဉ်",
    drawLine: (drawNo: number, day: string, latest: boolean) => `ပွဲစဉ် ${drawNo} · ${day}${latest ? " · နောက်ဆုံး" : ""}`,
    label: "ဂဏန်း 6 လုံး",
    button: "ဂဏန်း စစ်ရန်",
    busy: "စစ်နေသည်…",
    clear: "ရှင်းလင်းရန်",
    clearA11y: "ဂဏန်းကို ရှင်းလင်းရန်",
    help: {
      empty: "000000 မှ 999999 အတွင်း မည်သည့်ဂဏန်းမဆို ရိုက်ထည့်ပါ။",
      partial: (n: number) => `ဂဏန်း 6 လုံးအနက် ${n} လုံး။`,
      ready: (number: string, drawNo: number) => `${number} ကို ပွဲစဉ် ${drawNo} နှင့် စစ်ရန် အသင့်ဖြစ်ပါပြီ။`,
      short: (n: number) => `စစ်ရန် ဂဏန်း 6 လုံးလုံး ရိုက်ထည့်ပါ။ ယခုအထိ 6 လုံးအနက် ${n} လုံး။`,
      dropped: "0 မှ 9 အထိ ဂဏန်းများကိုသာ လက်ခံပါသည်။",
      checking: (drawNo: number) => `ပွဲစဉ် ${drawNo} ၏ ဆုအုပ်စု 9 ခုလုံးကို စစ်နေသည်။`,
      checked: (drawNo: number) => `ပွဲစဉ် ${drawNo} ၏ ဆုအုပ်စု 9 ခုလုံးနှင့် စစ်ပြီးပါပြီ။`,
    },
    idleTitle: (drawNo: number) => `ပွဲစဉ် ${drawNo} ၏ ဆုအုပ်စု 9 ခုလုံးနှင့် တိုက်စစ်ပါမည်`,
    idleBody:
      "ဂဏန်း 6 လုံး ဆုများအတွက် 6 လုံးလုံး ကိုက်ရပါမည်။ ရှေ့နှင့် နောက် ဂဏန်း ဆုများအတွက် ရှေ့ 3 လုံး၊ နောက် 3 လုံး သို့မဟုတ် နောက် 2 လုံး ကိုက်ရပါမည်။ ရှေ့က သုညများကိုလည်း ထည့်တွက်ပါသည်။ 004219 နှင့် 4219 မတူပါ။",
    idleBodyA11y:
      "ဂဏန်း 6 လုံး ဆုများအတွက် 6 လုံးလုံး ကိုက်ရပါမည်။ ရှေ့နှင့် နောက် ဂဏန်း ဆုများအတွက် ရှေ့ 3 လုံး၊ နောက် 3 လုံး သို့မဟုတ် နောက် 2 လုံး ကိုက်ရပါမည်။ ရှေ့က သုညများကိုလည်း ထည့်တွက်ပါသည်။ 0 0 4 2 1 9 နှင့် 4 2 1 9 မတူပါ။",
    wonTitle: (n: number, drawNo: number) => `ပွဲစဉ် ${drawNo} တွင် ဆု ${n} ခု ပေါက်သည်`,
    noneTitle: (drawNo: number) => `ပွဲစဉ် ${drawNo} တွင် ဆု မပေါက်ပါ`,
    allSix: "ဂဏန်း 6 လုံးလုံး",
    allSixA11y: "ဂဏန်း 6 လုံးလုံး ကိုက်ညီပါသည်။",
    startsWith: (digits: string) => `${digits} ဖြင့် စသည်`,
    startsWithA11y: (digits: string) => `${spaced(digits)} ဖြင့် စသည်။`,
    endsWith: (digits: string) => `${digits} ဖြင့် ဆုံးသည်`,
    endsWithA11y: (digits: string) => `${spaced(digits)} ဖြင့် ဆုံးသည်။`,
    totalTerm: "လက်မှတ် တစ်စောင်လျှင် စုစုပေါင်း",
    paidNote: "ဤဂဏန်းပါသော လက်မှတ် တစ်စောင်စီအတွက် ဖြစ်ပါသည်။ ပေါက်သူများက “ကျွန်ုပ်၏ လက်မှတ်များ စစ်ရန်” မှ ဆုငွေ တောင်းခံနိုင်ပါသည်။",
    noneBody: (drawNo: number) => ` သည် ပွဲစဉ် ${drawNo} ၏ ဆုအုပ်စု 9 ခုထဲမှ မည်သည့်အုပ်စုနှင့်မျှ မကိုက်ညီပါ။`,
    mineOne: (id: string) => `သင့်လက်မှတ် ${id} တွင် ဤဂဏန်း ပါဝင်ပါသည်။`,
    mineMany: (ids: readonly string[], together?: string) =>
      `သင့်တွင် ဤဂဏန်းပါသော လက်မှတ် ${ids.length} စောင် (${joinAndMm(ids)}) ရှိပါသည်။${together ? ` လက်မှတ်အားလုံး ပေါင်း ${together} ပေါက်ပါသည်။` : ""}`,
    checkMine: "ကျွန်ုပ်၏ လက်မှတ်များ စစ်ရန်",
    seeTicket: "ဤလက်မှတ်ကို ကြည့်ရန်",
    live: {
      checking: (number: string, drawNo: number) => `${spaced(number)} ကို ပွဲစဉ် ${drawNo} နှင့် စစ်နေသည်။`,
      won: (number: string, said: readonly string[], total: string | null, drawNo: number) =>
        `${spaced(number)}: ${said.join("၊ ")} ပေါက်ပါသည်${total ? `။ လက်မှတ် တစ်စောင်လျှင် စုစုပေါင်း ${total}` : ""}။ ပွဲစဉ် ${drawNo}။`,
      none: (number: string, drawNo: number) => `${spaced(number)}: ပွဲစဉ် ${drawNo} တွင် ဆု မပေါက်ပါ။`,
    },
  },

  earlier: {
    title: "ယခင် ရလဒ်များ",
    range: (from: number, to: number) => `ပွဲစဉ် ${from} မှ ${to} အထိ`,
    last2: "နောက် 2 လုံး",
    rowA11y: (drawNo: number, day: string, first: string, last2: string) =>
      `ပွဲစဉ် ${drawNo}၊ ${day}။ ပထမဆု ${spaced(first)}။ နောက် 2 လုံး ${spaced(last2)}။`,
    rowHint: "ဤပွဲစဉ်၏ ဆုရလဒ်များနှင့် သင့်လက်မှတ်များကို ပြပါမည်",
    sheetLabel: (drawNo: number) => `ပွဲစဉ် ${drawNo} ၏ ဆုရလဒ်များ`,
    groupName: (name: string, count: number, big: boolean) => (big ? `${name} · ဂဏန်း ${count} ခု` : name),
    each: (amount: string) => `တစ်စောင်လျှင် ${amount}`,
    groupA11y: (name: string, shown: readonly string[], more: number, amount: string) =>
      `${name}၊ တစ်စောင်လျှင် ${amount}: ${shown.map(spaced).join("၊ ")}${more > 0 ? ` နှင့် နောက်ထပ် ${more} ခု` : ""}။`,
    digitA11y: (name: string, list: readonly string[], amount: string) =>
      `${name}: ${list.map(spaced).join(" သို့မဟုတ် ")}၊ တစ်စောင်လျှင် ${amount}။`,
    mine: (drawNo: number) => `ပွဲစဉ် ${drawNo} အတွက် သင့်လက်မှတ်များ`,
    none: (drawNo: number) => `ပွဲစဉ် ${drawNo} အတွက် သင့်တွင် လက်မှတ် မရှိခဲ့ပါ။`,
    mineLoading: "သင့်လက်မှတ်များကို ဖွင့်နေသည်…",
    mineError: "သင့်လက်မှတ်များကို ဖွင့်၍ မရပါ။",
    retry: "ထပ်ကြိုးစားကြည့်ရန်",
    foot: (n: number, amount: string | null) => (amount ? `${nTickets(n)} · ${amount}` : nTickets(n)),
    bought: (at: string) => `ဝယ်ယူချိန် ${at}`,
    ticketHint: "လက်မှတ်ကို ဖွင့်ပါမည်",
  },
};

export const RESULTS_COPY = ltCopy(RESULTS_COPY_EN, RESULTS_COPY_MM);

/** "A and B", "A, B and C". */
function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Burmese "A နှင့် B", "A၊ B နှင့် C" (RESULTS_COPY_MM only). */
function joinAndMm(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join("၊ ")} နှင့် ${items[items.length - 1]}`;
}

/** Every six-digit run in a line, spaced for a screen reader ("058314 is ready" → "0 5 8 3 1 4 is ready"). */
export function speakNumbers(text: string): string {
  return text.replace(/\b\d{6}\b/g, (run) => spaced(run));
}
