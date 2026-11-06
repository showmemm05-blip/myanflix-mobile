import type { StatusKind } from "@/lottery/components/Pills";
import { LT_COPY } from "@/lottery/copy";
import {
  dateAtTime,
  dateDMY,
  dateShort,
  dateTimeShort,
  daysBetween,
  ks,
  myanmarDateIso,
  nTickets,
  spaced,
} from "@/lottery/data/format";
import type { ClaimRefusal } from "@/lottery/hooks/useClaims";
import { ltCopy, ltLanguage, type LtWiden } from "@/lottery/i18n";
import type { LotteryClaimRejectReason, LotteryDrawClaim, LotteryTicketClaimStatus } from "@/types/lottery";

/**
 * PRIZE PAYMENT BY REQUEST (PrizeClaim.dc.html, owner 24 Oct 2026) — the
 * words of the shared claim block, the "Request payment" sheet and the chip
 * on a won ticket row. A shared component's copy lives beside it, like
 * TicketPile's (the screens' copy.ts files keep only their own lines).
 * English and Burmese, like the rest of the Lottery (src/lottery/i18n.ts).
 * Copy rules (spec §0.7): sentence case, "1,000 Ks", no "!".
 *
 * Every state carries ONE headline (`h`), the summary's sentence (`p`, under
 * Check my tickets' "You won"), the ticket card's sentence (`p2`, under one
 * ticket's prize), the right-hand time line (`when`) and the foot line
 * (`foot`) — the board's `C[claim]` object, with the sample's figures
 * replaced by the API's.
 */

/** The second chip on a won row, from the ticket's `claimStatus`. */
export function claimChipKind(status: LotteryTicketClaimStatus): StatusKind {
  switch (status) {
    case "not_requested":
      return "requestPayment";
    case "requested":
      return "requested";
    case "paid":
      return "paid";
    case "rejected":
      return "rejected";
    case "expired":
      return "expired";
  }
}

/** The chip's word (what a screen reader says after "Won"). */
export function claimChipWord(status: LotteryTicketClaimStatus): string {
  return LT_COPY.pills[claimChipKind(status)];
}

/** The admin's preset reasons as the customer reads them, with a sentence for when the admin wrote no note. */
const REASON: Record<LotteryClaimRejectReason, { title: string; fallback: string }> = {
  suspicious_account: {
    title: "Suspicious account",
    fallback: "The admin could not confirm this account. Contact support to sort it out.",
  },
  duplicate_request: {
    title: "Duplicate request",
    fallback: "This prize was already requested or paid.",
  },
  ticket_under_review: {
    title: "Ticket under review",
    fallback: "The admin is checking this ticket before paying.",
  },
  other: { title: "Other reason", fallback: "" },
};

/** REASON in Burmese (used only by claimWordsMm); the titles are the admin's own Burmese reason names. */
const REASON_MM: Record<LotteryClaimRejectReason, { title: string; fallback: string }> = {
  suspicious_account: {
    title: "သံသယဖြစ်ဖွယ် အကောင့်",
    fallback: "စီမံခန့်ခွဲသူက ဤအကောင့်ကို အတည်မပြုနိုင်ခဲ့ပါ။ ဖြေရှင်းရန် အကူအညီဌာနကို ဆက်သွယ်ပါ။",
  },
  duplicate_request: {
    title: "ထပ်နေသော တောင်းခံမှု",
    fallback: "ဤဆုငွေကို တောင်းခံပြီး သို့မဟုတ် ပေးပြီး ဖြစ်ပါသည်။",
  },
  ticket_under_review: {
    title: "လက်မှတ် စစ်ဆေးဆဲ",
    fallback: "ငွေမပေးမီ စီမံခန့်ခွဲသူက ဤလက်မှတ်ကို စစ်ဆေးနေပါသည်။",
  },
  other: { title: "အခြား အကြောင်းပြချက်", fallback: "" },
};

export interface ClaimWords {
  /** The status row's chip. */
  pill: StatusKind;
  /** The right-hand time or deadline line ("Sent 24 Oct, 10:12 AM"); "" when the server gave no instant. */
  when: string;
  h: string;
  /** Under the summary's total. */
  p: string;
  /** Under one ticket's prize (whole-draw claim: names the other tickets when the claim covers more than this one). */
  p2: string;
  /** The rejected reason box; null in every other state. */
  reason: { title: string; text: string } | null;
  foot: string;
}

