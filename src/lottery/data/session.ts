/**
 * Draw's "Your numbers" list (owner, 19 Oct 2026: several different numbers
 * in one purchase): an in-memory zustand store, NOT persisted. It lives here,
 * not in the Draw screen, so it survives switching tabs; it is gone on reload.
 *
 * Nothing else is kept here since phase 2 (2026-10-19): the wallet is the
 * real one (hooks/useWallet), purchases and tickets come from the API
 * (lottery/hooks/usePurchases, useTickets), and the purchases made in this
 * session are remembered by hooks/useBuyTickets for the "New" chips.
 */
import { create } from "zustand";

/**
 * One number in Draw's "Your numbers" list. The same shape as one Confirm row
 * (components/confirm/confirmModel.ts), so the page draws it with the sheet's
 * own row and rules.
 */
export interface ListRow {
  number: string;
  /** null while its typed box is empty: it counts 0 and Buy waits until it is filled. */
  qty: number | null;
  /** The last quantity it had (what an emptied box falls back to). */
  last: number;
}

interface LotterySessionState {
  /** Draw's "Your numbers", in the order they were added. Starts empty. */
  drawList: ListRow[];
  /** Replaces the list (Draw works out every change with drawState's pure helpers). */
  setDrawList: (rows: ListRow[]) => void;
}

export const useLotterySession = create<LotterySessionState>((set) => ({
  drawList: [],
  setDrawList: (rows) => set({ drawList: rows }),
}));
