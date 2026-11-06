import { memo, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { DoubleRule } from "@/lottery/components/Ornaments";
import { StatusPill } from "@/lottery/components/Pills";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";

/**
 * The Won wrapper for a large ticket (lt-base `.lt-ticket-wrap--won` +
 * `.lt-wonbar`): a gold-tint panel with the Won pill and a gold double rule
 * above the paper. Gold is for winning only, and it stays OUTSIDE the paper —
 * the ticket itself never changes.
 */
export const WonFrame = memo(function WonFrame({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.frame, style]}>
      <View style={styles.bar}>
        <StatusPill kind="won" />
        <DoubleRule tone="gold" style={styles.rule} />
      </View>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    padding: 10,
    borderWidth: 1,
    borderColor: LT.goldLine,
    borderRadius: LT_RADIUS.button,
    backgroundColor: LT.goldTint,
  },
  bar: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  rule: { flex: 1 },
});
