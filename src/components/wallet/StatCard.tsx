import { StyleSheet } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { StatTile, type StatTileTone } from "@/components/common/StatTile";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  /** Role colour for the icon + value — gold for premium, emerald for money… */
  tone?: StatTileTone;
}

/**
 * Wallet/profile summary number. Thin wrapper over the shared StatTile so the
 * money screens and the rest of the app use one tile, while keeping this
 * component's existing (icon, label, value) call signature.
 */
export function StatCard({ icon, label, value, tone = "primary" }: Props) {
  return <StatTile icon={icon} label={label} value={value} tone={tone} style={styles.fill} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