/** What the words need beside the claim view itself. */
export interface ClaimWordsInput {
  claim: LotteryDrawClaim;
  /** ISO — when the results were published; with it the deadline lines say "90 days after …". */
  publishedAt?: string | null;
  /** Ticket view: the ticket under the block ("Paid with your 2 other winning tickets" when the claim covers more). */
  ticketNo?: string;
  /** The live wallet, for "Your balance is now …" once paid. */
  balance?: number | null;
}

/** The board's words for one claim state, with the API's figures — in the Lottery's current language. */
export function claimWords(input: ClaimWordsInput): ClaimWords {
  return ltLanguage() === "mm" ? claimWordsMm(input) : claimWordsEn(input);
}

/** The board's words for one claim state, with the API's figures. */
function claimWordsEn({ claim, publishedAt, ticketNo, balance }: ClaimWordsInput): ClaimWords {
  const total = ks(claim.prizeKs);
  const n = claim.wonTickets;
  const draw = `Draw ${claim.drawNo}`;
  const deadline = claim.claimDeadlineAt;
  const deadlineDay = deadline ? dateDMY(deadline) : "";
  const deadlineLong = deadline ? dateShort(myanmarDateIso(deadline)) : "";
  const days = deadline && publishedAt ? daysAfter(publishedAt, deadline) : null;
  const afterPublish = days ? `, ${days} days after the results were published` : "";
  const sent = claim.requestedAt ? dateTimeShort(claim.requestedAt) : "";
  const decided = claim.decidedAt ? dateTimeShort(claim.decidedAt) : "";
  const decidedLong = claim.decidedAt ? dateAtTime(claim.decidedAt) : "";
  // The ticket card: does the claim cover other tickets than the one on screen?
  const others = ticketNo ? Math.max(0, n - 1) : 0;
  const many = n > 1;

  switch (claim.status) {
    case "requested":
      return {
        pill: "requested",
        when: sent ? `Sent ${sent}` : "",
        h: "Waiting for confirmation",
        p: `The admin is checking your request. Once confirmed, ${total} is paid into your MyanFlix wallet, usually within 24 hours. Nothing more to do.`,
        p2: others
          ? `This ticket is in your ${draw} request of ${total} (${nTickets(n)})${sent ? `, sent ${sent}` : ""}. Once the admin confirms, it is paid into your MyanFlix wallet.`
          : `Your ${draw} request of ${total}${sent ? ` was sent ${sent}` : " is with the admin"}. Once the admin confirms, it is paid into your MyanFlix wallet.`,
        reason: null,
        foot: "We will show the payment here and in your wallet.",
      };
    case "paid": {
      const paid = ks(claim.paidKs ?? claim.prizeKs);
      const on = decidedLong ? ` on ${decidedLong}` : "";
      const now = balance !== null && balance !== undefined ? ` Your balance is now ${ks(balance)}.` : "";
      return {
        pill: "paid",
        when: decided,
        h: "Paid into your wallet",
        p: `${paid} was added to your MyanFlix wallet${on}.${now}`,
        p2: others
          ? `Paid with your ${others === 1 ? "other winning ticket" : `${others} other winning tickets`} in ${draw}: ${paid} went into your MyanFlix wallet${on}.`
          : `${paid} went into your MyanFlix wallet${on}.`,
        reason: null,
        foot: `Wallet entry: Lottery prize · ${draw}${decidedLong ? ` · ${decidedLong}` : ""}`,
      };
    }
    case "rejected": {
      const spec = claim.rejectReason ? REASON[claim.rejectReason] : null;
      const title = spec?.title ?? "Not confirmed";
      const text = claim.rejectNote ?? spec?.fallback ?? "";
      return {
        pill: "rejected",
        when: decided,
        h: "Payment not confirmed",
        p: "The admin did not confirm this request. The reason is below. If you think this is a mistake, contact support: the admin can review the claim again.",
        p2: `Your ${draw} request of ${total}${many ? ` (${nTickets(n)})` : ""} was not confirmed. The reason is below; support can ask the admin to review it again.`,
        reason: { title, text },
        foot: [sent ? `Sent ${sent}` : "", decided ? `Rejected ${decided}` : ""].filter(Boolean).join(" · "),
      };
    }
    case "expired":
      return {
        pill: "expired",
        when: deadlineDay ? `Deadline ${deadlineDay}` : "",
        h: "Claim deadline passed",
        p: `Prizes for ${draw} had to be requested${deadlineLong ? ` by ${deadlineLong}` : " in time"}${days ? `, ${days} days after the results` : ""}. This prize can no longer be requested.`,
        p2: `The${days ? ` ${days}-day` : ""} claim deadline for ${draw}${deadlineLong ? ` passed on ${deadlineLong}` : " has passed"}. This prize can no longer be requested.`,
        reason: null,
        foot: "If you believe this is wrong, contact support.",
      };
    case "not_requested":
    case "none":
    default:
      return {
        pill: "won",
        when: deadlineDay ? `Request by ${deadlineDay}` : "",
        h: "Request your payment",
        p: "Tap the button below. The admin confirms your request and the money goes into your MyanFlix wallet, usually within 24 hours.",
        p2: others
          ? `One request covers all ${n} of your winning tickets in ${draw}: ${total} in all. The admin confirms it, then it is paid into your MyanFlix wallet.`
          : `Your prize for this ticket in ${draw}: ${total}. The admin confirms your request, then it is paid into your MyanFlix wallet.`,
        reason: null,
        foot: deadlineLong
          ? `Prizes can be requested until ${deadlineLong}${afterPublish}.`
          : "Prizes can be requested for a limited time after the results are published.",
      };
  }
}

