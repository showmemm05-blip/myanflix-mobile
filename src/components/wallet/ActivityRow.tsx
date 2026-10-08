import { memo } from "react";
import { StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { StatusLabel, type RowStatus } from "@/components/wallet/StatusLabel";
import { ROW_INSET } from "@/hooks/useWalletLayout";
import { theme, withAlpha } from "@/theme";
import type { RowPosition } from "@/utils/walletDates";

const TILE = 44;
const TILE_RADIUS = 14;
const TILE_GAP = 14;
/** Dividers start under the text column (58pt past the text edge) and stop at the text edge. */
const DIVIDER_LEFT = ROW_INSET + TILE + TILE_GAP;

/**
 * The tile's tint: the role colour at 14%, a little stronger for the two
 * warm roles the board lifts (a purchase's crimson 18%, a subscription's gold 16%).
 */
function tintFor(tone: string): string {
  if (tone === theme.colors.primary) return withAlpha(tone, 0.18);
  if (tone === theme.colors.premium) return withAlpha(tone, 0.16);
  return withAlpha(tone, 0.14);
}

interface Props {
  /** The row's kind as a glyph, on a rounded-square tile tinted with `tone`. */
  icon: keyof typeof Ionicons.glyphMap;
  /** The money role of the row — tints the tile, and draws the glyph unless `ink` does. */
  tone: string;
  /** The glyph's own colour, when it differs from the tile's tint (purchases). */
  ink?: string;
  title: string;
  subtitle: string;
  amountText: string;
  amountColor: string;
  status?: { status: RowStatus; label: string } | null;
  /** A rejection reason, under everything, in the danger role. */
  note?: string | null;
  position: RowPosition;
  /** Small phones / large text: the amount and status move under the title instead of beside it. */
  stacked: boolean;
  /** The whole row is read as one element, in the order the mapper composes. */
  accessibilityLabel: string;
}

const hasDividerAbove = (position: RowPosition) => position === "middle" || position === "last";

/**
 * One wallet row — a ledger entry, a deposit request or a withdrawal request.
 * It owns the layout and nothing of either domain: the mappers (TransactionRow,
 * DepositRow, WithdrawalRow) turn their vocabulary into these props.
 *
 * Flat on the page (Marquee's Wallet board): a 72pt row with a 44pt tinted
 * icon tile, a 15pt Bold title and a quiet sub-line, the ExtraBold amount and
 * its status on the right, and inset hairlines between the rows of one day —
 * no card around them, which is what keeps a long history calm. Not a
 * button: nothing happens on tap, so it is not announced as one. The amount
 * wraps rather than being cut.
 */
export const ActivityRow = memo(function ActivityRow({
  icon,
  tone,
  ink,
  title,
  subtitle,
  amountText,
  amountColor,
  status,
  note,
  position,
  stacked,
  accessibilityLabel,
}: Props) {
  const label = status ? <StatusLabel status={status.status} label={status.label} /> : null;
  const amount = (
    <ThemedText weight="extrabold" tabular style={[styles.amount, { color: amountColor }]}>
      {amountText}
    </ThemedText>
  );

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.row}>
      {hasDividerAbove(position) ? <View style={styles.divider} /> : null}
      <View style={styles.main}>
        <View style={[styles.tile, stacked && styles.tileTop, { backgroundColor: tintFor(tone) }]}>
          <Ionicons name={icon} size={20} color={ink ?? tone} />
        </View>
        <View style={styles.body}>
          {/* Wraps in full: a long film title is what the row is about. */}
          <ThemedText weight="bold">
            {title}
          </ThemedText>
          <ThemedText
            variant="caption"
            weight="regular"
            tabular
            numberOfLines={stacked ? 2 : 1}
            style={styles.subtitle}
          >
            {subtitle}
          </ThemedText>
          {stacked ? (
            <View style={styles.stackedFooter}>
              {amount}
              {label}
            </View>
          ) : null}
        </View>
        {stacked ? null : (
          <View style={styles.right}>
            {amount}
            {label}
          </View>
        )}
      </View>
      {note ? (
        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={14} color={theme.colors.danger} style={styles.noteIcon} />
          <ThemedText variant="caption" weight="regular" style={styles.noteText}>
            {note}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
});

interface SkeletonProps {
  position: RowPosition;
  fontScale: number;
}

/** A resting row's silhouette, at its own height for the current text size. */
export function ActivityRowSkeleton({ position, fontScale }: SkeletonProps) {
  return (
    <View style={[styles.row, styles.skeletonRow, { minHeight: Math.round(72 * Math.min(fontScale, 1.4)) }]}>
      {hasDividerAbove(position) ? <View style={styles.divider} /> : null}
      <Skeleton width={TILE} height={TILE} radius="lg" />
      <View style={styles.skeletonBody}>
        <Skeleton width="62%" height={12} />
        <Skeleton width="38%" height={10} />
      </View>
      <Skeleton width={72} height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    paddingHorizontal: ROW_INSET,
    paddingVertical: 14,
    justifyContent: "center",
  },
  divider: {
    position: "absolute",
    top: 0,
    left: DIVIDER_LEFT,
    right: ROW_INSET,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  main: { flexDirection: "row", alignItems: "center", gap: TILE_GAP },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: TILE_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  /** Stacked rows are taller than the tile; it stays beside the title instead of floating mid-row. */
  tileTop: { alignSelf: "flex-start" },
  body: { flex: 1, gap: 2 },
  subtitle: { color: theme.colors.textFaint },
  right: { minWidth: 88, maxWidth: "45%", alignItems: "flex-end", gap: 2 },
  amount: { textAlign: "right" },
  stackedFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: theme.spacing.sm,
    rowGap: 2,
    marginTop: theme.spacing.xs,
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: theme.spacing.sm,
    paddingLeft: TILE + TILE_GAP,
  },
  noteIcon: { marginTop: 2 },
  noteText: { flex: 1, color: theme.colors.danger },
  skeletonRow: { flexDirection: "row", alignItems: "center", gap: TILE_GAP },
  skeletonBody: { flex: 1, gap: 8 },
});
