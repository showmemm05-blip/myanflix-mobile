import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { useAuthPrefsStore, type OtpChannel } from "@/store/authPrefsStore";
import { theme } from "@/theme";

interface ChannelSpec {
  key: OtpChannel;
  icon: keyof typeof Ionicons.glyphMap;
}

/**
 * SMS first because it is the default, and the default is the only channel
 * that can reach a stranger's phone (see authPrefsStore).
 *
 * The glyphs are plain Ionicons rather than hand-drawn brand marks: the icon
 * set ships no `logo-telegram` and no `logo-viber` (checked against the
 * bundled glyphmap — `logo-whatsapp` exists, these two do not), and these
 * three silhouettes are distinct enough to tell apart while inheriting the
 * set's optical size and stroke weight for free. Redrawing two trademarked
 * marks as SVG paths would cost a file and raise a question we can't answer.
 */
const CHANNELS: readonly ChannelSpec[] = Object.freeze([
  { key: "sms", icon: "chatbubble-ellipses" },
  { key: "telegram", icon: "paper-plane" },
  { key: "viber", icon: "call" },
]);

/** Module scope so an empty default never allocates on a render. */
const NONE: readonly OtpChannel[] = Object.freeze([]);

interface Props {
  /**
   * Channels that cannot reach THIS number. Reserved: no caller passes it
   * today, because nothing can tell us yet. It exists so the day a channel is
   * really wired up, the "Viber isn't available for this number" case already
   * has pixels — the tile keeps its position and the helper line below
   * explains why, instead of the card growing a new row.
   */
  unavailable?: readonly OtpChannel[];
}

/**
 * Where the viewer would like their code to arrive. Lives in the ticket stub
 * on the OTP step only — after the request, framed as a remembered preference
 * rather than as a promise about the code already on its way.
 *
 * Deliberately NOT on the password step: a picker shown BEFORE the request
 * invites the user to choose "Telegram" and then land on a screen that
 * pointedly never mentions Telegram, and that mismatch is exactly the pressure
 * that makes someone later write a delivery claim that isn't true.
 */
export function OtpChannelPicker({ unavailable = NONE }: Props) {
  const { t } = useLanguage();
  const preferred = useAuthPrefsStore((s) => s.preferredOtpChannel);
  const setPreferred = useAuthPrefsStore((s) => s.setPreferredOtpChannel);

  // Derived, never written back: a remembered channel that has since become
  // unavailable falls back to SMS for display without silently destroying the
  // choice the viewer actually made.
  const selected = unavailable.includes(preferred) ? "sms" : preferred;
  const blocked = unavailable.length > 0 ? unavailable[0] : null;

  return (
    <View style={styles.block}>
      {/* caption (13/18), not label (12/16): Myanmar at 12pt in a 16pt line
          box clips below-base marks on several Android builds. */}
      <ThemedText variant="caption" color={theme.colors.textMuted}>
        {t.auth.channel.label}
      </ThemedText>

      <View style={styles.row} accessibilityRole="radiogroup">
        {CHANNELS.map((channel) => (
          <ChannelTile
            key={channel.key}
            icon={channel.icon}
            label={t.auth.channel[channel.key]}
            selected={selected === channel.key}
            available={!unavailable.includes(channel.key)}
            // UI ONLY — this choice never leaves the device, and must not start.
            //
            // POST /auth/otp/request accepts exactly ONE property. Verified:
            // backend/src/auth/dto/request-otp.dto.ts declares only `phone`, and
            // backend/src/app.module.ts registers the global ValidationPipe with
            // `whitelist: true` AND `forbidNonWhitelisted: true`. With
            // `forbidNonWhitelisted`, an unknown property is not stripped — it is
            // REJECTED. So adding `channel` to that body makes the server answer
            // 400, and OTP sign-in stops working for every user, on every
            // request, immediately.
            //
            // src/api/auth.api.ts must keep sending exactly `{ phone }`, and
            // `requestOtp` must keep a BARE STRING parameter in both auth.api.ts
            // and useAuth — an options object leaves a comfortable slot for
            // someone to drop a `channel` into by reflex. A later refactor that
            // "tidies" it into `requestOtp({ phone })` quietly removes that
            // protection.
            //
            // When a channel is really wired up, the backend DTO and the delivery
            // service change FIRST, and this comment moves with them. The two
            // changes ship together or not at all.
            onSelect={() => setPreferred(channel.key)}
          />
        ))}
      </View>

      {/*
       * THE MOST IMPORTANT LINE ON THIS SCREEN. It does two jobs in one breath:
       * it says plainly that nothing arrives yet (so nobody sits waiting for a
       * buzz and concludes the app is broken), and it says the choice was kept
       * anyway (so the picker is not decoration). Never shorten it to one line,
       * never let it truncate, never soften it in translation — the moment it
       * goes, the screen starts lying.
       */}
      <ThemedText variant="caption" color={theme.colors.textFaint} numberOfLines={4}>
        {blocked
          ? t.auth.channel.unavailable.replace("{channel}", t.auth.channel[blocked])
          : t.auth.channel.pending}
      </ThemedText>
    </View>
  );
}

