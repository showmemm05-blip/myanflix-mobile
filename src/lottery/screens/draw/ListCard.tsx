import { memo, type RefObject } from "react";
import { StyleSheet, View, useWindowDimensions, type AccessibilityActionEvent, type ViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LtButton } from "@/lottery/components/LtButton";
import { LtEmpty } from "@/lottery/components/LtEmpty";
import { LtText } from "@/lottery/components/LtText";
import { LtCard, LtHelp } from "@/lottery/components/Surfaces";
import { ConfirmRow } from "@/lottery/components/confirm/ConfirmRow";
import { maxFor, rowView } from "@/lottery/components/confirm/confirmModel";
import { UndoToast } from "@/lottery/components/confirm/UndoToast";
import type { ListRow } from "@/lottery/data/session";
import { DRAW_COPY, speakNumbers } from "@/lottery/screens/draw/copy";
import { LIST_MAX_NUMBERS, listView } from "@/lottery/screens/draw/drawState";
import type { ListActions, ListFlash, ListUndo } from "@/lottery/screens/draw/useNumberList";
import { LT } from "@/lottery/theme/tokens";

const L = DRAW_COPY.list;

/** Page rows never need lifting by hand: the page's KeyboardLiftScrollView keeps a focused box in view. */
function placedNowhere(): void {}

/** Where every Lottery toast sits: 64 under the safe-area top, just under the 56pt top bar (LtToastHost). */
const TOAST_TOP = 64;

/** "Undo: bring back 5 8 1 2 0 6" / "Undo: bring back 3 numbers". */
function undoLabelOf(undo: ListUndo): string {
  return undo.all ? L.undoAll(undo.rows.length) : L.undoOne(undo.rows[0].number);
}

/**
 * "YOUR NUMBERS" (multi-number Draw board `lt-lcard`, 19 Oct 2026; it
 * replaces "How many tickets"): the numbers you are collecting for one
 * purchase.
 *
 *  - Head: "Your numbers", a quiet "Clear all", then "3 numbers · 5 tickets".
 *  - One slim row per number — the Confirm sheet's own row (ConfirmRow +
 *    rowView): number | − qty + (you can type) | row total | × — with the
 *    limit line only when it matters ("You hold 3 · up to 17 more"). No
 *    caption: every row here is "in your list".
 *  - "Total · 5 tickets" + the amount, then the wallet line (warn when the
 *    list costs more than the wallet; Confirm still opens and offers a
 *    deposit).
 *  - Empty: "Add your first number" and how.
 *
 * The heading is one focus stop with a ref: after Remove, Clear all or Undo
 * the reader is moved there (useNumberList). While the undo toast shows, the
 * heading also carries its Undo as an accessibility action, so it is one
 * swipe away from where focus lands (the toast itself floats at the top of
 * the screen, after the page in reading order). Memo'd with stable actions,
 * so typing in the number window does not redraw the list.
 */
