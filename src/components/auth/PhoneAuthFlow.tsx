import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/localization/LanguageProvider";
import { errorMessage } from "@/utils/errors";
import { AuthTicket } from "@/components/auth/AuthScreenShell";
import { AuthField } from "@/components/auth/AuthField";
import { OtpChannelPicker } from "@/components/auth/OtpChannelPicker";
import { OtpInput } from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/Button";
import { FadeInView } from "@/components/ui/FadeInView";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

const RESEND_COOLDOWN_SECONDS = 60;

type Step = "phone" | "password" | "otp";

const STEP_ORDER: readonly Step[] = ["phone", "password", "otp"];

interface PhoneAuthFlowProps {
  subtitle: string;
  onForgotPassword: () => void;
}

/**
 * The one and only sign-in surface, mirroring userwebsite's PhoneAuthForm:
 * login and signup share this same three-step flow, branching only at the
 * password step (existing phone enters its password, new phone creates
 * one) — verifying the OTP at the end is what actually creates the
 * session. That is why there is only a Login screen: a separate Register
 * screen would be a second door onto this same room.
 */
export function PhoneAuthFlow({ subtitle, onForgotPassword }: PhoneAuthFlowProps) {
  const { checkPhoneExists, verifyPassword, requestOtp, verifyOtp } = useAuth();
  const { t } = useLanguage();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Only meaningful for a new account — carried forward to the final OTP
  // verify call, since that's the moment the account actually gets created.
  const [pendingPassword, setPendingPassword] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const cooldownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    cooldownInterval.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownInterval.current) clearInterval(cooldownInterval.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendCode = async () => {
    await requestOtp(phone);
    setStep("otp");
    setCode("");
    startCooldown();
  };

  const handleSubmitPhone = async () => {
    if (!phone.trim()) {
      setError(t.auth.phone.validationError);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const trimmed = phone.trim();
      const exists = await checkPhoneExists(trimmed);
      setPhone(trimmed);
      setIsNewAccount(!exists);
      setStep("password");
    } catch (err) {
      setError(errorMessage(err, t.auth.phone.genericError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitExistingPassword = async () => {
    if (!password) {
      setError(t.auth.password.validationError);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyPassword(phone, password);
      await sendCode();
    } catch (err) {
      setError(errorMessage(err, t.auth.password.genericError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePassword = async () => {
    if (password.length < 8) {
      setError(t.auth.password.createValidationError);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.auth.password.mismatchError);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    setPendingPassword(password);
    try {
      await sendCode();
    } catch (err) {
      setError(errorMessage(err, t.auth.otp.genericError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await sendCode();
    } catch (err) {
      setError(errorMessage(err, t.auth.otp.genericError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitCode = async () => {
    if (code.length !== 6) {
      setError(t.auth.otp.validationError);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyOtp(phone, code, isNewAccount ? pendingPassword : undefined);
      // No navigation call needed — RootNavigator switches to the
      // authenticated stack automatically once the user state is set.
    } catch (err) {
      setError(errorMessage(err, t.auth.otp.genericError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePhone = () => {
    setStep("phone");
    setError(null);
    setPassword("");
    setConfirmPassword("");
    setPendingPassword("");
    setCode("");
    setCooldown(0);
    if (cooldownInterval.current) clearInterval(cooldownInterval.current);
  };

  /* --- presentation only below this line --- */

  const hint =
    step === "otp"
      ? t.auth.otp.subtitle.replace("{phone}", phone)
      : step === "password"
        ? (isNewAccount ? t.auth.password.newAccountHint : t.auth.password.existingAccountHint).replace(
            "{phone}",
            phone,
          )
        : null;

  /*
   * The ticket stub — below the tear, on EVERY step. The top half is what the
   * user must do; the stub is how it reaches them, plus whatever this step has
   * to admit. Rendering it unconditionally is the point: the OTP step's honest
   * "nothing is delivered yet" and a future "Viber isn't available for this
   * number" land in the same pixels, so the card won't reflow the day delivery
   * is really built.
   */
  const stub =
    step === "otp" ? (
      <>
        <OtpChannelPicker />
        <AuthLink
          label={
            cooldown > 0 ? t.auth.otp.resendCountdown.replace("{n}", String(cooldown)) : t.auth.otp.resend
          }
          icon={cooldown > 0 ? "time-outline" : "refresh-outline"}
          onPress={handleResend}
          disabled={isSubmitting || cooldown > 0}
          tone={cooldown > 0 ? "muted" : "primary"}
          tabular={cooldown > 0}
        />
      </>
    ) : step === "password" && !isNewAccount ? (
      // Out of the top half so the submit button is the last thing above the
      // tear, and so this link gets a full-width row instead of sharing one.
      <AuthLink
        label={t.auth.password.forgotLink}
        onPress={onForgotPassword}
        disabled={isSubmitting}
        tone="primary"
      />
    ) : (
      <ThemedText variant="caption" color={theme.colors.textMuted} numberOfLines={3}>
        {step === "password" ? t.auth.password.stubNote : t.auth.phone.stubNote}
      </ThemedText>
    );

  /*
   * A function of `compact`, not a ready-made tree. AuthTicket is the ONE
   * subscriber to the density boolean (see AuthScreenShell) and hands it in
   * here; reading it with a hook of our own would put a second subscription
   * on the whole form subtree, and AuthField / OtpInput / Button are plain
   * function components with nothing to stop the re-render cascading through
   * them.
   */
  const content = (compact: boolean) => (
    <>
      <StepRail step={step} />

      {/*
       * minHeight is load-bearing, not padding: without it the fields below
       * shift 16–40pt every time the hint changes length between steps, and a
       * ticket that twitches stops reading as an object. It may GROW past it
       * (Burmese runs ~50% longer) — it may never shrink, and the hint carries
       * no numberOfLines so it is free to wrap.
       */}
      <View style={compact ? styles.headerBlockCompact : styles.headerBlock}>
        <ThemedText variant="title">{step === "otp" ? t.auth.otp.title : subtitle}</ThemedText>
        {hint && <ThemedText variant="caption">{hint}</ThemedText>}
      </View>

      {step !== "phone" && (
        <IdentityChip
          phone={phone}
          onPress={handleChangePhone}
          disabled={isSubmitting}
          accessibilityLabel={`${phone}. ${t.auth.password.changePhone}`}
        />
      )}

      {/*
       * Deliberately NOT given reserved space. The slot collapses when there
       * is no error, so the card jumps ~46pt when one appears — but reserving
       * it would cost that 46pt of blank card on every step of a small phone,
       * and movement at the instant an error arrives is informative rather
       * than noise. The header's minHeight already kills the routine drift.
       */}
      {error && (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
          <ThemedText variant="caption" style={styles.errorText} numberOfLines={3}>
            {error}
          </ThemedText>
        </View>
      )}

      {/*
       * `from="none"`, not "bottom": FadeInView's "bottom" path springs
       * (FadeInDown…springify), and the overshoot-and-settle bounce is exactly
       * what this app stripped out of its sheets for reading as toy-like.
       * The step rail carries the sense of direction instead.
       */}
      <FadeInView key={step} from="none" duration={220} style={styles.stepBlock}>
        {step === "phone" && (
          <>
            <AuthField
              label={t.auth.phone.label}
              icon="call-outline"
              placeholder={t.auth.phone.placeholder}
              keyboardType="phone-pad"
              autoComplete="tel"
              value={phone}
              onChangeText={setPhone}
              editable={!isSubmitting}
              invalid={!!error}
              returnKeyType="go"
              onSubmitEditing={handleSubmitPhone}
            />
            <Button
              title={t.auth.phone.continueButton}
              onPress={handleSubmitPhone}
              loading={isSubmitting}
              disabled={isSubmitting}
              size="lg"
              fullWidth
            />
          </>
        )}

        {step === "password" && isNewAccount && (
          <>
            <AuthField
              label={t.auth.password.createLabel}
              icon="lock-closed-outline"
              placeholder={t.auth.password.placeholder}
              secureTextEntry
              revealable
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
              editable={!isSubmitting}
            />
            <AuthField
              label={t.auth.password.confirmLabel}
              icon="shield-checkmark-outline"
              placeholder={t.auth.password.confirmPlaceholder}
              secureTextEntry
              revealable
              autoComplete="new-password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!isSubmitting}
              returnKeyType="go"
              onSubmitEditing={handleCreatePassword}
            />
            <Button
              title={t.auth.password.submit}
              onPress={handleCreatePassword}
              loading={isSubmitting}
              disabled={isSubmitting}
              size="lg"
              fullWidth
            />
          </>
        )}

        {step === "password" && !isNewAccount && (
          <>
            <AuthField
              label={t.auth.password.existingLabel}
              icon="lock-closed-outline"
              placeholder={t.auth.password.placeholder}
              secureTextEntry
              revealable
              autoComplete="current-password"
              value={password}
              onChangeText={setPassword}
              editable={!isSubmitting}
              invalid={!!error}
              returnKeyType="go"
              onSubmitEditing={handleSubmitExistingPassword}
            />
            <Button
              title={t.auth.password.submit}
              onPress={handleSubmitExistingPassword}
              loading={isSubmitting}
              disabled={isSubmitting}
              size="lg"
              fullWidth
            />
          </>
        )}

        {step === "otp" && (
          <>
            {/* The step title moved into the header block, so the label that
                used to sit here would now repeat it word for word. */}
            <OtpInput
              value={code}
              onChangeText={setCode}
              length={6}
              editable={!isSubmitting}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              placeholder={t.auth.otp.placeholder}
              onSubmitEditing={handleSubmitCode}
            />
            <Button
              title={t.auth.otp.submit}
              onPress={handleSubmitCode}
              loading={isSubmitting}
              disabled={isSubmitting}
              size="lg"
              fullWidth
            />
          </>
        )}
      </FadeInView>
    </>
  );

  return <AuthTicket stub={stub}>{content}</AuthTicket>;
}

/* ------------------------------------------------------------------ */

/** Three bars showing how far through phone → password → OTP the user is. */
function StepRail({ step }: { step: Step }) {
  const index = STEP_ORDER.indexOf(step);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(index);

  useEffect(() => {
    progress.value = withTiming(index, {
      duration: reduceMotion ? 0 : 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [index, progress, reduceMotion]);

  return (
    <View
      style={styles.rail}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: STEP_ORDER.length, now: index + 1 }}
    >
      {STEP_ORDER.map((name, i) => (
        <RailSegment key={name} index={i} progress={progress} />
      ))}
    </View>
  );
}

/**
 * A violet fill laid over the track, revealed by OPACITY. Opacity is a
 * UI-thread property and touches no layout; animating the segment's width or
 * backgroundColor instead would cost a layout pass or a JS-thread frame on
 * every step change.
 */
function RailSegment({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const fillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [index - 1, index], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.railSegment}>
      <Animated.View style={[styles.railFill, fillStyle]} />
    </View>
  );
}

interface IdentityChipProps {
  phone: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}

/**
 * The number under edit, as a tappable pill — it replaces both "Change phone
 * number" links and the `{phone}` token the hints used to carry.
 *
 * Why it beats the link it replaces: that link shared one row with the resend
 * countdown, both clipped to a single line. In Burmese those are ~20 and ~25
 * glyph clusters and BOTH truncated in a 305pt row. Here the affordance to
 * change the number IS the number, and resend gets a full-width row in the
 * stub, so neither is ever squeezed.
 */
function IdentityChip({ phone, onPress, disabled, accessibilityLabel }: IdentityChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      // 32pt pill + hitSlop = a 44pt target. A 44pt-TALL pill would dominate
      // the header block it sits under.
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 8 }}
      style={({ pressed }) => [styles.chip, pressed && !disabled && styles.chipPressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Ionicons name="call-outline" size={14} color={theme.colors.textFaint} />
      <ThemedText variant="caption" tabular numberOfLines={1}>
        {phone}
      </ThemedText>
      <Ionicons name="swap-horizontal-outline" size={14} color={theme.colors.primary} />
    </Pressable>
  );
}

interface AuthLinkProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: "muted" | "primary";
  tabular?: boolean;
}

/**
 * Secondary auth action — always a full 44pt row, never a bare line of text.
 * Every one of these now lives in the stub, one per row: the start/end
 * alignment variants existed only for the two-up row that clipped its Burmese.
 */
function AuthLink({ label, onPress, disabled, icon, tone = "muted", tabular }: AuthLinkProps) {
  const color = disabled
    ? theme.colors.textFaint
    : tone === "primary"
      ? theme.colors.primary
      : theme.colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.link, pressed && !disabled && styles.linkPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      {icon && <Ionicons name={icon} size={15} color={color} />}
      <ThemedText variant="caption" weight="semibold" color={color} tabular={tabular} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The floor the hint is free to grow past — never a maxHeight.
  headerBlock: { gap: 4, minHeight: 100 },
  headerBlockCompact: { gap: 4, minHeight: 84 },
  stepBlock: { gap: theme.spacing.md },

  rail: { flexDirection: "row", gap: 6 },
  railSegment: {
    flex: 1,
    height: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.border,
    overflow: "hidden",
  },
  railFill: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.primary },

  chip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingLeft: 12,
    paddingRight: 10,
    gap: 6,
  },
  chipPressed: { opacity: 0.7 },

  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.sm + 2,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.danger + "40",
    backgroundColor: theme.colors.dangerSoft,
  },
  errorText: { flex: 1, color: theme.colors.danger },

  link: {
    minHeight: theme.layout.minTouch,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
  },
  linkPressed: { opacity: 0.6 },
});
