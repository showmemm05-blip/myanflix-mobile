import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/localization/LanguageProvider";
import type { TranslationShape } from "@/localization/translations";
import { ApiError, errorMessage, isSmsUnavailable } from "@/utils/errors";
import { AuthHero } from "@/components/auth/AuthHero";
import { AuthField } from "@/components/auth/AuthField";
import {
  AuthButton,
  AuthDivider,
  AuthError,
  AuthLink,
  AuthNote,
  NumberChip,
  Rise,
  StepRail,
} from "@/components/auth/AuthParts";
import { OtpInput } from "@/components/auth/OtpInput";
import { OtpMethodPicker } from "@/components/auth/OtpMethodPicker";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * "method" is the "Get your code" step (owner decision 2026-10-01): a code is
 * never requested automatically — only when the user taps a method there.
 */
type Step = "phone" | "password" | "method" | "otp";

const STEP_ORDER: readonly Step[] = ["phone", "password", "method", "otp"];

/** Which field an error is about — it takes the danger ring. Null: the method rows, or nothing in particular. */
type ErrorField = "phone" | "password" | "confirm" | "code" | null;

interface PhoneAuthFlowProps {
  subtitle: string;
  /** Gets the number being signed in with, so the reset screen can pre-fill it. */
  onForgotPassword: (phone: string) => void;
  /** Pre-fills the phone step (e.g. after a password reset). */
  initialPhone?: string;
}

/**
 * The server's answer when the proof of the password step is missing, expired
 * (10 minutes) or voided by a password change — see backend auth.service.ts
 * STEP_TOKEN_REFUSED. The only cure is the password step again.
 */
function isStepTokenRefused(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401 && /enter your password again/i.test(err.message);
}

/**
 * POST /auth/otp/request's own refusals (backend otp.service.ts), in the
 * user's language instead of the server's English — matched on status +
 * wording, as the forgot-password screen does: 60 s between two sign-in
 * codes, and 8 codes per number per hour, reset codes included. A 503 "SMS
 * service is temporarily unavailable" means the SMS gateway phone could not
 * take the code (offline, or the day's SMS cap is used up); no code was kept,
 * so asking again shortly is the cure (matched on its exact wording, see
 * utils/errors.ts). No connection (status 0) and the HTTP throttle (429) get
 * the same translated lines the forgot-password screen shows. Anything else
 * keeps `errorMessage`'s rule.
 */
function describeSendCodeError(err: unknown, t: TranslationShape, fallback: string): string {
  if (err instanceof ApiError && err.status === 0) return t.common.networkError;
  if (err instanceof ApiError && err.status === 429) return t.auth.forgotPassword.rateLimited;
  if (err instanceof ApiError && err.status === 409) {
    if (/wait before requesting/i.test(err.message)) return t.auth.otp.waitForCode;
    if (/too many code requests/i.test(err.message)) return t.auth.otp.tooManyCodes;
  }
  if (isSmsUnavailable(err)) return t.auth.otp.smsUnavailable;
  return errorMessage(err, fallback);
}

/**
 * The one and only sign-in surface, mirroring userwebsite's PhoneAuthForm:
 * login and signup share this same three-step flow, branching only at the
 * password step (existing phone enters its password, new phone creates
 * one) — verifying the OTP at the end is what actually creates the
 * session. That is why there is only a Login screen: a separate Register
 * screen would be a second door onto this same room.
 */
