import { memo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LtIcon, type LtIconName } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { LT_COPY } from "@/lottery/copy";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";

export type StatusKind =
  | "scheduled"
  | "open"
  | "paused"
  | "closed"
  | "published"
  | "waiting"
  | "won"
  | "notwon"
  | "paid"
  | "failed"
  /* Where a won ticket's prize payment stands (PrizeClaim board, 24 Oct 2026): the second chip on a won row. */
  | "requestPayment"
  | "requested"
  | "rejected"
  | "expired";

const PILL: Record<StatusKind, { icon: LtIconName; ink: string; fill: string; edge?: string }> = {
  /** A draw set up but not on sale yet (phase 2): the waiting look, since nothing can be bought. */
  scheduled: { icon: "clock", ink: LT.ink2, fill: LT.cream2 },
  open: { icon: "unlock", ink: LT.ok, fill: LT.okTint },
  paused: { icon: "pause", ink: LT.warn, fill: LT.warnTint },
  closed: { icon: "lock", ink: LT.ink2, fill: LT.mist },
  published: { icon: "check", ink: LT.indigo, fill: LT.indigoTint },
  waiting: { icon: "clock", ink: LT.ink2, fill: LT.cream2 },
  won: { icon: "results", ink: LT.ink, fill: LT.gold, edge: LT.goldEdge },
  notwon: { icon: "notwon", ink: LT.ink3, fill: LT.mist },
  paid: { icon: "check", ink: LT.ok, fill: LT.okTint },
  failed: { icon: "alert", ink: LT.err, fill: LT.errTint },
  /** Not requested yet: the indigo "published" look with the wallet glyph (board `lt-pill--published` + ICON.wallet). */
  requestPayment: { icon: "wallet", ink: LT.indigo, fill: LT.indigoTint },
  /** Waiting for the admin: the waiting look. */
  requested: { icon: "clock", ink: LT.ink2, fill: LT.cream2 },
  /** The admin refused it: the failed look with a circled × (board ICON.cross). */
  rejected: { icon: "crossCircle", ink: LT.err, fill: LT.errTint },
  /** The claim deadline passed: the closed look. */
  expired: { icon: "lock", ink: LT.ink2, fill: LT.mist },
};

/**
 * A status as icon + word, never colour alone (spec rule 5): 26 tall, round,
 * Franklin 12/16 700. Gold only for Won. Read as its word.
 */
export const StatusPill = memo(function StatusPill({
  kind,
  label,
  style,
}: {
  kind: StatusKind;
  /** Overrides the word (rare: the spec's words are in LT_COPY.pills). */
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const spec = PILL[kind];
  return (
    <View
      style={[styles.pill, { backgroundColor: spec.fill, borderColor: spec.edge ?? "transparent" }, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label ?? LT_COPY.pills[kind]}
    >
      <LtIcon name={spec.icon} size={14} color={spec.ink} />
      <LtText role="microB" color={spec.ink} numberOfLines={1}>
        {label ?? LT_COPY.pills[kind]}
      </LtText>
    </View>
  );
});

/** A small cream chip ("2 of 3", "New"): 24 tall, Franklin 12/16 600, tabular. */
export const LtChip = memo(function LtChip({
  text,
  tone = "cream",
  style,
}: {
  text: string;
  /** "new": the ok-tinted New chip on a just-bought ticket. */
  tone?: "cream" | "new";
  style?: StyleProp<ViewStyle>;
}) {
  const fresh = tone === "new";
  return (
    <View style={[styles.chip, fresh && styles.chipNew, style]}>
      <LtText role="micro" tabular color={fresh ? LT.ok : LT.ink2} numberOfLines={1}>
        {text}
      </LtText>
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    // A minimum, not a fixed height: at a large OS text size the word grows the pill instead of being cut.
    minHeight: 26,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: LT_RADIUS.round,
    borderWidth: 1,
  },
  chip: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: LT_RADIUS.tag,
    backgroundColor: LT.cream,
    borderWidth: 1,
    borderColor: LT.line,
  },
  chipNew: { backgroundColor: LT.okTint, borderColor: LT.okLine },
});