export const ListCard = memo(function ListCard({
  rows,
  price,
  most,
  balance,
  heldOf,
  focusedRow,
  flash,
  headRef,
  actions,
  undo,
  onUndo,
}: {
  rows: readonly ListRow[];
  price: number;
  /** The draw's per-number limit. */
  most: number;
  /** The wallet; null while it has not loaded. */
  balance: number | null;
  heldOf: (number: string) => number;
  /** The row whose box has the keyboard (its pill's edge turns indigo). */
  focusedRow: string | null;
  flash: ListFlash | null;
  headRef: RefObject<ViewInstance | null>;
  actions: ListActions;
  /** The last Remove / Clear all while it can still be undone (the page's undo toast shows). */
  undo: ListUndo | null;
  onUndo: () => void;
}) {
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const has = rows.length > 0;
  const view = listView(rows, price, balance);
  const onHeadAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "undo") onUndo();
  };

  return (
    <LtCard>
      <View style={styles.head}>
        <View
          ref={headRef}
          style={styles.title}
          accessible
          accessibilityRole="header"
          accessibilityLabel={L.title}
          accessibilityActions={undo ? [{ name: "undo", label: undoLabelOf(undo) }] : undefined}
          onAccessibilityAction={undo ? onHeadAction : undefined}
        >
          <LtText role="title" numberOfLines={1} style={styles.titleText}>
            {L.title}
          </LtText>
        </View>
        {has ? (
          <LtButton
            variant="ghost"
            size="xs"
            label={L.clearAll}
            accessibilityLabel={L.clearAllA11y}
            onPress={actions.onClearAll}
            style={styles.clear}
          />
        ) : null}
      </View>

      {has ? (
        <>
          <LtText role="meta" color={LT.ink2} tabular style={styles.count} accessibilityLabel={view.countSpoken}>
            {view.count}
          </LtText>
          <View style={styles.list}>
            {rows.map((row, i) => {
              const held = heldOf(row.number);
              return (
                <ConfirmRow
                  key={row.number}
                  number={row.number}
                  view={rowView({ ...row, caption: "none" }, held, maxFor(held, most), price, false)}
                  busy={false}
                  focused={focusedRow === row.number}
                  narrow={narrow}
                  divided={i > 0}
                  onLess={actions.onLess}
                  onMore={actions.onMore}
                  onType={actions.onType}
                  onFocus={actions.onFocus}
                  onBlur={actions.onBlur}
                  onRemove={actions.onRemove}
                  onPlaced={placedNowhere}
                  flashKey={flash?.number === row.number ? flash.key : 0}
                />
              );
            })}
          </View>
          <View style={styles.total} accessible accessibilityLabel={view.totalSpoken}>
            <LtText role="metaB" color={LT.ink2} tabular style={styles.totalLabel}>
              {view.totalLabel}
            </LtText>
            <LtText role="h" numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {view.total}
            </LtText>
          </View>
          <LtHelp
            kind={view.wallet.kind}
            icon="wallet"
            text={view.wallet.text}
            spoken={view.wallet.spoken}
            style={styles.wallet}
          />
        </>
      ) : (
        <LtEmpty compact mark="plus" title={L.emptyTitle} text={L.emptyText(most, LIST_MAX_NUMBERS)} style={styles.empty} />
      )}
    </LtCard>
  );
});

/**
 * The page's undo toast ("581206 removed · Undo" / "3 numbers cleared ·
 * Undo"; the board's `.lt-toast--undo`): placed like every Lottery toast,
 * under the top bar and over the page. One toast at a time — useNumberList
 * takes LtToast's own toast down when this one comes up. A new `undo.id`
 * replays the entrance; the host stays mounted (empty) so a leaving toast can
 * play its exit, as LtToastHost does. Not live: the list's polite line
 * already said it.
 */
export function ListUndoToast({
  undo,
  onUndo,
  onFocus,
  onBlur,
}: {
  undo: ListUndo | null;
  onUndo: () => void;
  /** Undo has keyboard focus: the 8 s are held (useNumberList). */
  onFocus: () => void;
  onBlur: () => void;
}) {
  const insets = useSafeAreaInsets();
  const text = undo ? (undo.all ? L.cleared(undo.rows.length) : L.removed(undo.rows[0].number)) : "";
  return (
    <View style={[styles.undoHost, { top: insets.top + TOAST_TOP }]} pointerEvents="box-none">
      {undo ? (
        <UndoToast
          key={undo.id}
          text={text}
          spoken={speakNumbers(text)}
          undoLabel={undoLabelOf(undo)}
          onUndo={onUndo}
          onFocus={onFocus}
          onBlur={onBlur}
          style={styles.undoToast}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** `.lt-lcard__head`: at least 40 tall, the heading left, Clear all right. */
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40 },
  title: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, minWidth: 0 },
  titleText: { flexShrink: 1 },
  /** The ghost button's own padding lines its word up with the card's edge (board margin-right −8). */
  clear: { marginRight: -8 },
  count: { marginTop: 2 },
  /** The sheet's list: hairlines above, between and below the rows. */
  list: { marginTop: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: LT.line },
  total: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginTop: 12 },
  totalLabel: { flexShrink: 1 },
  wallet: { marginTop: 8 },
  empty: { marginTop: 4 },
  /** LtToastHost's place: full width, 16 in from each side, over the tabs (zIndex 70). */
  undoHost: { position: "absolute", left: 0, right: 0, zIndex: 70, alignItems: "center", paddingHorizontal: 16 },
  /** The toast's own width (its line flexes): the whole host, at most 420 like LtToast. */
  undoToast: { width: "100%", maxWidth: 420 },
});
