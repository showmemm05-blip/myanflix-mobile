import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";
import type { DreamBook } from "@/types/lottery";

/**
 * THE LOTTERY'S ROUTES — frozen after the foundation step (mobile-build/PLAN.md
 * §2). The Thai lottery app is one ROOT screen ("Lottery", RootStackParamList)
 * so the main MyanFlix dock never shows inside it; within it, five tabs with
 * the Ivory dock, three of them with their own stack.
 *
 * Why per-tab stacks: every phone board keeps the dock with a current tab —
 * the Dream pages and DreamTickets are Home's, Printed is Draw's, TicketView
 * is Tickets' — so those pages are pushed INSIDE their tab and Back stays in
 * it (the main app's per-tab rule, navigation/types.ts MediaDetailParamList).
 *
 * Confirm, Turn sideways and Change dream are not routes: they are Modals
 * opened by the screen that owns them.
 *
 * Round 2 (owner, 2026-10-15): Results gained a small stack of its own for
 * "Check my tickets" (CheckTickets.dc.html), which the Results page opens and
 * whose dock keeps Results current.
 */
export type { DreamBook };

export type LotteryHomeStackParamList = {
  LotteryHome: undefined;
  /** A dream book: Dream Number 1000 (three digits) or Dream Number 100 (two). */
  LotteryDreamBook: { book: DreamBook };
  /** The sample-ticket generator for one dream of a book: its zero-padded number ("027" / "07"), loaded from the API. */
  LotteryDreamTickets: { book: DreamBook; number: string };
};

export type LotteryDrawStackParamList = {
  /**
   * `number` pre-fills the six-digit window; `quickPick` fills it with one
   * Quick pick on arrival (Home's Random tile, 22 Oct 2026). The screen
   * clears each once read.
   */
  LotteryDraw: { number?: string; quickPick?: boolean } | undefined;
  /** The success page for one purchase (its `ref`, "LP-261028-0144"). */
  LotteryPrinted: { purchaseId: string };
};

export type LotteryTicketsStackParamList = {
  LotteryTickets: undefined;
  LotteryTicketView: { ticketId: string };
};

export type LotteryResultsStackParamList = {
  LotteryResults: undefined;
  /** The ticket-by-ticket reveal for one published draw; unset = the latest published result. */
  CheckTickets: { drawNo?: number } | undefined;
};

export type LotteryTabParamList = {
  LotteryHomeTab: NavigatorScreenParams<LotteryHomeStackParamList>;
  LotteryDrawTab: NavigatorScreenParams<LotteryDrawStackParamList>;
  /** Optional params; Home and TicketView pass `{ screen: "LotteryResults", pop: true }` so an open CheckTickets is popped. */
  LotteryResultsTab: NavigatorScreenParams<LotteryResultsStackParamList> | undefined;
  LotteryTicketsTab: NavigatorScreenParams<LotteryTicketsStackParamList>;
  /**
   * `show` opens one of History's two views (owner, 2026-10-27): "tickets" =
   * the earlier draws' tickets (My tickets' empty page links there),
   * "purchases" = the purchase list (a card's "Purchases ›", Ticket view's
   * purchase ref). Read once and cleared; unset = the view as left.
   */
  LotteryHistoryTab: { show?: HistoryView } | undefined;
};

/** Lottery history's two views. */
export type HistoryView = "tickets" | "purchases";

/**
 * Screen props, the same CompositeScreenProps pattern as Home.tsx: the
 * screen's own stack, then the Lottery tabs, then the app's root stack — so a
 * screen can push in its stack, switch Lottery tab, or reach a root route.
 */
type InTabs<Tab extends keyof LotteryTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<LotteryTabParamList, Tab>,
  NativeStackScreenProps<RootStackParamList>
>;

export type LotteryHomeScreenProps<Screen extends keyof LotteryHomeStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<LotteryHomeStackParamList, Screen>,
  InTabs<"LotteryHomeTab">
>;

export type LotteryDrawScreenProps<Screen extends keyof LotteryDrawStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<LotteryDrawStackParamList, Screen>,
  InTabs<"LotteryDrawTab">
>;

export type LotteryTicketsScreenProps<Screen extends keyof LotteryTicketsStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<LotteryTicketsStackParamList, Screen>,
  InTabs<"LotteryTicketsTab">
>;

export type LotteryResultsStackScreenProps<Screen extends keyof LotteryResultsStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<LotteryResultsStackParamList, Screen>,
  InTabs<"LotteryResultsTab">
>;

/** The Results page: the root of the Results stack (it pushes "CheckTickets"). */
export type LotteryResultsScreenProps = LotteryResultsStackScreenProps<"LotteryResults">;
export type LotteryCheckTicketsScreenProps = LotteryResultsStackScreenProps<"CheckTickets">;

/** History is a plain tab screen (nothing is pushed in it); its Tickets · Purchases switch is state, not a route. */
export type LotteryHistoryScreenProps = InTabs<"LotteryHistoryTab">;
