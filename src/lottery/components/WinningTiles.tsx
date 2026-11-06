import { memo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { LtText } from "@/lottery/components/LtText";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";

/**
 * A winning number as six gold tiles (lt-base 6.11) — gold is for winning
 * only. md: 60 tall, Literata 34, gap 8 (max 336) · sm: 44 tall, Literata 24,
 * gap 6 (max 264) · lg (Results' latest card): 72 tall, Literata 44, gap 8,
 * the full column. No number yet (the next draw): six dashed empty tiles.
 * Read as ONE label, digit by digit: "Winning number 0 5 8 3 1 4".
 *
 * `tone` (group C, backward compatible — gold stays the default): "mine" is a
 * ticket's OWN number set beside the winning one (TicketView's compare:
 * white tiles, gold edge — the board's `tv-ytile`); "plain" is the same for a
 * ticket that did not win (white, field edge), so no gold touches it.
 */
export const WinningTiles = memo(function WinningTiles({
  number,
  size = "md",
  tone = "gold",
  accessibilityLabel,
  style,
}: {
  number?: string;
  size?: "md" | "sm" | "lg";
  tone?: "gold" | "mine" | "plain";
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const small = size === "sm";
  const large = size === "lg";
  const digits = number ? number.split("") : ["", "", "", "", "", ""];
  const label =
    accessibilityLabel ?? (number ? COMPONENT_COPY.winningTiles.a11y(number) : COMPONENT_COPY.winningTiles.notDrawn);
  return (
    <View
      style={[styles.row, small ? styles.rowSm : large ? styles.rowLg : styles.rowMd, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      {digits.map((digit, i) => (
        <View
          key={i}
          style={[
            styles.tile,
            small ? styles.tileSm : large ? styles.tileLg : styles.tileMd,
            tone === "mine" && styles.mine,
            tone === "plain" && styles.plain,
            !number && styles.empty,
          ]}
        >
          {digit ? (
            <LtText
              role="display"
              style={small ? styles.digitSm : large ? styles.digitLg : styles.digitMd}
              maxFontSizeMultiplier={1}
            >
              {digit}
            </LtText>
          ) : null}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", width: "100%" },
  rowMd: { gap: 8, maxWidth: 336 },
  rowSm: { gap: 6, maxWidth: 264 },
  rowLg: { gap: 8 },
  tile: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.gold,
    borderWidth: 1,
    borderColor: LT.goldEdge,
    borderRadius: LT_RADIUS.input,
  },
  tileMd: { height: 60 },
  tileSm: { height: 44 },
  tileLg: { height: 72 },
  mine: { backgroundColor: LT.white, borderColor: LT.goldEdge },
  plain: { backgroundColor: LT.white, borderColor: LT.field },
  empty: { backgroundColor: "transparent", borderStyle: "dashed", borderColor: LT.field },
  digitMd: { letterSpacing: 0 },
  digitSm: { fontSize: 24, lineHeight: 28, letterSpacing: 0 },
  digitLg: { fontSize: 44, lineHeight: 48, letterSpacing: 0 },
});
