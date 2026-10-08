import { useState } from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { MethodLogo } from "@/components/wallet/MethodLogo";
import { PressScale } from "@/components/wallet/PressScale";
import { ROW_INSET, useWalletLayout } from "@/hooks/useWalletLayout";
import { theme, withAlpha } from "@/theme";
import type { PaymentAccountType } from "@/types/payment-account";

const GAP = theme.spacing.sm;
const LOGO = 36;
const CHECK = 20;
/** Selected: a 2pt crimson ring. Drawn at rest too (clear), so picking a tile never shifts its text. */
const RING = 2;

interface Props {
  types: readonly PaymentAccountType[];
  selected: string | null;
  onSelect: (value: string) => void;
  /** Names the group for a screen reader ("Account Type"). */
  accessibilityLabel: string;
}

/**
 * Withdraw's account types as a grid of selectable tiles (Withdraw.dc.html):
 * a 36pt logo tile, the type's name and, on the picked one, a crimson check —
 * the picked tile tinted crimson with a 2pt ring. Two columns, one on narrow
 * phones and at large text sizes so a name is never squeezed. The same single
 * choice as before: each tile is a radio in one radio group.
 */
export function AccountTypeTiles({ types, selected, onSelect, accessibilityLabel }: Props) {
  const tileWidth = useTileWidth();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.grid}
      onLayout={tileWidth.onLayout}
    >
      {types.map((type) => {
        const on = type.value === selected;
        return (
          <PressScale
            key={type.value}
            onPress={() => onSelect(type.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={type.label}
            style={[styles.tile, { width: tileWidth.width }, on ? styles.tileOn : styles.tileOff]}
          >
            <MethodLogo logoUrl={type.logoUrl} label={type.label} bank={type.requiresBankName} size={LOGO} />
            <ThemedText weight="bold" style={styles.label}>
              {type.label}
            </ThemedText>
            {on ? (
              <View style={styles.check}>
                <Ionicons name="checkmark" size={12} color={theme.colors.onPrimary} />
              </View>
            ) : null}
          </PressScale>
        );
      })}
    </View>
  );
}

/** The grid's silhouette while the account types load. */
export function AccountTypeTilesSkeleton() {
  const tileWidth = useTileWidth();
  return (
    <View
      style={styles.grid}
      onLayout={tileWidth.onLayout}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={{ width: tileWidth.width }}>
          <Skeleton height={64} radius="lg" />
        </View>
      ))}
    </View>
  );
}

/**
 * Each tile's width: half the grid less half the gap (so an odd last tile
 * keeps its column instead of stretching across), or the full width when
 * the layout stacks. Until the grid is measured, a percentage stands in.
 */
function useTileWidth() {
  const { stacked } = useWalletLayout();
  const [gridWidth, setGridWidth] = useState(0);
  const inner = gridWidth - 2 * ROW_INSET;
  let width: DimensionValue = stacked ? "100%" : "47%";
  if (inner > 0) width = stacked ? inner : Math.floor((inner - GAP) / 2);
  return {
    width,
    onLayout: (event: { nativeEvent: { layout: { width: number } } }) => setGridWidth(event.nativeEvent.layout.width),
  };
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, paddingHorizontal: ROW_INSET },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 10 - RING,
    paddingHorizontal: 12 - RING,
    borderRadius: theme.radius.button,
    borderWidth: RING,
  },
  tileOff: { backgroundColor: theme.colors.surfaceElevated, borderColor: "transparent" },
  tileOn: { backgroundColor: withAlpha(theme.colors.primary, 0.14), borderColor: theme.colors.primary },
  label: { flex: 1, fontSize: 15 },
  check: {
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
});
