import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { BusyDots } from "@/components/wallet/BusyDots";
import { PressScale } from "@/components/wallet/PressScale";
import type { ActivitySegment } from "@/components/wallet/RecentActivity";
import { TextAction } from "@/components/wallet/TextAction";
import { ROW_INSET, useWalletLayout } from "@/hooks/useWalletLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { rangeStartIso } from "@/utils/walletDates";
import type { LedgerStatusFilter, LedgerTypeGroup } from "@/utils/walletFilters";
import { theme } from "@/theme";

type RangeKey = "all" | "7" | "30" | "90";
type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
/** Ledger statuses are lowercase keys, request statuses the server's enum — the two never collide. */
type HistoryStatus = LedgerStatusFilter | RequestStatus;

export interface SegmentFilters {
  status: HistoryStatus;
  range: RangeKey;
  /** Start of the picked range, fixed when it was picked (never recomputed in render). */
  since: string | null;
  /** Ledger ("All") only. */
  typeGroup: LedgerTypeGroup;
}

export const NO_FILTERS: SegmentFilters = { status: "all", range: "all", since: null, typeGroup: "all" };

const RANGE_DAYS: Record<Exclude<RangeKey, "all">, number> = { "7": 7, "30": 30, "90": 90 };

const REQUEST_STATUSES: readonly HistoryStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export function isRequestStatus(status: HistoryStatus): status is RequestStatus {
  return REQUEST_STATUSES.includes(status);
}

/** How many filters are set (search is not one — it has its own clear button). */
export function activeFilterCount(segment: ActivitySegment, value: SegmentFilters): number {
  return (
    (value.status !== "all" ? 1 : 0) +
    (value.range !== "all" ? 1 : 0) +
    (segment === "all" && value.typeGroup !== "all" ? 1 : 0)
  );
}

export type FilterGroupKey = "status" | "range" | "type";

interface Option {
  value: string;
  label: string;
}

export interface FilterGroup {
  key: FilterGroupKey;
  title: string;
  options: readonly Option[];
  selected: string;
  /** What the phone's text button says: the picked option, or "Any status" / "All time" / "Any type" while it is "all". */
  buttonLabel: string;
  /** The filters with `next` picked in this group (a range's start is fixed here, at pick time). */
  pick: (next: string) => SegmentFilters;
}

/**
 * Every filter group for a segment — Status, Date and (on the ledger) Type —
 * with its options, what is picked, and how picking changes the filters. One
 * source for the phone's text buttons + picker sheet and the tablet's inline
 * groups, so they can never disagree.
 */
export function useFilterGroups(segment: ActivitySegment, value: SegmentFilters): FilterGroup[] {
  const { t } = useLanguage();
  return useMemo(() => {
    const all = t.wallet.filterAll;
    const labelOf = (options: readonly Option[], selected: string) =>
      options.find((option) => option.value === selected)?.label ?? selected;

    const statusOptions: Option[] =
      segment === "all"
        ? [
            { value: "all", label: all },
            { value: "completed", label: t.wallet.filterCompleted },
            { value: "pending", label: t.wallet.transactionStatus.pending },
            { value: "failedRefunded", label: t.wallet.filterFailedRefunded },
          ]
        : [
            { value: "all", label: all },
            ...(["PENDING", "APPROVED", "REJECTED"] as const).map((status) => ({
              value: status,
              label: (segment === "deposit" ? t.wallet.depositStatus : t.wallet.withdrawStatus)[
                status.toLowerCase() as Lowercase<RequestStatus>
              ],
            })),
          ];
    const rangeOptions: Option[] = [
      { value: "all", label: t.wallet.allTime },
      { value: "7", label: t.wallet.range7 },
      { value: "30", label: t.wallet.range30 },
      { value: "90", label: t.wallet.range90 },
    ];

    const groups: FilterGroup[] = [
      {
        key: "status",
        title: t.wallet.filterStatus,
        options: statusOptions,
        selected: value.status,
        buttonLabel: value.status === "all" ? t.wallet.anyStatus : labelOf(statusOptions, value.status),
        pick: (next) => ({ ...value, status: next as HistoryStatus }),
      },
      {
        key: "range",
        title: t.wallet.filterDate,
        options: rangeOptions,
        selected: value.range,
        buttonLabel: labelOf(rangeOptions, value.range),
        pick: (next) => {
          const range = next as RangeKey;
          return { ...value, range, since: range === "all" ? null : rangeStartIso(RANGE_DAYS[range]) };
        },
      },
    ];

    if (segment === "all") {
      const typeOptions: Option[] = [
        { value: "all", label: all },
        { value: "deposit", label: t.wallet.transactionTypes.deposit },
        { value: "withdrawal", label: t.wallet.transactionTypes.withdrawal },
        { value: "purchase", label: t.wallet.transactionTypes.purchase },
        { value: "subscription", label: t.wallet.transactionTypes.subscription },
        { value: "refund", label: t.wallet.transactionTypes.refund },
        { value: "adjustment", label: t.wallet.filterAdjustment },
      ];
      groups.push({
        key: "type",
        title: t.wallet.filterType,
        options: typeOptions,
        selected: value.typeGroup,
        buttonLabel: value.typeGroup === "all" ? t.wallet.anyType : labelOf(typeOptions, value.typeGroup),
        pick: (next) => ({ ...value, typeGroup: next as LedgerTypeGroup }),
      });
    }
    return groups;
  }, [segment, value, t]);
}