/* ------------------------------------------------------------------ */

interface TileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  selected: boolean;
  available?: boolean;
  onSelect: () => void;
}

function ChannelTile({ icon, label, selected, available = true, onSelect }: TileProps) {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    // An OVERLAY's opacity, not the tile's backgroundColor: opacity is a
    // UI-thread property, so the swap costs no JS frame and no layout pass.
    fill.value = withTiming(selected ? 1 : 0, {
      duration: reduceMotion ? 0 : 160,
      easing: Easing.out(Easing.quad),
    });
  }, [fill, reduceMotion, selected]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }));

  const ink = !available
    ? theme.colors.textFaint
    : selected
      ? theme.colors.onPrimary
      : theme.colors.textMuted;

  return (
    <Pressable
      onPress={onSelect}
      disabled={!available}
      // A plain Pressable, never PressableScale — that springs, and the spring
      // is exactly what this app removed from its sheets for reading as toy-like.
      style={({ pressed }) => [
        styles.tile,
        selected && available && styles.tileSelected,
        !available && styles.tileUnavailable,
        pressed && available && styles.tilePressed,
      ]}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: selected && available, disabled: !available }}
    >
      {available && <Animated.View style={[styles.tileFill, fillStyle]} pointerEvents="none" />}

      {/* Wrapped and lifted so the absolutely-positioned fill can never paint
          over the glyph on Android, where sibling order alone isn't a promise. */}
      <View style={styles.tileContent}>
        <Ionicons name={icon} size={24} color={ink} />
        <ThemedText
          variant="caption"
          weight={selected && available ? "bold" : "semibold"}
          color={ink}
          numberOfLines={2}
        >
          {label}
        </ThemedText>
      </View>

      {selected && available && (
        <Animated.View entering={FadeIn.duration(140)} style={styles.badge}>
          <Ionicons name="checkmark-circle" size={16} color={theme.colors.onPrimary} />
        </Animated.View>
      )}
      {!available && (
        <View style={styles.badge}>
          <Ionicons name="information-circle" size={14} color={theme.colors.textFaint} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { gap: theme.spacing.sm },
  row: { flexDirection: "row", gap: theme.spacing.sm },

  tile: {
    flex: 1,
    // minHeight, never height: a fourth channel would wrap the row rather
    // than squeezing three Burmese labels into two-thirds of the width.
    minHeight: 76,
    paddingVertical: theme.spacing.sm + 4,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    // The violet fill is painted inside, so it must not bleed past the radius.
    overflow: "hidden",
  },
  tileContent: { alignItems: "center", gap: theme.spacing.sm, zIndex: 1 },
  tileFill: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.primary },
  tileSelected: { borderColor: theme.colors.primary },
  /** Never `danger`: an unavailable channel is the normal case, not a fault. */
  tileUnavailable: { backgroundColor: theme.colors.surfaceSunken, opacity: 0.45 },
  tilePressed: { opacity: 0.85 },

  badge: { position: "absolute", top: 6, right: 6, zIndex: 1 },
});
