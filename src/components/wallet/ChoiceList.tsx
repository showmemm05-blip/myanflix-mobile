import { Fragment } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { MethodLogo } from "@/components/wallet/MethodLogo";
import { ROW_INSET } from "@/hooks/useWalletLayout";
import { theme, withAlpha } from "@/theme";

const TILE = 44;
const TILE_GAP = 14;
const RADIO = 22;

export interface ChoiceOption {
  key: string;
  title: string;
  /** Quiet second line — the account holder and number, for instance. */
  subtitle?: string;
  /** Present (even null) = the row leads with a method logo tile. */
  logoUrl?: string | null;
  /** A bank account: with no logo, its tile shows a bank glyph rather than initials. */
  bank?: boolean;
  /** What a screen reader says for the row; defaults to title + subtitle. */
  accessibilityLabel?: string;
  /** Extra screen-reader actions on the row (e.g. "copy"), reported to `onAction`. */
  actions?: { name: string; label: string }[];
  onAction?: (name: string) => void;
}

interface Props {
  options: readonly ChoiceOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Names the group for a screen reader ("Send To", "Status"). */
  accessibilityLabel: string;
  /**
   * "rows" (default) — Deposit's Send To list: 72pt rows with a 44pt logo
   * tile, a 15pt title and a quiet sub-line. "options" — a picker sheet's
   * plain 56pt rows (History's filters): a 16pt label that turns ExtraBold
   * when picked, hairlines across the full width.
   */
  appearance?: "rows" | "options";
}

/**
 * A single-choice list in the wallet's row language: one row per option with
 * a radio on the right — a crimson disc with a white dot when picked, a 2pt
 * ring when not — and hairlines between rows, no box around them. Rows run
 * edge to edge of their column and pad themselves, so the tap target is the
 * whole row. Each row is one radio to a screen reader. Titles and subtitles
 * wrap rather than being cut: an account number must be read in full.
 */
export function ChoiceList({ options, selectedKey, onSelect, accessibilityLabel, appearance = "rows" }: Props) {
  const plain = appearance === "options";
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option, index) => {
        const selected = option.key === selectedKey;
        const hasLogo = option.logoUrl !== undefined;
        return (
          <Fragment key={option.key}>
            {index > 0 ? (
              <View style={[styles.divider, hasLogo && !plain ? styles.dividerInset : styles.dividerFull]} />
            ) : null}
            <Pressable
              onPress={() => onSelect(option.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={
                option.accessibilityLabel ?? [option.title, option.subtitle].filter(Boolean).join(", ")
              }
              accessibilityActions={option.actions}
              onAccessibilityAction={
                option.onAction ? (event) => option.onAction?.(event.nativeEvent.actionName) : undefined
              }
              style={({ pressed }) => [styles.row, plain && styles.rowPlain, pressed && styles.pressed]}
            >
              {hasLogo ? (
                <MethodLogo logoUrl={option.logoUrl} label={option.title} bank={option.bank} size={TILE} />
              ) : null}
              <View style={styles.text}>
                <ThemedText
                  weight={plain ? (selected ? "extrabold" : "medium") : "bold"}
                  style={plain ? styles.titlePlain : undefined}
                >
                  {option.title}
                </ThemedText>
                {option.subtitle ? (
                  <ThemedText variant="caption" weight="regular" tabular style={styles.subtitle}>
                    {option.subtitle}
                  </ThemedText>
                ) : null}
              </View>
              <View style={[styles.radio, selected ? styles.radioOn : styles.radioOff]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

/** Deposit's Send To list while the accounts load: three rows' silhouettes. */
export function ChoiceListSkeleton() {
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {(["40%", "34%", "48%"] as const).map((width, index) => (
        <View key={index} style={[styles.row, styles.skeletonRow]}>
          <Skeleton width={TILE} height={TILE} radius="lg" />
          <View style={styles.skeletonText}>
            <Skeleton width={width} height={12} />
            <Skeleton width="62%" height={10} />
          </View>
          <Skeleton width={RADIO} height={RADIO} radius="pill" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: TILE_GAP,
    minHeight: 72,
    paddingVertical: 12,
    paddingHorizontal: ROW_INSET,
  },
  rowPlain: { minHeight: 56, paddingVertical: theme.spacing.sm, gap: 12 },
  pressed: { backgroundColor: withAlpha(theme.colors.text, 0.04) },
  text: { flex: 1, gap: 2 },
  titlePlain: { fontSize: 16 },
  subtitle: { color: theme.colors.textFaint },
  radio: {
    width: RADIO,
    height: RADIO,
    borderRadius: RADIO / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { backgroundColor: theme.colors.primary },
  radioOff: { borderWidth: 2, borderColor: withAlpha(theme.colors.text, 0.32) },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.onPrimary },
  divider: { height: 1, backgroundColor: theme.colors.border },
  /** Under the text column (past the logo tile), stopping at the column's text edge. */
  dividerInset: { marginLeft: ROW_INSET + TILE + TILE_GAP, marginRight: ROW_INSET },
  /** A picker's rows: the hairline spans the text column edge to edge. */
  dividerFull: { marginHorizontal: ROW_INSET },
  skeletonRow: { minHeight: 72 },
  skeletonText: { flex: 1, gap: 8 },
});
