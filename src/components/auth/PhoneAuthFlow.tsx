import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/localization/LanguageProvider";
import { errorMessage } from "@/utils/errors";
import { AuthCard } from "@/components/auth/AuthScreenShell";
import { AuthField } from "@/components/auth/AuthField";
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
 * session, so both the Login and Register screens just render this.
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

  return (
    <AuthCard>
      <StepRail step={step} />

      <View style={styles.headerBlock}>
        <ThemedText variant="title">{subtitle}</ThemedText>
        {hint && <ThemedText variant="caption">{hint}</ThemedText>}
      </View>

      {error && (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
          <ThemedText variant="caption" style={styles.errorText}>
            {error}
          </ThemedText>
        </View>
      )}

      <FadeInView key={step} from="bottom" duration={260} style={styles.stepBlock}>
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
            <AuthLink
              label={t.auth.password.changePhone}
              icon="swap-horizontal-outline"
              onPress={handleChangePhone}
              disabled={isSubmitting}
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
            <AuthLink
              label={t.auth.password.forgotLink}
              onPress={onForgotPassword}
              disabled={isSubmitting}
              align="end"
              tone="primary"
            />
            <Button
              title={t.auth.password.submit}
              onPress={handleSubmitExistingPassword}
              loading={isSubmitting}
              disabled={isSubmitting}
              size="lg"
              fullWidth
            />
            <AuthLink
              label={t.auth.password.changePhone}
              icon="swap-horizontal-outline"
              onPress={handleChangePhone}
              disabled={isSubmitting}
            />
          </>
        )}

        {step === "otp" && (
          <>
            <ThemedText variant="label" style={styles.otpLabel}>
              {t.auth.otp.title}
            </ThemedText>
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
            <View style={styles.row}>
              <AuthLink
                label={t.auth.otp.changePhone}
                icon="swap-horizontal-outline"
                onPress={handleChangePhone}
                disabled={isSubmitting}
                align="start"
              />
              <AuthLink
                label={
                  cooldown > 0
                    ? t.auth.otp.resendCountdown.replace("{n}", String(cooldown))
                    : t.auth.otp.resend
                }
                icon={cooldown > 0 ? "time-outline" : "refresh-outline"}
                onPress={handleResend}
                disabled={isSubmitting || cooldown > 0}
                align="end"
                tone={cooldown > 0 ? "muted" : "primary"}
                tabular={cooldown > 0}
              />
            </View>
          </>
        )}
      </FadeInView>
    </AuthCard>
  );
}

/* ------------------------------------------------------------------ */

/** Three bars showing how far through phone → password → OTP the user is. */
function StepRail({ step }: { step: Step }) {
  const index = STEP_ORDER.indexOf(step);

  return (
    <View
      style={styles.rail}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: STEP_ORDER.length, now: index + 1 }}
    >
      {STEP_ORDER.map((name, i) => (
        <View key={name} style={[styles.railSegment, i <= index && styles.railSegmentActive]} />
      ))}
    </View>
  );
}

interface AuthLinkProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  align?: "start" | "center" | "end";
  tone?: "muted" | "primary";
  tabular?: boolean;
}

/** Secondary auth action — always a full 44pt row, never a bare line of text. */
function AuthLink({
  label,
  onPress,
  disabled,
  icon,
  align = "center",
  tone = "muted",
  tabular,
}: AuthLinkProps) {
  const color = disabled
    ? theme.colors.textFaint
    : tone === "primary"
      ? theme.colors.primary
      : theme.colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.link,
        align === "start" && styles.linkStart,
        align === "end" && styles.linkEnd,
        pressed && !disabled && styles.linkPressed,
      ]}
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
  headerBlock: { gap: 4 },
  stepBlock: { gap: theme.spacing.md },

  rail: { flexDirection: "row", gap: 6 },
  railSegment: {
    flex: 1,
    height: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.border,
  },
  railSegmentActive: { backgroundColor: theme.colors.primary },

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

  otpLabel: { marginBottom: -theme.spacing.sm },

  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },

  link: {
    minHeight: theme.layout.minTouch,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
  },
  linkStart: { justifyContent: "flex-start", flexShrink: 1 },
  linkEnd: { justifyContent: "flex-end", flexShrink: 1 },
  linkPressed: { opacity: 0.6 },
});