export function PhoneAuthFlow({ subtitle, onForgotPassword, initialPhone }: PhoneAuthFlowProps) {
  const { checkPhoneExists, verifyPassword, requestOtp, verifyOtp } = useAuth();
  const { t } = useLanguage();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Only meaningful for a new account — carried forward to the final OTP
  // verify call, since that's the moment the account actually gets created.
  const [pendingPassword, setPendingPassword] = useState("");
  /**
   * Existing accounts only: the server's proof that the password step passed
   * (audit H-6). Sent with the code, because the server — not this screen —
   * now enforces "password, then code". Component memory only: never stored,
   * never logged, gone when the flow unmounts or the number changes. One token
   * covers every code requested within its 10 minutes, so a resend keeps it.
   */
  const [stepToken, setStepToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
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
      setError(t.auth.phone.validationError, "phone");
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
      setError(errorMessage(err, t.auth.phone.genericError), "phone");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitExistingPassword = async () => {
    if (!password) {
      setError(t.auth.password.validationError, "password");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      setStepToken(await verifyPassword(phone, password));
      // Sent back here from the code step (the step token was refused): the
      // code already requested is still good while the resend cooldown runs,
      // and asking for another inside it would only be refused (409) — so go
      // straight back to it, as the website does.
      if (cooldown > 0) {
        setStep("otp");
        return;
      }
      // Never request a code here — the user picks how to get it first.
      setStep("method");
    } catch (err) {
      setError(describeSendCodeError(err, t, t.auth.password.genericError), "password");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePassword = () => {
    if (password.length < 8) {
      setError(t.auth.password.createValidationError, "password");
      return;
    }
    if (password !== confirmPassword) {
      setError(t.auth.password.mismatchError, "confirm");
      return;
    }
    setError(null);
    setPendingPassword(password);
    // Never request a code here — the user picks how to get it first.
    setStep("method");
  };

  /**
   * "Get code by SMS" on the method step — the same request as before, and
   * the code step opens only once it succeeded; a refusal stays on this step.
   * Inside the resend cooldown the code already requested is still good and a
   * new request would only be refused (409), so go straight back to it, as
   * the website does — nobody gets stuck here after "Choose another method".
   */
  const handleRequestSms = async () => {
    if (isSubmitting) return;
    setError(null);
    if (cooldown > 0) {
      setStep("otp");
      return;
    }
    setIsSubmitting(true);
    try {
      await sendCode();
    } catch (err) {
      setError(describeSendCodeError(err, t, t.auth.otp.genericError));
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Code step → method step. Requests nothing; the cooldown keeps running. */
  const handleChooseAnotherMethod = () => {
    setError(null);
    setStep("method");
  };

  /** Method step → password step. The typed password is kept. */
  const handleBackToPassword = () => {
    setError(null);
    setStep("password");
  };

  const handleResend = async () => {
    if (cooldown > 0 || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await sendCode();
    } catch (err) {
      setError(describeSendCodeError(err, t, t.auth.otp.genericError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitCode = async () => {
    if (code.length !== 6) {
      setError(t.auth.otp.validationError, "code");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyOtp(
        phone,
        code,
        isNewAccount ? { password: pendingPassword } : { stepToken: stepToken ?? undefined },
      );
      // No navigation call needed — RootNavigator switches to the
      // authenticated stack automatically once the user state is set.
    } catch (err) {
      if (!isNewAccount && isStepTokenRefused(err)) {
        // The proof of the password step expired (10 minutes) or the password
        // changed meanwhile. The server refused BEFORE checking the code, so
        // nothing was spent — back to the password step, with the reason. The
        // typed code is kept: inside the cooldown the password step returns
        // straight to it (see handleSubmitExistingPassword).
        setStep("password");
        setPassword("");
        setStepToken(null);
        setError(t.auth.password.stepExpired, "password");
        return;
      }
      setError(errorMessage(err, t.auth.otp.genericError), "code");
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
    setStepToken(null);
    setCode("");
    setCooldown(0);
    if (cooldownInterval.current) clearInterval(cooldownInterval.current);
  };

  /* --- presentation only below this line --- */

  const title =
    step === "otp"
      ? t.auth.otp.title
      : step === "method"
        ? t.auth.method.title
        : step === "password" && isNewAccount
          ? t.auth.signup.title
          : subtitle;

  const hint =
    step === "otp"
      ? t.auth.otp.subtitle.replace("{phone}", phone)
      : step === "method"
        ? t.auth.method.subtitle
        : step === "password"
          ? (isNewAccount ? t.auth.password.newAccountHint : t.auth.password.existingAccountHint).replace(
              "{phone}",
              phone,
            )
          : null;

  /*
   * Login.dc.html / LoginCode.dc.html. The artwork is tall on the phone step
   * and settles to its shorter height for every later step; the rail and the
   * step's title sit on its bottom edge. Under it, on the page itself: the
   * hint and the number chip (from the password step on), then the step's
   * fields, its error directly under them, the commit button, a hairline,
   * and below the hairline the step's ways out — the same split the ticket's
   * tear used to make, minus the card.
   */
  return (
    <>
      <AuthHero size={step === "phone" ? "tall" : "short"}>
        <StepRail
          index={STEP_ORDER.indexOf(step)}
          count={STEP_ORDER.length}
          width={120}
          accessibilityLabel={t.auth.steps.signIn}
        />
        {/* A number the system does not know is signing UP, and the title
            says so from the password step on — the phone step cannot know
            yet, which is what the note under its hairline is for. */}
        <ThemedText variant="display" accessibilityRole="header" style={styles.title}>
          {title}
        </ThemedText>
      </AuthHero>

      <View style={styles.page}>
        {hint ? (
          <ThemedText variant="body" color={theme.colors.textMuted} style={styles.hint}>
            {hint}
          </ThemedText>
        ) : null}

        {step !== "phone" && (
          <View style={styles.chip}>
            <NumberChip
              phone={phone}
              onPress={handleChangePhone}
              disabled={isSubmitting}
              accessibilityLabel={`${phone}. ${t.auth.password.changePhone}`}
            />
          </View>
        )}

        {step === "phone" && (
          <Rise key="phone" style={styles.stepTight}>
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
            <AuthError message={error} style={styles.error} />
            <AuthButton
              title={t.auth.phone.continueButton}
              onPress={handleSubmitPhone}
              loading={isSubmitting}
              style={styles.commit}
            />
            <AuthDivider />
            <AuthNote>{t.auth.phone.stubNote}</AuthNote>
          </Rise>
        )}

        {step === "password" && isNewAccount && (
          <Rise key="create" style={styles.stepTight}>
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
              invalid={errorField === "password"}
            />
            <View style={styles.nextField}>
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
                invalid={errorField === "confirm"}
                returnKeyType="go"
                onSubmitEditing={handleCreatePassword}
              />
            </View>
            <AuthError message={error} style={styles.error} />
            <AuthButton
              title={t.auth.password.createSubmit}
              onPress={handleCreatePassword}
              loading={isSubmitting}
              style={styles.commit}
            />
            <AuthDivider />
            <AuthNote>{t.auth.password.stubNote}</AuthNote>
          </Rise>
        )}

        {step === "password" && !isNewAccount && (
          <Rise key="password" style={styles.stepTight}>
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
              invalid={errorField === "password"}
              returnKeyType="go"
              onSubmitEditing={handleSubmitExistingPassword}
            />
            <AuthError message={error} style={styles.error} />
            <AuthButton
              title={t.auth.password.submit}
              onPress={handleSubmitExistingPassword}
              loading={isSubmitting}
              style={styles.commit}
            />
            <AuthDivider />
            <View style={styles.linksTight}>
              <AuthLink
                label={t.auth.password.forgotLink}
                onPress={() => onForgotPassword(phone)}
                disabled={isSubmitting}
              />
            </View>
          </Rise>
        )}

        {step === "method" && (
          <Rise key="method" style={styles.stepLoose}>
            <OtpMethodPicker onSms={handleRequestSms} loading={isSubmitting} />
            <AuthError message={error} style={styles.error} />
            <AuthDivider />
            <View style={styles.links}>
              <AuthLink
                label={t.common.back}
                icon="chevron-back"
                tone="plain"
                onPress={handleBackToPassword}
                disabled={isSubmitting}
              />
            </View>
          </Rise>
        )}

        {step === "otp" && (
          <Rise key="otp" style={styles.stepLoose}>
            {/* The step title says what to type; the cells' name is spoken only. */}
            <OtpInput
              value={code}
              onChangeText={setCode}
              length={6}
              editable={!isSubmitting}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              placeholder={t.auth.otp.placeholder}
              invalid={errorField === "code"}
              invalidKey={failure}
              onSubmitEditing={handleSubmitCode}
            />
            <AuthError message={error} style={styles.error} />
            <AuthButton
              title={t.auth.otp.submit}
              onPress={handleSubmitCode}
              loading={isSubmitting}
              style={styles.commit}
            />
            <AuthDivider />
            <View style={styles.links}>
              <AuthLink
                label={
                  cooldown > 0 ? t.auth.otp.resendCountdown.replace("{n}", String(cooldown)) : t.auth.otp.resend
                }
                icon={cooldown > 0 ? "time-outline" : "refresh-outline"}
                onPress={handleResend}
                disabled={isSubmitting || cooldown > 0}
                tone={cooldown > 0 ? "muted" : "link"}
                tabular={cooldown > 0}
              />
              <AuthLink
                label={t.auth.method.chooseAnother}
                icon="options-outline"
                onPress={handleChooseAnotherMethod}
                disabled={isSubmitting}
              />
            </View>
          </Rise>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: theme.spacing.md },
  page: { paddingHorizontal: theme.layout.screenPadding },
  hint: { marginTop: 6 },
  chip: { marginTop: 12 },
  /** Phone and password steps: the label sits 8pt under the art (or the chip). */
  stepTight: { paddingTop: theme.spacing.sm },
  /** Method and code steps: 20pt under the chip. */
  stepLoose: { marginTop: 20 },
  nextField: { marginTop: theme.spacing.md },
  error: { marginTop: 12 },
  commit: { marginTop: 20 },
  linksTight: { marginTop: theme.spacing.sm },
  links: { marginTop: 12 },
});
