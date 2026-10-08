import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressScale } from "@/components/wallet/PressScale";
import { ROW_INSET } from "@/hooks/useWalletLayout";
import { theme } from "@/theme";

export interface TabOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: readonly TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the tab list for a screen reader. */
  accessibilityLabel: string;
  /**
   * "chips" (default) — the wallet's recent list: 34pt chips on the raised
   * fill, the picked one white (Wallet.dc.html).
   * "segmented" — History: one #1C1C23 track, radius 12, the picked segment
   * white (WalletHistory.dc.html).
   */
  appearance?: "chips" | "segmented";
}

/**
 * The wallet's ledger tabs (All / Deposit / Withdrawal). The name is
 * historical — they were underline tabs before Marquee — and kept so no
 * import changes. Either look gives every tab a 44pt target, a tab role and a
 * selected state, and a long label (Burmese at large text sizes) wraps inside
 * its tab rather than being cut; the chips wrap onto a second row instead of
 * running off the edge.
 */
function UnderlineTabsImpl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  appearance = "chips",
}: Props<T>) {
  const segmented = appearance === "segmented";
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={segmented ? styles.track : styles.chipRow}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressScale
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={segmented ? styles.segmentTarget : styles.chipTarget}
          >
            <View
              style={[
                segmented ? styles.segment : styles.chip,
                selected ? styles.selected : segmented ? null : styles.chipRest,
              ]}
            >
              <ThemedText
                variant="muted"
                weight={selected ? "extrabold" : "semibold"}
                style={[
                  styles.label,
                  { color: selected ? theme.colors.onPlay : segmented ? theme.colors.textMuted : theme.colors.text },
                ]}
              >
                {option.label}
              </ThemedText>
            </View>
          </PressScale>
        );
      })}
    </View>
  );
}

export const UnderlineTabs = memo(UnderlineTabsImpl) as typeof UnderlineTabsImpl;

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: theme.spacing.sm,
    paddingHorizontal: ROW_INSET,
  },
  /** The 34pt chip inside a 44pt target. */
  chipTarget: { minHeight: theme.layout.minTouch, justifyContent: "center", maxWidth: "100%" },
  chip: {
    minHeight: 34,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.xl,
    justifyContent: "center",
  },
  chipRest: { backgroundColor: theme.colors.surfaceElevated },
  selected: { backgroundColor: theme.colors.play },
  track: {
    flexDirection: "row",
    gap: 2,
    padding: 2,
    marginHorizontal: ROW_INSET,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceElevated,
  },
  segmentTarget: { flex: 1 },
  segment: {
    flex: 1,
    minHeight: theme.layout.minTouch,
    paddingHorizontal: 6,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { textAlign: "center" },
});
