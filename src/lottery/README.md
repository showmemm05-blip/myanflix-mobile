# src/lottery — the Thai lottery app ("Ivory Press")

**Everything is REAL since phase 3 (2026-10-19).** The approved Lottery design
(docs/lottery-design-2026-10-13/app) built into the phone app as a separate WHITE app
inside dark MyanFlix. The DREAMS are real (phase 1: `hooks/useDreams.ts`); the DRAWS,
PURCHASES, TICKETS and the WALLET (phase 2): the current draw and its countdown, price
and per-number limit come from `GET /lottery/draws/current`; "held" and "not on sale"
from `POST …/availability`; Buy → Confirm sends `POST /lottery/purchases` (one wallet
debit, an idempotency key kept until it succeeds); My tickets, TicketView, Printed and
History read `GET /lottery/tickets` / `/purchases`; the top bar's balance chip and
Confirm read the MyanFlix wallet (`hooks/useWallet`). The RESULTS, PRIZES and WINNERS
(phase 3, `hooks/useResults.ts`): Results and Check my tickets read the published sheets
(`GET /lottery/results`, `GET /lottery/draws/:drawNo/results` — nine groups, 173 numbers,
Ks at the draw's rate) and match the customer's tickets on the phone with the same pure
matcher the server paid by; My tickets / TicketView show Won + the real amount
(`prizeKs`, `wonGroups`); History lists the wallet's "Lottery prize" rows; Home's "Recent
winners" is `GET /lottery/draws/:drawNo/winners` (number, group, Ks — never a name).
What stays sample is decoration: the two tickets fanned on Home's current-draw card
(printed on the real draw; the numbers are the board's). Home was rebuilt on 2026-10-22
to the intuitive board (the current draw first, three ways to pick, the previous draw's
results and winners, the three steps). Notes in docs/lottery-backend-2026-10-19/BUILD.md;
the build plan is docs/lottery-design-2026-10-13/mobile-build/PLAN.md.

**Prize payment by request (2026-10-24, PrizeClaim.dc.html).** Publishing no longer pays
anybody: it awards the prizes. The customer sends ONE request per draw for all of their
winning tickets (`POST /lottery/claims`), the admin confirms or rejects it on the admin's
Prize claims page, and only then the wallet is credited. On the phone: `components/claim/`
— `PrizeClaim` (reads `GET /lottery/claims/draws/:drawNo`, owns the sheet) → `PrizeClaimBlock`
(Won → Request payment · Requested · Paid · Rejected · Expired, ONE action) +
`RequestPaymentSheet`; it sits under Check my tickets' gold "You won" summary and under
Ticket view's prize card; a won ticket row / pile shows the claim chip from the ticket's
`claimStatus`. Hooks in `hooks/useClaims.ts` (`useDrawClaim`, `useRequestClaim`,
`claimRefusalOf` for the 409 codes). Notes: docs/lottery-claims-2026-10-24/BUILD-mobile.md.

**My tickets = the current draw; earlier draws live in History (owner, 2026-10-27: "keep
tickets until next draw show up").** The rule is `data/draws.ts ticketPlaceOf`: a draw's
tickets stay on the Tickets tab while its number is ≥ the current draw's
(`GET /lottery/draws/current`) or while it is not yet published (a draw waiting for its
results never leaves My tickets); every other draw's tickets are History's. So a published
draw keeps its results, Won chips and "Request payment" on My tickets until the admin creates
the next draw. No current draw = everything on My tickets; while the current draw or the draw
list is loading or failed nothing is placed (skeleton / Try again). `hooks/useTicketPlaces.ts`
feeds it: `useTicketPlaces` (current draw + `useDrawList` = `GET /lottery/draws`, every draw's
status, one request), `useCurrentTickets` (My tickets: each kept draw read whole with
`useTicketsOfDraws`, no paging through the whole history) and `useEarlierTickets` (History:
the all-tickets list page by page, My tickets' draws filtered out; its count = page 1's total
minus My tickets' set). **My tickets** (`screens/tickets/LotteryTicketsScreen.tsx`) has no
All/Waiting/Results filter and no "Earlier draws" section any more: the head, the "just
bought" note + "Show the new tickets", the draw cards, and when empty "No tickets for Draw N
yet" · "Choose numbers" · "See your earlier tickets in History" (only when History holds
some); when the page holds only an earlier draw still waiting for its results, the same
"No tickets for Draw N yet" prompt sits compact above that card (the close line comes from
`data/draws.ts saleCloseLabel`, the close instant's own day). **History**
(`screens/history/LotteryHistoryScreen.tsx`) has a Tickets · Purchases switch under the head
(counts as badges): "Tickets" = `EarlierTickets`, the same draw cards
(`screens/tickets/parts/DrawGroupList.tsx` → DrawGroup → PileItem → TicketPile, shared by both
tabs; since 27 Oct 2026 every number is a PileItem, one ticket too, with a "Ticket · Bought"
list of each ticket's bought time under it), a ticket opening Ticket view in the Tickets tab, Try again when a page or a draw read
fails; "Purchases" = the page as before. It starts on Tickets when there are earlier tickets,
else Purchases, and on Purchases after a purchase in this session; `route.params.show`
("tickets" | "purchases") picks one from a link. Notes:
docs/lottery-tickets-current-2026-10-27/BUILD.md and FIXES.md.

How you get here: the main dock's **Lottery** tab (or Home's white Lottery banner) →
the dark hub `src/screens/Lottery/LotteryHub.tsx` → "Thai lottery" → the root
`Lottery` screen (`navigation/LotteryNavigator.tsx`), where the main dock is hidden
and the Ivory dock takes over. There is no back arrow (owner, 2026-10-23): the emblem chip
("MyanFlix") at the top bar's left opens the "Leave the lottery?" sheet — Lottery games (the
hub), Back to MyanFlix (the main Home) or Stay here; the phone's back key walks the tab
history, then pops the Lottery onto the hub.

## Map
```
assets.ts            require() map of the built-in ticket frame (assets/lottery/frame-thai*.png); draw pictures are the admin's uploads only
                     — a real draw prints its admin picture (pictureUrl, expo-image) or the default
copy.ts              shared English copy (shell, dock, pills, sheets, footer, toasts)
theme/tokens.ts      LT colours, TICKET_INK, radii, spacing, shadows (boxShadow strings), layout, LT_EASE
theme/type.ts        LT_TYPE roles (micro … displayL, num, digit, mono) — sizes live only here
theme/fonts.ts       the eight faces (by file), useLotteryFonts, LtFontsContext, ltFace / useLtFace
data/sample.ts       the shared shapes (DrawInfo, TicketItem, PurchaseItem) + the hero fan's two sample numbers
data/draws.ts        the API's draws / tickets / purchases mapped into those shapes; saleStatus;
                     ticketPlaceOf (which tab a draw's tickets are on)
data/format.ts       ks, spaced, dates (EN / Burmese), Myanmar-time clock labels, rateLabel, DIGIT_WORDS
data/ticketArt.ts    barcode + QR stand-ins (not scannable), cached per ticket
data/generator.ts    the Dream sample-ticket generator (deterministic; a dream = its number)
data/piles.ts        same number + same draw = one pile; a pile's result from the sheet or the API
data/prizes.ts       the nine prize groups, sheetOf (API → PrizeSheet), matchNumber, highlight ranges
data/session.ts      Draw's "Your numbers" list only (zustand, NOT persisted)
hooks/               lotteryKeys (THE query keys), useCurrentDraw (+ useLotteryNow), useAvailability,
                     useBuyTickets (+ useRecentBuys, buyRefusalOf), useTickets (+ useTicketsOfDraws),
                     useTicketPlaces (My tickets vs History: useCurrentTickets, useEarlierTickets),
                     usePurchases, useDraws (+ useDrawList),
                     useResults (+ useDrawResults, useSheetsByNo, useDrawWinners), useDreams,
                     useClaims (useDrawClaim, useMyClaims, useRequestClaim, claimRefusalOf),
                     useKeyboardShown, useLtClearance,
                     useLotteryPresence (POST /lottery/activity on entering, on foreground and every
                     5 min while signed in; errors swallowed; mounted ONCE in LotteryNavigator)
navigation/          types (frozen), LotteryNavigator, useExitLottery, useOpenWallet
components/          the shared Ivory components; ticket/ = the Thai-style ticket (takes a `draw`);
                     confirm/ = the Confirm sheet's slim row + its pure rules (v3 · compact), its undo
                     toast and screen-reader helpers; Draw's "Your numbers" uses the same row;
                     claim/ = the prize-claim block, the Request payment sheet, their copy and the
                     PrizeClaim section that owns the query (prizes paid by request, 2026-10-24)
screens/home         group A    screens/draw (+ components/ConfirmSheet.tsx)  group B
screens/tickets · results (+ checktickets) · history  group C    screens/dreams  group D
```

## Rules (every change)
- Only this folder's own theme: never `theme.colors` (a dark token leaking in is the
  bug to avoid). `theme.font` is used for Burmese runs only (Noto Sans Myanmar).
- Every request goes through `@/services/lottery.service` and a hook under `hooks/`
  (React Query, keys from `hooks/lotteryKeys.ts`); no screen calls `@/api`, fetch, axios
  or a socket itself.
- Every instant from the API is shown in MYANMAR time (`data/format.ts`); a draw's
  calendar date is `thaiDrawDate` as it is.
- Every lottery number is a six-digit STRING ("004821"), read digit by digit; a
  sheet's digit prizes are 3- or 2-digit strings.
- Prize amounts are the API's Ks (`group.ks`), never worked out on the phone; the
  phone only MATCHES numbers against a published sheet (`data/prizes.ts matchNumber`)
  and never shows a winner's name. Prizes are PAID BY REQUEST: never write "paid into
  your wallet" for a prize that is not `paid`; the claim's words come from
  `components/claim/copy.ts claimWords`.
- Copy: sentence case, "1,000 Ks", no "!", never "lucky / win big / official /
  government"; KBZPay and WavePay are the only ways to add money.
- Text is `LtText` (role from `theme/type.ts`); the ticket's printed layers are the
  only other Text. Colours come from `LT` / `TICKET_INK` only.
- Every animation checks `useReducedMotion()`; targets are ≥ 44pt (or hit slop).
- The wallet and its deposit open the MyanFlix wallet page (`navigation/useOpenWallet`);
  a prize claim's "Contact support" shows the toast `LT_COPY.previewOnly`. The top bar
  has no profile avatar or account menu (removed 27 Oct 2026, owner).
- The ticket box is always 1800 : 940 — set `width`, never scale it with a transform.
