import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { LtText } from "@/lottery/components/LtText";
import { Guilloche } from "@/lottery/components/Ornaments";
import { LT } from "@/lottery/theme/tokens";

/**
 * The page head of My tickets, Results and Lottery history (boards
 * `tk-head` / `hs-head` / `lt-pagehead`): the page title (Literata 26), an
 * optional ink-2 line under it (My tickets has none: owner, 27 Oct 2026), and
 * — Tickets and History — the guilloche band in the top-right corner (200 ×
 * 48, drawn 360 wide and clipped, 6 above the head and out into the right
 * gutter). Shared by group C's three pages so their heads cannot drift apart.
 */
export const PageHead = memo(function PageHead({
  title,
  sub,
  guilloche = false,
}: {
  title: string;
  sub?: string;
  guilloche?: boolean;
}) {
  return (
    <View>
      {/* Drawn first, so the title and the line sit on top of the hairlines. */}
      {guilloche ? <Guilloche width={200} height={48} pathWidth={360} style={styles.band} /> : null}
      <View style={styles.titleRow}>
        <LtText role="h" accessibilityRole="header">
          {title}
        </LtText>
      </View>
      {sub ? (
        <LtText role="meta" color={LT.ink2} style={styles.sub}>
          {sub}
        </LtText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  band: { position: "absolute", top: -6, right: -16 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sub: { marginTop: 4 },
});