/**
 * claimWordsEn in Burmese: the same figures, states and branches, the
 * sentences rebuilt in Burmese order. "Admin" is စီမံခန့်ခွဲသူ and "support"
 * အကူအညီဌာန, as the wallet says them; the paid headline is the one the
 * admin's claim dialog quotes ("သင့်ပိုက်ဆံအိတ်ထဲသို့ ပေးပြီး"). The rejected
 * headline says "not confirmed" (အတည်မပြုပါ), not "not confirmed YET"
 * (အတည်မပြုရသေး, which reads as still pending); the admin's reject dialog
 * quotes the same words (admin translations, rejectDialog.text).
 */
function claimWordsMm({ claim, publishedAt, ticketNo, balance }: ClaimWordsInput): ClaimWords {
  const total = ks(claim.prizeKs);
  const n = claim.wonTickets;
  const draw = `ပွဲစဉ် ${claim.drawNo}`;
  const deadline = claim.claimDeadlineAt;
  const deadlineDay = deadline ? dateDMY(deadline) : "";
  const deadlineLong = deadline ? dateShort(myanmarDateIso(deadline)) : "";
  const days = deadline && publishedAt ? daysAfter(publishedAt, deadline) : null;
  const afterPublish = days ? ` (ရလဒ် ထုတ်ပြန်ပြီး ${days} ရက်အတွင်း)` : "";
  const sent = claim.requestedAt ? dateTimeShort(claim.requestedAt) : "";
  const decided = claim.decidedAt ? dateTimeShort(claim.decidedAt) : "";
  const decidedLong = claim.decidedAt ? dateAtTime(claim.decidedAt) : "";
  const others = ticketNo ? Math.max(0, n - 1) : 0;
  const many = n > 1;

  switch (claim.status) {
    case "requested":
      return {
        pill: "requested",
        when: sent ? `ပို့ချိန် ${sent}` : "",
        h: "အတည်ပြုရန် စောင့်ဆိုင်းဆဲ",
        p: `စီမံခန့်ခွဲသူက သင့်တောင်းခံမှုကို စစ်ဆေးနေပါသည်။ အတည်ပြုပြီးသည်နှင့် ${total} ကို များသောအားဖြင့် 24 နာရီအတွင်း သင့် MyanFlix ပိုက်ဆံအိတ်ထဲ ထည့်ပေးပါမည်။ သင် ထပ်လုပ်စရာ မလိုတော့ပါ။`,
        p2: others
          ? `ဤလက်မှတ်သည် ${sent ? `${sent} တွင် ပို့ခဲ့သော ` : ""}${draw} အတွက် သင့် ${total} (${nTickets(n)}) တောင်းခံမှုတွင် ပါဝင်ပါသည်။ စီမံခန့်ခွဲသူ အတည်ပြုသည်နှင့် သင့် MyanFlix ပိုက်ဆံအိတ်ထဲ ထည့်ပေးပါမည်။`
          : `${draw} အတွက် သင့် ${total} တောင်းခံမှုကို ${sent ? `${sent} တွင် ပို့ခဲ့ပါသည်` : "စီမံခန့်ခွဲသူထံ ပို့ထားပါသည်"}။ စီမံခန့်ခွဲသူ အတည်ပြုသည်နှင့် သင့် MyanFlix ပိုက်ဆံအိတ်ထဲ ထည့်ပေးပါမည်။`,
        reason: null,
        foot: "ငွေပေးချေမှုကို ဤနေရာနှင့် သင့်ပိုက်ဆံအိတ်တွင် ပြပါမည်။",
      };
    case "paid": {
      const paid = ks(claim.paidKs ?? claim.prizeKs);
      const on = decidedLong ? `${decidedLong} တွင် ` : "";
      const now = balance !== null && balance !== undefined ? ` ယခု သင့်လက်ကျန်ငွေ ${ks(balance)} ဖြစ်ပါသည်။` : "";
      return {
        pill: "paid",
        when: decided,
        h: "သင့်ပိုက်ဆံအိတ်ထဲသို့ ပေးပြီး",
        p: `${paid} ကို ${on}သင့် MyanFlix ပိုက်ဆံအိတ်ထဲ ထည့်ပေးပြီးပါပြီ။${now}`,
        // One form with the count word (Burmese has no plural): "အခြား ဆုပေါက်သော လက်မှတ် 1 စောင်" reads naturally.
        p2: others
          ? `${draw} မှ သင့်အခြား ဆုပေါက်သော လက်မှတ် ${others} စောင်နှင့်အတူ ပေးပြီးပါပြီ။ ${paid} ကို ${on}သင့် MyanFlix ပိုက်ဆံအိတ်ထဲ ထည့်ပေးပြီးပါပြီ။`
          : `${paid} ကို ${on}သင့် MyanFlix ပိုက်ဆံအိတ်ထဲ ထည့်ပေးပြီးပါပြီ။`,
        reason: null,
        foot: `ပိုက်ဆံအိတ် မှတ်တမ်း: ထီဆုငွေ · ${draw}${decidedLong ? ` · ${decidedLong}` : ""}`,
      };
    }
    case "rejected": {
      const spec = claim.rejectReason ? REASON_MM[claim.rejectReason] : null;
      const title = spec?.title ?? "အတည်မပြုပါ";
      const text = claim.rejectNote ?? spec?.fallback ?? "";
      return {
        pill: "rejected",
        when: decided,
        h: "ငွေပေးချေမှု အတည်မပြုပါ",
        p: "စီမံခန့်ခွဲသူက ဤတောင်းခံမှုကို အတည်မပြုခဲ့ပါ။ အကြောင်းပြချက်ကို အောက်တွင် ဖော်ပြထားပါသည်။ မှားယွင်းနေသည်ဟု ထင်ပါက အကူအညီဌာနကို ဆက်သွယ်ပါ။ စီမံခန့်ခွဲသူက တောင်းခံမှုကို ပြန်လည် သုံးသပ်ပေးနိုင်ပါသည်။",
        p2: `${draw} အတွက် သင့် ${total}${many ? ` (${nTickets(n)})` : ""} တောင်းခံမှုကို အတည်မပြုခဲ့ပါ။ အကြောင်းပြချက်ကို အောက်တွင် ဖော်ပြထားပါသည်။ အကူအညီဌာနက စီမံခန့်ခွဲသူထံ ပြန်လည် သုံးသပ်ရန် တောင်းဆိုပေးနိုင်ပါသည်။`,
        reason: { title, text },
        foot: [sent ? `ပို့ချိန် ${sent}` : "", decided ? `ငြင်းပယ်ချိန် ${decided}` : ""].filter(Boolean).join(" · "),
      };
    }
    case "expired":
      return {
        pill: "expired",
        when: deadlineDay ? `နောက်ဆုံးရက် ${deadlineDay}` : "",
        h: "ဆုငွေ တောင်းခံရန် နောက်ဆုံးရက် ကျော်လွန်ပြီ",
        p: `${draw} အတွက် ဆုငွေကို ${deadlineLong ? `${deadlineLong} အထိ` : "သတ်မှတ်ချိန်အတွင်း"}${days ? ` (ရလဒ် ထွက်ပြီး ${days} ရက်အတွင်း)` : ""} တောင်းခံရန် လိုခဲ့ပါသည်။ ဤဆုငွေကို တောင်းခံ၍ မရတော့ပါ။`,
        p2: `${draw} အတွက် ဆုငွေ တောင်းခံရန်${days ? ` ${days} ရက်` : ""} သတ်မှတ်ချိန်သည် ${deadlineLong ? `${deadlineLong} တွင် ကုန်ဆုံးခဲ့ပါသည်` : "ကုန်ဆုံးသွားပါပြီ"}။ ဤဆုငွေကို တောင်းခံ၍ မရတော့ပါ။`,
        reason: null,
        foot: "မှားယွင်းနေသည်ဟု ထင်ပါက အကူအညီဌာနကို ဆက်သွယ်ပါ။",
      };
    case "not_requested":
    case "none":
    default:
      return {
        pill: "won",
        when: deadlineDay ? `နောက်ဆုံးရက် ${deadlineDay}` : "",
        h: "သင့်ဆုငွေကို တောင်းခံပါ",
        p: "အောက်ရှိ ခလုတ်ကို နှိပ်ပါ။ စီမံခန့်ခွဲသူက သင့်တောင်းခံမှုကို အတည်ပြုပြီး ငွေကို များသောအားဖြင့် 24 နာရီအတွင်း သင့် MyanFlix ပိုက်ဆံအိတ်ထဲ ထည့်ပေးပါမည်။",
        p2: others
          ? `တောင်းခံမှု တစ်ခုတည်းတွင် ${draw} မှ ဆုပေါက်သော သင့်လက်မှတ် ${n} စောင်လုံး ပါဝင်ပါသည်။ စုစုပေါင်း ${total} ဖြစ်ပါသည်။ စီမံခန့်ခွဲသူ အတည်ပြုပြီးနောက် သင့် MyanFlix ပိုက်ဆံအိတ်ထဲ ထည့်ပေးပါမည်။`
          : `${draw} ၏ ဤလက်မှတ်အတွက် သင့်ဆုငွေမှာ ${total} ဖြစ်ပါသည်။ စီမံခန့်ခွဲသူက သင့်တောင်းခံမှုကို အတည်ပြုပြီးနောက် သင့် MyanFlix ပိုက်ဆံအိတ်ထဲ ထည့်ပေးပါမည်။`,
        reason: null,
        foot: deadlineLong
          ? `ဆုငွေကို ${deadlineLong} အထိ${afterPublish} တောင်းခံနိုင်ပါသည်။`
          : "ရလဒ် ထုတ်ပြန်ပြီးနောက် သတ်မှတ်ထားသော ကာလအတွင်းသာ ဆုငွေ တောင်းခံနိုင်ပါသည်။",
      };
  }
}

