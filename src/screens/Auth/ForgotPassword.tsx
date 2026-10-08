import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthScreenShell } from "@/components/auth/AuthScreenShell";
import { AuthHero } from "@/components/auth/AuthHero";
import { AuthTopBar } from "@/components/auth/AuthTopBar";
import { AuthField } from "@/components/auth/AuthField";
import {
  AuthButton,
  AuthDivider,
  AuthError,
  AuthLink,
  IconDisc,
  NumberChip,
  Pop,
  Rise,
} from "@/components/auth/AuthParts";
import { OtpInput } from "@/components/auth/OtpInput";
import { OtpMethodPicker } from "@/components/auth/OtpMethodPicker";
import { ThemedText } from "@/components/ui/ThemedText";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/localization/LanguageProvider";
import type { TranslationShape } from "@/localization/translations";
import { ApiError, isSmsUnavailable } from "@/utils/errors";
import { theme, withAlpha } from "@/theme";
import type { AuthStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

/** "method" = "Get your code": nothing is requested until a method is tapped there. */
type Step = "phone" | "method" | "reset" | "done";

/** The steps the top bar's rail counts ("done" has no rail — it has the artwork). */
const RAIL_STEPS: readonly Step[] = ["phone", "method", "reset"];

/** Which field an error is about — it takes the danger ring. Null: the method rows, or the form as a whole. */
type ErrorField = "phone" | "code" | "password" | "confirm" | null;

/** Same cooldown the sign-in flow shows — the server refuses a new code inside 60s. */
const RESEND_COOLDOWN_SECONDS = 60;
/** Mirrors the backend's ResetPasswordDto (MinLength 8, MaxLength 72). */
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

/**
 * The server's English messages, turned into the user's language. Matched on
 * status + wording, never rendered raw: every string the reset routes can
 * answer with is listed in backend auth.service.ts / otp.service.ts.
 */
function describeError(err: unknown, t: TranslationShape, fallback: string): string {
  const f = t.auth.forgotPassword;
  if (!(err instanceof ApiError)) return fallback;
  if (err.status === 0) return t.common.networkError;
  if (err.status === 429) return f.rateLimited;
  // 503: the SMS gateway phone could not take the code — ask again shortly.
  if (isSmsUnavailable(err)) return t.auth.otp.smsUnavailable;
  const message = err.message;
  if (/valid myanmar phone number/i.test(message)) return t.auth.phone.validationError;
  if (/no account was found/i.test(message)) return f.noAccount;
  if (/no longer active/i.test(message)) return f.inactive;
  if (/too many incorrect attempts/i.test(message)) return f.tooManyAttempts;
  if (/invalid or expired code/i.test(message)) return t.auth.otp.genericError;
  if (/wait before requesting/i.test(message)) return t.auth.otp.waitForCode;
  if (/too many code requests/i.test(message)) return t.auth.otp.tooManyCodes;
  return fallback;
}

/**
 * "Forgot password" on the CURRENT one-time-code flow (audit H-8): phone →
 * "Get your code" (owner decision 2026-10-01: never requested automatically)
 * → "Get code by SMS" sends the same POST /auth/otp/request sign-in uses, with
 * purpose "password_reset" → code + new password → POST /auth/password/reset. The server only accepts
 * a reset code there (and refuses it for sign-in), so every request here —
 * resends included — must carry that purpose. Nothing about code delivery
 * changes here, so the method and code steps say exactly what the sign-in
 * ones say.
 *
 * A reset signs the account out everywhere and opens no session, so the last
 * step sends the user back to sign in, number pre-filled. The two passwords
 * and the code live in this screen's state only and are wiped on success.
 */
export function ForgotPasswordScreen({ route, navigation }: Props) {
  const { t } = useLanguage();
  const f = t.auth.forgotPassword;
  const { requestOtp, resetPassword } = useAuth();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState(route.params?.phone ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState<{ message: string; field: ErrorField } | null>(null);
  const error = failure?.message ?? null;
  const errorField = failure?.field ?? null;
  /** Every message shows directly under what it is about; `field` says which input takes the ring. */
  const setError = (message: string | null, field: ErrorField = null) => {
    setFailure(message === null ? null : { message, field });
  };
  const [cooldown, setCooldown] = useState(0);
  const cooldownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  /** The number the running cooldown belongs to: the code-step shortcut below
   *  only applies to that number, never to one edited after going Back. */
  const codeSentFor = useRef<string | null>(null);

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

  /** Phone step → method step. Requests nothing. */
  const handleSubmitPhone = () => {
    const trimmed = phone.trim();
    if (!trimmed) {
      setError(t.auth.phone.validationError, "phone");
      return;
    }
    setError(null);
    if (codeSentFor.current !== null && codeSentFor.current !== trimmed) {
      // A different number: its own server cooldown applies, not this one.
      setCooldown(0);
      if (cooldownInterval.current) clearInterval(cooldownInterval.current);
      codeSentFor.current = null;
      setCode("");
    }
    setPhone(trimmed);
    setStep("method");
  };

  /**
   * "Get code by SMS". The code step opens only once the request succeeded;
   * every refusal stays on the method step. Inside the resend cooldown the
   * code already requested is still good and a new request would only be
   * refused (409), so go straight back to it — nobody gets stuck here after
   * "Choose another method".
   */
  const handleRequestSms = async () => {
    if (isSubmitting) return;
    setError(null);
    if (cooldown > 0 && codeSentFor.current === phone) {
      setStep("reset");
      return;
    }
    setIsSubmitting(true);
    try {
      // Refused right here, before any code is created or the cooldown is
      // used, so these messages show on the method step: a number with no
      // customer account (staff numbers included — staff passwords are reset
      // by staff) gets 400 "No account was found…", and a suspended, banned
      // or closed account gets 401 "This account is no longer active" (a
      // skipAuth call, so that 401 is this answer, not a session ending).
      await requestOtp(phone, "password_reset");
      codeSentFor.current = phone;
      setCode("");
      setStep("reset");
      startCooldown();
    } catch (err) {
      setError(describeError(err, t, t.auth.phone.genericError));
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Code step → method step. Requests nothing; the cooldown keeps running. */
  const handleChooseAnotherMethod = () => {
    setError(null);
    setStep("method");
  };

  const handleResend = async () => {
    if (cooldown > 0 || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await requestOtp(phone, "password_reset");
      setCode("");
      startCooldown();
    } catch (err) {
      setError(describeError(err, t, t.auth.otp.genericError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (code.length !== 6) {
      setError(t.auth.otp.validationError, "code");
      return;
    }
    if (newPassword.length < MIN_PASSWORD) {
      setError(t.auth.password.createValidationError, "password");
      return;
    }
    if (newPassword.length > MAX_PASSWORD) {
      setError(f.passwordTooLong, "password");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t.auth.password.mismatchError, "confirm");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await resetPassword(phone, code, newPassword);
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
      setStep("done");
    } catch (err) {
      const message = describeError(err, t, f.genericError);
      // A wrong, expired or burnt-out code is about the code cells; anything
      // else (no connection, the throttle) is about the form as a whole.
      setError(message, message === t.auth.otp.genericError || message === f.tooManyAttempts ? "code" : null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeNumber = () => {
    setStep("phone");
    setError(null);
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setCooldown(0);
    if (cooldownInterval.current) clearInterval(cooldownInterval.current);
  };

  /* --- presentation only below this line --- */

  /*
   * ForgotPasswordReset.dc.html "done": a reset signs every session out and
   * opens none, so the last step is the brand artwork, a green tick, and the
   * way back to sign in with the number pre-filled.
   */
  if (step === "done") {
    return (
      <AuthScreenShell>
        <AuthHero size="done">
          <Pop style={styles.successBadge}>
            <Ionicons name="checkmark-circle-outline" size={32} color={theme.colors.success} />
          </Pop>
        </AuthHero>
        <Rise style={styles.page}>
          <ThemedText
            variant="display"
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            style={styles.doneTitle}
          >
            {f.successTitle}
          </ThemedText>
          <ThemedText variant="body" color={theme.colors.textBody} style={styles.hint}>
            {f.successBody}
          </ThemedText>
          <AuthButton
            title={f.backToSignIn}
            icon="log-in-outline"
            variant="play"
            onPress={() => navigation.navigate("Login", { phone })}
            style={styles.doneButton}
          />
        </Rise>
      </AuthScreenShell>
    );
  }

  /*
   * The top-left back circle replaced the stub's Back button and does what it
   * did: the phone step returns to sign in, the method step to the phone
   * step. The reset step's circle returns to sign in too, as the system back
   * gesture on this screen always has.
   */
  const handleBack =
    step === "method"
      ? () => {
          setError(null);
          setStep("phone");
        }
      : () => navigation.navigate("Login");

  return (
    <AuthScreenShell>
      <AuthTopBar
        onBack={handleBack}
        backDisabled={isSubmitting}
        backLabel={t.common.back}
        step={RAIL_STEPS.indexOf(step)}
        steps={RAIL_STEPS.length}
        railLabel={t.auth.steps.reset}
      />

      <View style={styles.page}>
        {/* ForgotPassword.dc.html: phone step */}
        {step === "phone" && (
          <Rise key="phone">
            <View style={styles.disc}>
              <IconDisc icon="key-outline" color={theme.colors.link} />
            </View>
            <ThemedText variant="display" accessibilityRole="header" style={styles.title}>
              {f.title}
            </ThemedText>
            <ThemedText variant="body" color={theme.colors.textMuted} style={styles.hint}>
              {f.phoneHint}
            </ThemedText>
            <View style={styles.formTop}>
              <AuthField
                label={t.auth.phone.label}
                icon="call-outline"
                placeholder={t.auth.phone.placeholder}
                keyboardType="phone-pad"
                autoComplete="tel"
                numeric
                value={phone}
                onChangeText={setPhone}
                editable={!isSubmitting}
                invalid={errorField === "phone"}
                returnKeyType="go"
                onSubmitEditing={handleSubmitPhone}
              />
            </View>
            <AuthError message={error} style={styles.error} />
            <AuthButton
              title={t.auth.phone.continueButton}
              onPress={handleSubmitPhone}
              disabled={isSubmitting}
              style={styles.commit}
            />
          </Rise>
        )}

        {/* ForgotPassword.dc.html: method step */}
        {step === "method" && (
          <Rise key="method">
            <View style={styles.disc}>
              <IconDisc icon="key-outline" color={theme.colors.link} />
            </View>
            <ThemedText variant="display" accessibilityRole="header" style={styles.title}>
              {t.auth.method.title}
            </ThemedText>
            <ThemedText variant="body" color={theme.colors.textMuted} style={styles.hint}>
              {t.auth.method.subtitle}
            </ThemedText>
            <View style={styles.chip}>
              <NumberChip phone={phone} />
            </View>
            <View style={styles.methods}>
              <OtpMethodPicker
                onSms={() => {
                  void handleRequestSms();
                }}
                loading={isSubmitting}
              />
            </View>
            <AuthError message={error} style={styles.error} />
          </Rise>
        )}

        {/* ForgotPasswordReset.dc.html */}
        {step === "reset" && (
          <Rise key="reset">
            <ThemedText variant="display" accessibilityRole="header" style={styles.resetTitle}>
              {f.resetTitle}
            </ThemedText>
            <ThemedText variant="body" color={theme.colors.textMuted} style={styles.hint}>
              {t.auth.otp.subtitle}
            </ThemedText>
            <View style={styles.chip}>
              <NumberChip phone={phone} />
            </View>
            <View style={styles.formTop}>
              <OtpInput
                label={t.auth.otp.placeholder}
                value={code}
                onChangeText={setCode}
                length={6}
                editable={!isSubmitting}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                placeholder={t.auth.otp.placeholder}
                invalid={errorField === "code"}
                invalidKey={failure}
              />
            </View>
            <View style={styles.afterCode}>
              <AuthField
                label={f.newPasswordLabel}
                icon="lock-closed-outline"
                placeholder={t.auth.password.placeholder}
                secureTextEntry
                revealable
                autoComplete="new-password"
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!isSubmitting}
                invalid={errorField === "password"}
              />
            </View>
            <View style={styles.nextField}>
              <AuthField
                label={f.confirmPasswordLabel}
                icon="shield-checkmark-outline"
                placeholder={t.auth.password.confirmPlaceholder}
                secureTextEntry
                revealable
                autoComplete="new-password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!isSubmitting}
                invalid={errorField === "confirm"}
                returnKeyType="go"
                onSubmitEditing={handleReset}
              />
            </View>
            <AuthError message={error} style={styles.error} />
            <AuthButton title={f.submit} onPress={handleReset} loading={isSubmitting} style={styles.commit} />
            <AuthDivider />
            <View style={styles.links}>
              <AuthLink
                label={
                  cooldown > 0 ? t.auth.otp.resendCountdown.replace("{n}", String(cooldown)) : t.auth.otp.resend
                }
                icon={cooldown > 0 ? "time-outline" : "refresh-outline"}
                tone={cooldown > 0 ? "muted" : "link"}
                tabular={cooldown > 0}
                disabled={isSubmitting || cooldown > 0}
                onPress={() => {
                  void handleResend();
                }}
              />
              <AuthLink
                label={t.auth.method.chooseAnother}
                icon="options-outline"
                disabled={isSubmitting}
                onPress={handleChooseAnotherMethod}
              />
              <AuthLink
                label={t.auth.password.changePhone}
                icon="swap-horizontal-outline"
                disabled={isSubmitting}
                onPress={handleChangeNumber}
              />
            </View>
          </Rise>
        )}
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: theme.layout.screenPadding },
  disc: { marginTop: theme.spacing.md },
  title: { marginTop: 20 },
  resetTitle: { marginTop: theme.spacing.md },
  hint: { marginTop: 10 },
  chip: { marginTop: theme.spacing.md },
  /** The first input sits 28pt under the copy above it. */
  formTop: { marginTop: 28 },
  methods: { marginTop: theme.spacing.lg },
  afterCode: { marginTop: 20 },
  nextField: { marginTop: theme.spacing.md },
  error: { marginTop: 12 },
  commit: { marginTop: 20 },
  links: { marginTop: 12 },

  successBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: withAlpha(theme.colors.success, 0.18),
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: { marginTop: 12 },
  doneButton: { marginTop: theme.spacing.xl },
});
