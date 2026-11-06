import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { LtIcon, type LtIconName } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { LtEmblem } from "@/lottery/components/Ornaments";
import { LT_COPY } from "@/lottery/copy";
import { LT } from "@/lottery/theme/tokens";

export type FooterLine = string | { icon: LtIconName; text: string };

/**
 * Every Lottery page ends with this (lt-base `.lt-foot`): a hairline, the
 * emblem + "Play for fun and only spend what you can afford.", any extra
 * lines a page passes (none today; the Home board has only the play line), and
 * a last line saying what is real: `liveLine` — "Draws, tickets, results and prizes
 * are real · Prizes are paid into your wallet" by default.
 *
 * The help / terms / "Back to Lottery" links went with the old Home (22 Oct
 * 2026): no board has them any more, and the top bar's "‹ Lottery" is the
 * way out.
 */
export const LotteryFooter = memo(function LotteryFooter({
  lines,
  liveLine = LT_COPY.footer.live,
}: {
  lines?: readonly FooterLine[];
  liveLine?: string;
}) {
  return (
    <View style={styles.foot}>
      <View style={styles.line}>
        <LtEmblem size={16} />
        <LtText role="caption" style={styles.lineText}>
          {LT_COPY.footer.play}
        </LtText>
      </View>
      {lines?.map((line) => {
        const text = typeof line === "string" ? line : line.text;
        const icon = typeof line === "string" ? "info" : line.icon;
        return (
          <View key={text} style={styles.line}>
            <LtIcon name={icon} size={16} color={LT.ink3} />
            <LtText role="caption" style={styles.lineText}>
              {text}
            </LtText>
          </View>
        );
      })}
      <View style={styles.line}>
        <LtIcon name="info" size={16} color={LT.ink3} />
        <LtText role="micro" color={LT.ink2} style={styles.lineText}>
          {liveLine}
        </LtText>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  foot: { paddingTop: 20, gap: 8, borderTopWidth: 1, borderTopColor: LT.line },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  lineText: { flex: 1 },
});