/** Whole days from publishing to the deadline ("90 days after …"), or null when it is not a sensible span. */
function daysAfter(publishedAt: string, deadline: string): number | null {
  const days = daysBetween(publishedAt, deadline);
  return days !== null && days >= 1 ? days : null;
}

const CLAIM_COPY_EN = {
  action: {
    /** "Request payment · 150,000 Ks". */
    request: (total: string) => `Request payment · ${total}`,
    requestA11y: (total: string, drawNo: number) => `Request payment of ${total} for Draw ${drawNo}`,
    requestHint: "Opens the request to check and send",
    openWallet: "Open wallet",
    openWalletA11y: "Open wallet, in MyanFlix",
    support: "Contact support",
  },
  /** Under the Request button (summary only): the three steps. */
  steps: {
    request: "You request",
    confirm: "Admin confirms",
    paid: "Paid into your wallet",
    a11y: "How it works: you request, the admin confirms, paid into your wallet",
  },
  /** The two-step track while the request waits. */
  track: { sent: "Request sent", confirms: "Admin confirms" },

  /** The slot while the claim view loads or fails (inside the gold card). */
  loading: "Loading your prize payment…",
  errorText: "Your prize payment did not load.",
  retry: "Try again",

  sheet: {
    title: "Request payment",
    /** "Your prize for 3 winning tickets in Draw 2 · Sat 17 Oct 2026. One request covers all of them." */
    forLine: (n: number, drawNo: number, day: string) =>
      `Your prize for ${n === 1 ? "1 winning ticket" : `${n} winning tickets`} in Draw ${drawNo} · ${day}.${
        n > 1 ? " One request covers all of them." : ""
      }`,
    listA11y: "Tickets in this request",
    /** One row: "Ticket 7 3 1 5 6 0, MFL-02-000417, Last 2 digits, 50,000 Ks." */
    rowA11y: (number: string, id: string, groups: string, amount: string) =>
      `Ticket ${spaced(number)}, ${id}${groups ? `, ${groups}` : ""}, ${amount}.`,
    total: "Total",
    noteLead: "Paid into your MyanFlix wallet after the admin confirms",
    noteRest: ", usually within 24 hours. You will see it here and in your wallet.",
    notNow: "Not now",
    send: "Request payment",
    sending: "Sending…",
    tryAgain: "Try again",
    closeA11y: "Close, not now",
    /** The one plain line above the buttons when the server said no, or the answer was lost. */
    lost: "The request did not go through. Check your connection and try again.",
    /** The server's refusal in the customer's words (a passing one — the publish still settling — keeps the button as "Try again"). */
    refused: (why: ClaimRefusal): string => {
      switch (why.kind) {
        case "alreadyRequested":
          return "This prize has already been requested. The latest status is shown on the page.";
        case "rejected":
          return "This request was not confirmed. Contact support: the admin can review it again.";
        case "expired":
          return "The claim deadline for this draw has passed. This prize can no longer be requested.";
        case "nothing":
          return "There is no prize to request for this draw.";
        case "notPublished":
          return why.settling
            ? "The results are still being published — try again in a moment."
            : "This draw's results are not published yet.";
        case "notFound":
          return "This draw was not found.";
        default:
          return why.message || "The request was not accepted.";
      }
    },
  },

  /** After the request went through (the board's toast). */
  toast: { sent: "Request sent. The admin confirms it, then the money goes into your wallet." },
} as const;