interface Props {
  segment: ActivitySegment;
  value: SegmentFilters;
  onChange: (next: SegmentFilters) => void;
  /** Phones: opens the picker sheet for one group. */
  onOpenFilter: (group: FilterGroupKey) => void;
  /** Clears every filter and the search term. */
  onClear: () => void;
  /**
   * "12 results" / "Showing matches from 30 of 214 loaded"; null until the
   * list has loaded, and while a new filter's results are still on their way
   * (the old count would describe the old filter).
   */
  summary: string | null;
  /**
   * The summary describes a filter or search the user just set, so a screen
   * reader should hear it change; a plain count (switching tabs) stays quiet.
   */
  live: boolean;
  /** Results for a new filter are on their way; the old rows are still showing, dimmed. */
  busy: boolean;
}

/**
 * The History list's filter bar (WalletHistory.dc.html). Phones get one chip
 * per filter — Status · Date (· Type on the ledger) — on a sideways-scrolling
 * row, each opening its picker; a chip with a filter set turns white. Long
 * Burmese labels scroll rather than wrap. Under the chips sits the result
 * summary. Tablets get every group inline as wrapping option chips, plus
 * Clear. While a filter or search is set the summary is a polite live region,
 * so a screen reader hears the new result count.
 */
export function HistoryFilters({ segment, value, onChange, onOpenFilter, onClear, summary, live, busy }: Props) {
  const { t } = useLanguage();
  const { isTablet } = useWalletLayout();
  const groups = useFilterGroups(segment, value);
  const count = activeFilterCount(segment, value);

  const summaryLine =
    summary || busy ? (
      <View style={styles.summary} accessibilityLiveRegion={live ? "polite" : "none"}>
        {summary ? (
          <ThemedText variant="caption" tabular style={styles.summaryText}>
            {summary}
          </ThemedText>
        ) : null}
        {busy ? <BusyDots color={theme.colors.textFaint} size={6} /> : null}
      </View>
    ) : (
      <View style={styles.summary} />
    );

  if (isTablet) {
    return (
      <View style={styles.tablet}>
        {groups.map((group) => (
          <View key={group.key} style={styles.group}>
            <ThemedText variant="caption" weight="bold" accessibilityRole="header" style={styles.groupTitle}>
              {group.title}
            </ThemedText>
            <View style={styles.options}>
              {group.options.map((option) => {
                const selected = option.value === group.selected;
                return (
                  <PressScale
                    key={option.value}
                    onPress={() => onChange(group.pick(option.value))}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={styles.chipTarget}
                  >
                    <View style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}>
                      <ThemedText
                        variant="muted"
                        weight={selected ? "extrabold" : "semibold"}
                        style={{ color: selected ? theme.colors.onPlay : theme.colors.text }}
                      >
                        {option.label}
                      </ThemedText>
                    </View>
                  </PressScale>
                );
              })}
            </View>
          </View>
        ))}
        <View style={styles.tabletFooter}>
          {count > 0 ? (
            <TextAction title={t.wallet.clearFilters} icon="close" onPress={onClear} style={styles.clearButton} />
          ) : null}
          {summaryLine}
        </View>
      </View>
    );
  }

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.rail}
      >
        {groups.map((group) => {
          const active = group.selected !== "all";
          return (
            <PressScale
              key={group.key}
              onPress={() => onOpenFilter(group.key)}
              accessibilityRole="button"
              accessibilityLabel={`${group.title}: ${
                group.options.find((option) => option.value === group.selected)?.label ?? group.buttonLabel
              }`}
              style={styles.chipTarget}
            >
              <View style={[styles.chip, styles.railChip, active ? styles.chipOn : styles.chipOff]}>
                <ThemedText
                  variant="muted"
                  weight={active ? "extrabold" : "semibold"}
                  style={{ color: active ? theme.colors.onPlay : theme.colors.text }}
                >
                  {group.buttonLabel}
                </ThemedText>
                <Ionicons
                  name="chevron-down"
                  size={14}
                  color={active ? theme.colors.onPlay : theme.colors.text}
                />
              </View>
            </PressScale>
          );
        })}
      </ScrollView>
      <View style={styles.summaryRow}>{summaryLine}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingTop: 12,
    paddingHorizontal: ROW_INSET,
  },
  /** The 34pt chip inside a 44pt target. */
  chipTarget: { minHeight: theme.layout.minTouch, justifyContent: "center", maxWidth: "100%" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radius.xl,
  },
  railChip: { paddingRight: 12 },
  chipOn: { backgroundColor: theme.colors.play },
  chipOff: { backgroundColor: theme.colors.surfaceElevated },
  summaryRow: { marginTop: theme.spacing.xs, paddingHorizontal: ROW_INSET },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    minHeight: 32,
  },
  summaryText: { flexShrink: 1, color: theme.colors.textFaint },
  tablet: { gap: theme.spacing.md, paddingTop: theme.spacing.md, paddingHorizontal: ROW_INSET },
  group: { gap: theme.spacing.xs },
  groupTitle: { color: theme.colors.textMuted },
  options: { flexDirection: "row", flexWrap: "wrap", columnGap: theme.spacing.sm },
  tabletFooter: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: theme.spacing.md },
  /** Its text, not its 12pt padding, lines up with the column's text edge. */
  clearButton: { marginLeft: -12 },
});
