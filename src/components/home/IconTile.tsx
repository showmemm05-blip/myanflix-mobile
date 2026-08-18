import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/theme";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  /** Role colour the tile is tinted with — gold for offers, violet for actions. */
  tone: string;
  style?: StyleProp<ViewStyle>;
}

/** One geometry, one pair of alphas. Change them here or nowhere. */
const SIZE = 44;
const FILL_ALPHA = "22";
const BORDER_ALPHA = "33";

/**
 * The tinted square that marks an advertising block — the offer ticket, each
 * campaign card, the browse bar. It exists so the page has ONE of these rather
 * than four hand-rolled ones at three sizes with four different alpha suffixes
 * for the same visual idea.
 *
 * Deliberately NOT used by the roadmap's status marker (a circular rail dot
 * whose colour is data, not a role) or by SectionHeader's 30pt editorial tile —
 * those are different objects, and editorial marks are supposed to sit a step
 * quieter than advertising ones.
 */
export function IconTile({ icon, tone, style }: Props) {
  return (
    <View
      style={[styles.tile, { backgroundColor: tone + FILL_ALPHA, borderColor: tone + BORDER_ALPHA }, style]}
      pointerEvents="none"
    >
      <Ionicons name={icon} size={20} color={tone} accessible={false} importantForAccessibility="no-hide-descendants" />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: SIZE,
    height: SIZE,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
