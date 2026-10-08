import { Pressable, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { AuthDots } from "@/components/auth/AuthParts";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { onSolid, theme, withAlpha } from "@/theme";

interface Props {
  /** Requests the code by SMS — the caller owns the request and its errors. */
  onSms: () => void;
  /** True while the SMS request is in flight: dots on SMS, every row locked. */
  loading?: boolean;
  disabled?: boolean;
}

/**
 * The "Get your code" step: one row per way of receiving the 6-digit code.
 * Nothing is requested until the user taps a row (owner decision 2026-10-01 —
 * a code is never sent automatically).
 *
 * Only SMS works. Telegram and Viber are shown, disabled, with a "Coming soon"
 * badge, and have NO onPress at all — tapping them can never send anything.
 * POST /auth/otp/request takes only `{ phone, purpose? }` and rejects any other
 * field (the backend's forbidNonWhitelisted — see exactRequestOtpBody in
 * api/auth.api.ts), so when one of them is really wired up, the backend
 * changes first.
 *
 * Marquee rows (LoginCode.dc.html): 64pt, radius 12, a 40pt glyph disc; SMS is
 * the crimson commit row, the others sit on the panel fill. Rows rather than
 * <Button>: Button clips its label to one line, and the Burmese labels need
 * room to wrap beside the badge on a 320pt phone.
 */
export function OtpMethodPicker({ onSms, loading = false, disabled = false }: Props) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const m = t.auth.method;
  const locked = loading || disabled;
  const ink = onSolid(theme.colors.primary);

  return (
    <View style={styles.list}>
      <Pressable
        onPress={onSms}
        disabled={locked}
        style={({ pressed }) => [
          styles.row,
          styles.rowSms,
          loading ? styles.rowBusy : disabled ? styles.rowDisabled : null,
          pressed && !locked && (reduceMotion ? styles.rowPressedStill : styles.rowPressed),
        ]}
        accessibilityRole="button"
        accessibilityLabel={m.sms}
        accessibilityState={{ disabled: locked, busy: loading }}
      >
        <View style={[styles.disc, styles.discSms]}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={ink} />
        </View>
        <ThemedText weight="extrabold" color={ink} style={styles.label}>
          {m.sms}
        </ThemedText>
        {loading ? <AuthDots color={ink} size={6} /> : <Ionicons name="chevron-forward" size={20} color={ink} />}
      </Pressable>

      <ComingSoonRow icon="paper-plane-outline" label={m.telegram} />
      <ComingSoonRow icon="call-outline" label={m.viber} />
    </View>
  );
}

/* ------------------------------------------------------------------ */

function ComingSoonRow({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { t } = useLanguage();
  const m = t.auth.method;

  return (
    // Always disabled and deliberately given no onPress: a tap does nothing.
    <Pressable
      disabled
      style={[styles.row, styles.rowSoon]}
      accessibilityRole="button"
      accessibilityLabel={m.comingSoonA11y.replace("{method}", label)}
      accessibilityState={{ disabled: true }}
    >
      <View style={[styles.disc, styles.discSoon]}>
        {/* Decoration-grade ink on purpose: the row's words carry the meaning. */}
        <Ionicons name={icon} size={19} color={theme.colors.textDecor} />
      </View>
      {/* Label and badge share one line, badge at the end, as on the board.
          When the badge would leave the label less than ~45% of the room (a
          narrow phone at a large font size, Burmese), the badge drops under
          the label instead of squeezing it until words break mid-word. */}
      <View style={styles.soonText}>
        <ThemedText weight="bold" color={theme.colors.textFaint} style={styles.soonLabel}>
          {label}
        </ThemedText>
        {/* caption (13/18), not the board's 12pt: Myanmar at 12pt in a 16pt
            line box clips below-base marks on several Android builds. */}
        <View style={styles.badge}>
          <ThemedText variant="caption" weight="bold" color={theme.colors.textMuted}>
            {m.comingSoon}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: {
    // minHeight, never height: a Burmese label may wrap to two lines.
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: theme.radius.button,
  },
  rowSms: { backgroundColor: theme.colors.primary },
  /** Never `danger`: a channel that isn't built yet is the normal case, not a fault. */
  rowSoon: { backgroundColor: theme.colors.surface, paddingRight: 14 },
  rowBusy: { opacity: 0.75 },
  rowDisabled: { opacity: 0.45 },
  rowPressed: { transform: [{ scale: 0.96 }] },
  rowPressedStill: { opacity: 0.82 },
  disc: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  discSms: { backgroundColor: withAlpha(theme.colors.text, 0.18) },
  discSoon: { backgroundColor: theme.colors.surfaceElevated },
  label: { flex: 1, fontSize: 16 },
  soonText: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 14,
    rowGap: 6,
  },
  /** A 45% basis decides when the badge wraps; growing fills the rest of the line. */
  soonLabel: { flexBasis: "45%", flexGrow: 1, flexShrink: 1, fontSize: 16 },
  badge: {
    // May shrink (its words wrap) if even a line of its own is too narrow.
    flexShrink: 1,
    minHeight: 26,
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: theme.colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
});
