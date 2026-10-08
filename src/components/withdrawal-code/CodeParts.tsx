import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { BusyDots } from "@/components/ui/BusyDots";
import { PressScale } from "@/components/wallet/PressScale";
import { CodeGlyph, type CodeGlyphName } from "@/components/withdrawal-code/CodeGlyph";
import { theme, withAlpha } from "@/theme";

/**
 * The small pieces every withdrawal-code screen shares, drawn to the boards
 * (CreateCode, ConfirmCode, EnterCode, ForgotCode, ChangeCode .dc.html).
 */

export type CodeStatus =
  | { tone: "error"; text: string }
  | { tone: "hint"; text: string }
  | { tone: "ok"; text: string }
  | null;

/**
 * The line under the dots: a refusal in red with its alert mark, a quiet
 * hint, or a green "Looks good" with a tick. It always keeps its 20pt so the
 * page does not jump when a message comes or goes. Announcing is the
 * caller's job (it knows when a message is new).
 */
export function CodeStatusLine({ status, style }: { status: CodeStatus; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.statusBox, style]}>
      {status ? (
        <View style={styles.statusRow}>
          {status.tone === "error" ? <CodeGlyph name="alert" size={18} color={theme.colors.danger} /> : null}
          {status.tone === "ok" ? <CodeGlyph name="check" size={18} color={theme.colors.success} /> : null}
          <ThemedText
            variant="muted"
            weight={status.tone === "hint" ? "regular" : "semibold"}
            tabular
            style={[
              styles.statusText,
              status.tone === "error" && styles.statusError,
              status.tone === "ok" && styles.statusOk,
            ]}
          >
            {status.text}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

interface LinkProps {
  title: string;
  onPress: () => void;
  glyph?: CodeGlyphName;
  /** Grey and inert — the resend countdown. */
  muted?: boolean;
  disabled?: boolean;
  /** Working on it: three dots in place of the words, which a screen reader still hears. */
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The boards' quiet actions under the dots — "Forgot code?", "Start over",
 * "Send a new code" — crimson-link words in 15/22 ExtraBold, 44pt tall with
 * 12pt either side; the countdown is the same row in grey, inert.
 */
export function CodeLink({ title, onPress, glyph, muted, disabled, busy, style }: LinkProps) {
  const inert = muted || disabled || busy;
  const ink = muted ? theme.colors.textFaint : theme.colors.link;
  return (
    <PressScale
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!inert, busy: !!busy }}
      style={[styles.link, disabled && !muted && styles.linkDisabled, style]}
    >
      {busy ? (
        <BusyDots color={ink} size={7} />
      ) : (
        <>
          {glyph ? <CodeGlyph name={glyph} size={18} color={ink} /> : null}
          <ThemedText weight={muted ? "bold" : "extrabold"} tabular style={[styles.linkText, { color: ink }]}>
            {title}
          </ThemedText>
        </>
      )}
    </PressScale>
  );
}

/** The crimson-tinted disc over a code page's title (56pt), or the sheet's (48pt); red with a timer while locked. */
export function CodeDisc({ glyph, size, danger }: { glyph: CodeGlyphName; size: 56 | 48; danger?: boolean }) {
  const tone = danger ? theme.colors.danger : theme.colors.link;
  const fill = danger ? withAlpha(theme.colors.danger, 0.14) : withAlpha(theme.colors.primary, 0.14);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: fill }]}
    >
      <CodeGlyph name={glyph} size={size === 56 ? 28 : 24} color={tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  statusBox: { minHeight: 20, alignSelf: "stretch", alignItems: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm, maxWidth: "100%" },
  statusText: { flexShrink: 1, textAlign: "center", color: theme.colors.textFaint },
  statusError: { color: theme.colors.danger },
  statusOk: { color: theme.colors.success },
  link: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    minHeight: theme.layout.minTouch,
    maxWidth: "100%",
    paddingHorizontal: 12,
  },
  linkDisabled: { opacity: 0.45 },
  linkText: { flexShrink: 1, fontSize: 15, lineHeight: 22, textAlign: "center" },
  disc: { alignItems: "center", justifyContent: "center" },
});
