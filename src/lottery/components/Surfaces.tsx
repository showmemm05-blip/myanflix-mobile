import { memo, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LtIcon, type LtIconName } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { LT, LT_RADIUS, LT_SHADOW, LT_SPACE } from "@/lottery/theme/tokens";

export type LtCardTone = "default" | "flat" | "gold" | "cream" | "flush";

/**
 * A white card (lt-base 6.10): 1pt line, radius 10, the soft card shadow,
 * padding 16. flat = the row shadow · gold = a result card's gold line ·
 * cream = a cream inset with no shadow · flush = no padding, children clipped
 * (lists and draw groups).
 */
export const LtCard = memo(function LtCard({
  tone = "default",
  children,
  style,
  accessibilityLabel,
}: {
  tone?: LtCardTone;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <View style={[styles.card, TONE[tone], style]} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
});

/** The shadow lives in each tone (never set then unset), so a cream card simply has none. */
const TONE: Record<LtCardTone, ViewStyle> = {
  default: { boxShadow: LT_SHADOW.s2 },
  flat: { boxShadow: LT_SHADOW.s1 },
  gold: { borderColor: LT.goldLine, boxShadow: LT_SHADOW.s2 },
  cream: { backgroundColor: LT.cream },
  flush: { padding: 0, overflow: "hidden", boxShadow: LT_SHADOW.s2 },
};

export type LtNoteKind = "info" | "ok" | "warn" | "plain";

const NOTE: Record<LtNoteKind, { bg: string; border: string; icon: LtIconName; iconInk: string }> = {
  info: { bg: LT.indigoTint, border: LT.indigoPress, icon: "info", iconInk: LT.indigo },
  ok: { bg: LT.okTint, border: LT.okLine, icon: "check", iconInk: LT.ok },
  warn: { bg: LT.warnTint, border: LT.warnLine, icon: "alert", iconInk: LT.warn },
  plain: { bg: LT.mist, border: LT.line, icon: "info", iconInk: LT.ink2 },
};

/**
 * A note box (lt-base 6.3): icon 16 + text 14/20 ink-2 on a tint. `children`
 * may be a string or LtText runs (a bold lead: `<LtText role="metaB">…`).
 * Pass `icon` to change the glyph (paused uses `pause`, closed `lock`).
 */
export const LtNote = memo(function LtNote({
  kind = "plain",
  icon,
  children,
  style,
  live,
}: {
  kind?: LtNoteKind;
  icon?: LtIconName;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Announce changes politely (a status line that appears after an action). */
  live?: boolean;
}) {
  const spec = NOTE[kind];
  return (
    <View
      style={[styles.note, { backgroundColor: spec.bg, borderColor: spec.border }, style]}
      accessibilityLiveRegion={live ? "polite" : undefined}
    >
      <View style={styles.noteIcon}>
        <LtIcon name={icon ?? spec.icon} size={16} color={spec.iconInk} />
      </View>
      <View style={styles.noteBody}>
        {typeof children === "string" ? (
          <LtText role="meta" color={LT.ink2}>
            {children}
          </LtText>
        ) : (
          children
        )}
      </View>
    </View>
  );
});

export type LtHelpKind = "plain" | "info" | "ok" | "warn" | "err" | "tap";

const HELP: Record<LtHelpKind, { icon: LtIconName | null; ink: string; strong: boolean }> = {
  plain: { icon: null, ink: LT.ink3, strong: false },
  info: { icon: "info", ink: LT.ink2, strong: false },
  ok: { icon: "check", ink: LT.ok, strong: true },
  warn: { icon: "alert", ink: LT.warn, strong: true },
  err: { icon: "alert", ink: LT.err, strong: true },
  /** An invitation (Draw board `lt-help--tap`): indigo, semibold, with the pointing hand. */
  tap: { icon: "tap", ink: LT.indigo, strong: true },
};

/**
 * A help / validation line under a field (lt-base 6.6): 12/16, icon 16; ok,
 * warn, err and tap are semibold in their colour. `spoken` replaces the visible
 * text for screen readers (a number read digit by digit).
 */
export const LtHelp = memo(function LtHelp({
  kind = "plain",
  text,
  spoken,
  icon,
  live,
  style,
}: {
  kind?: LtHelpKind;
  text: string;
  spoken?: string;
  icon?: LtIconName;
  /** Announce changes politely (the number window's help line). */
  live?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const spec = HELP[kind];
  const glyph = icon ?? spec.icon;
  return (
    <View
      style={[styles.help, style]}
      accessible
      accessibilityLabel={spoken ?? text}
      accessibilityLiveRegion={live ? "polite" : undefined}
    >
      {glyph ? <LtIcon name={glyph} size={16} color={spec.ink} /> : null}
      <LtText role={spec.strong ? "micro" : "caption"} color={spec.ink} style={styles.helpText}>
        {text}
      </LtText>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    padding: LT_SPACE.cardPad,
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: LT_RADIUS.input,
  },
  noteIcon: { marginTop: 2 },
  noteBody: { flex: 1, minWidth: 0 },
  help: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  helpText: { flex: 1 },
});