const CLAIM_COPY_MM: LtWiden<typeof CLAIM_COPY_EN> = {
  action: {
    request: (total: string) => `ဆုငွေ တောင်းခံရန် · ${total}`,
    requestA11y: (total: string, drawNo: number) => `ပွဲစဉ် ${drawNo} အတွက် ဆုငွေ ${total} တောင်းခံရန်`,
    requestHint: "စစ်ဆေးပြီး ပို့ရန် တောင်းခံမှုကို ဖွင့်ပါမည်",
    openWallet: "ပိုက်ဆံအိတ် ဖွင့်ရန်",
    openWalletA11y: "MyanFlix ရှိ ပိုက်ဆံအိတ် ဖွင့်ရန်",
    support: "အကူအညီဌာနကို ဆက်သွယ်ရန်",
  },
  /** The three steps as nouns ("you requesting → the admin confirming → paying"), as a process reads in Burmese. */
  steps: {
    request: "သင် တောင်းခံခြင်း",
    confirm: "စီမံခန့်ခွဲသူ အတည်ပြုခြင်း",
    paid: "ပိုက်ဆံအိတ်ထဲ ပေးခြင်း",
    a11y: "လုပ်ဆောင်ပုံ။ သင် တောင်းခံပါက စီမံခန့်ခွဲသူက အတည်ပြုပြီး သင့်ပိုက်ဆံအိတ်ထဲ ထည့်ပေးပါမည်။",
  },
  track: { sent: "တောင်းခံမှု ပို့ပြီး", confirms: "စီမံခန့်ခွဲသူ အတည်ပြုခြင်း" },

  loading: "သင့်ဆုငွေ ပေးချေမှုကို ဖွင့်နေသည်…",
  errorText: "သင့်ဆုငွေ ပေးချေမှုကို ဖွင့်၍ မရပါ။",
  retry: "ထပ်ကြိုးစားကြည့်ရန်",

  sheet: {
    title: "ဆုငွေ တောင်းခံရန်",
    forLine: (n: number, drawNo: number, day: string) =>
      `ပွဲစဉ် ${drawNo} (${day}) တွင် ဆုပေါက်သော လက်မှတ် ${n} စောင်အတွက် သင့်ဆုငွေ ဖြစ်ပါသည်။${
        n > 1 ? " တောင်းခံမှု တစ်ခုတည်းတွင် လက်မှတ်အားလုံး ပါဝင်ပါသည်။" : ""
      }`,
    listA11y: "ဤတောင်းခံမှုတွင် ပါဝင်သော လက်မှတ်များ",
    rowA11y: (number: string, id: string, groups: string, amount: string) =>
      `လက်မှတ် ${spaced(number)}၊ ${id}${groups ? `၊ ${groups}` : ""}၊ ${amount}။`,
    total: "စုစုပေါင်း",
    /** RequestPaymentSheet sets noteLead in bold and noteRest straight after it, so noteRest starts with the full stop. */
    noteLead: "စီမံခန့်ခွဲသူ အတည်ပြုပြီးနောက် သင့် MyanFlix ပိုက်ဆံအိတ်ထဲ ထည့်ပေးပါမည်",
    noteRest: "။ များသောအားဖြင့် 24 နာရီအတွင်း ပြီးပါသည်။ ဤနေရာနှင့် သင့်ပိုက်ဆံအိတ်တွင် တွေ့ရပါမည်။",
    notNow: "နောက်မှ",
    send: "ဆုငွေ တောင်းခံရန်",
    sending: "ပို့နေသည်…",
    tryAgain: "ထပ်ကြိုးစားကြည့်ရန်",
    closeA11y: "ပိတ်ရန်၊ နောက်မှ",
    lost: "တောင်းခံမှုကို ပို့၍ မရခဲ့ပါ။ အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်ကြိုးစားကြည့်ပါ။",
    refused: (why: ClaimRefusal): string => {
      switch (why.kind) {
        case "alreadyRequested":
          return "ဤဆုငွေကို တောင်းခံပြီး ဖြစ်ပါသည်။ နောက်ဆုံး အခြေအနေကို စာမျက်နှာတွင် ပြထားပါသည်။";
        case "rejected":
          return "ဤတောင်းခံမှုကို အတည်မပြုခဲ့ပါ။ အကူအညီဌာနကို ဆက်သွယ်ပါ။ စီမံခန့်ခွဲသူက ပြန်လည် သုံးသပ်ပေးနိုင်ပါသည်။";
        case "expired":
          return "ဤပွဲစဉ်အတွက် ဆုငွေ တောင်းခံရန် နောက်ဆုံးရက် ကျော်လွန်သွားပါပြီ။ ဤဆုငွေကို တောင်းခံ၍ မရတော့ပါ။";
        case "nothing":
          return "ဤပွဲစဉ်တွင် တောင်းခံရန် ဆုငွေ မရှိပါ။";
        case "notPublished":
          return why.settling
            ? "ရလဒ်ကို ထုတ်ပြန်နေဆဲ ဖြစ်ပါသည်။ ခဏနေမှ ထပ်ကြိုးစားကြည့်ပါ။"
            : "ဤပွဲစဉ်၏ ရလဒ်ကို မထုတ်ပြန်ရသေးပါ။";
        case "notFound":
          return "ဤပွဲစဉ်ကို ရှာမတွေ့ပါ။";
        default:
          // The server's own message is English text: a Burmese reader gets the Burmese line instead.
          return "တောင်းခံမှုကို လက်မခံခဲ့ပါ။";
      }
    },
  },

  toast: { sent: "တောင်းခံမှု ပို့ပြီးပါပြီ။ စီမံခန့်ခွဲသူ အတည်ပြုပြီးနောက် ငွေကို သင့်ပိုက်ဆံအိတ်ထဲ ထည့်ပေးပါမည်။" },
};

export const CLAIM_COPY = ltCopy(CLAIM_COPY_EN, CLAIM_COPY_MM);
