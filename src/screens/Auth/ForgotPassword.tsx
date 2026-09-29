import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthScreenShell, AuthTicket } from "@/components/auth/AuthScreenShell";
import { AuthField } from "@/components/auth/AuthField";
import { OtpChannelPicker } from "@/components/auth/OtpChannelPicker";
import { OtpInput } from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/Button";
import { FadeInView } from "@/components/ui/FadeInView";
import { ThemedText } from "@/components/ui/ThemedText";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/localization/LanguageProvider";
import type { TranslationShape } from "@/localization/translations";
import { ApiError } from "@/utils/errors";
import { theme } from "@/theme";
import type { AuthStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

type Step = "phone" | "reset" | "done";

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
 * the same POST /auth/otp/request sign-in uses, with purpose "password_reset"
 * → code + new password → POST /auth/password/reset. The server only accepts
 * a reset code there (and refuses it for sign-in), so every request here —
 * resends included — must carry that purpose. Nothing about code delivery
 * changes here, so the code step says exactly what the sign-in code step says,
 * channel note included.
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

  const handleRequestCode = async () => {
    const trimmed = phone.trim();
    if (!trimmed) {
      setError(t.auth.phone.validationError);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      // Refused right here, before any code is created or the cooldown is
      // used, so these messages come before the code step: a number with no
      // customer account (staff numbers included — staff passwords are reset
      // by staff) gets 400 "No account was found…", and a suspended, banned
      // or closed account gets 401 "This account is no longer active" (a
      // skipAuth call, so that 401 is this answer, not a session ending).
      await requestOtp(trimmed, "password_reset");
      setPhone(trimmed);
      setCode("");
      setStep("reset");
      startCooldown();
    } catch (err) {
      setError(describeError(err, t, t.auth.phone.genericError));
    } finally {
      setIsSubmitting(false);
    }
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
      setError(t.auth.otp.validationError);
      return;
    }
    if (newPassword.length < MIN_PASSWORD) {
      setError(t.auth.password.createValidationError);
      return;
    }
    if (newPassword.length > MAX_PASSWORD) {
      setError(f.passwordTooLong);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t.auth.password.mismatchError);
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
      setError(describeError(err, t, f.genericError));
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

  const title = step === "phone" ? f.title : step === "reset" ? f.resetTitle : f.successTitle;
  const hint = step === "phone" ? f.phoneHint : step === "reset" ? t.auth.otp.subtitle : f.successBody;

  const stub =
    step === "phone" ? (
      // Back lives in the stub: a tear with nothing below it reads as a
      // mistake, and on this step it is the one other thing to do.
      <Button
        title={t.common.back}
        icon="chevron-back"
        variant="soft"
        size="lg"
        fullWidth
        disabled={isSubmitting}
        onPress={() => navigation.navigate("Login")}
      />
    ) : step === "reset" ? (
      <View style={styles.stubStack}>
        {/* The same honest delivery note the sign-in code step carries. */}
        <OtpChannelPicker />
        <Button
          title={cooldown > 0 ? t.auth.otp.resendCountdown.replace("{n}", String(cooldown)) : t.auth.otp.resend}
          icon={cooldown > 0 ? "time-outline" : "refresh-outline"}
          variant="ghost"
          fullWidth
          disabled={isSubmitting || cooldown > 0}
          onPress={() => {
            void handleResend();
          }}
        />
        <Button
          title={t.auth.password.changePhone}
          icon="swap-horizontal-outline"
          variant="ghost"
          fullWidth
          disabled={isSubmitting}
          onPress={handleChangeNumber}
        />
      </View>
    ) : (
      <Button
        title={f.backToSignIn}
        icon="log-in-outline"
        size="lg"
        fullWidth
        onPress={() => navigation.navigate("Login", { phone })}
      />
    );

  return (
    <AuthScreenShell>
      <AuthTicket stub={stub}>
        <View style={styles.badge}>
          <Ionicons
            name={step === "done" ? "checkmark-circle-outline" : "key-outline"}
            size={22}
            color={step === "done" ? theme.colors.finance : theme.colors.primary}
          />
        </View>

        <View style={styles.copy}>
          <ThemedText variant="title">{title}</ThemedText>
          <ThemedText variant="body" style={styles.body}>
            {hint}
          </ThemedText>
          {step === "reset" ? (
            <View style={styles.identity}>
              <Ionicons name="call-outline" size={14} color={theme.colors.textFaint} />
              <ThemedText variant="caption" tabular numberOfLines={1}>
                {phone}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
            <ThemedText variant="caption" style={styles.errorText} numberOfLines={3}>
              {error}
            </ThemedText>
          </View>
        ) : null}

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
                onSubmitEditing={handleRequestCode}
              />
              <Button
                title={f.requestCode}
                onPress={handleRequestCode}
                loading={isSubmitting}
                disabled={isSubmitting}
                size="lg"
                fullWidth
              />
            </>
          )}

          {step === "reset" && (
            <>
              <OtpInput
                value={code}
                onChangeText={setCode}
                length={6}
                editable={!isSubmitting}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                placeholder={t.auth.otp.placeholder}
              />
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
              />
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
                returnKeyType="go"
                onSubmitEditing={handleReset}
              />
              <Button
                title={f.submit}
                onPress={handleReset}
                loading={isSubmitting}
                disabled={isSubmitting}
                size="lg"
                fullWidth
              />
            </>
          )}
        </FadeInView>
      </AuthTicket>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primary + "3D",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { gap: theme.spacing.sm },
  body: { color: theme.colors.textMuted },
  identity: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepBlock: { gap: theme.spacing.md },
  stubStack: { gap: theme.spacing.xs },
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
});
