import { useRef, useState } from "react";
import { StyleSheet, View, type TextInput } from "react-native";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import {
  ErrorNotice,
  FieldError,
  FieldLabel,
  SheetForm,
  SheetInput,
  SheetSuccess,
} from "@/components/wallet/SheetForm";
import { useChangePassword } from "@/hooks/useProfile";
import { useLanguage } from "@/localization/LanguageProvider";
import { ApiError } from "@/utils/errors";
import { theme } from "@/theme";

/** Mirrors the backend's @MinLength(8) on the new password. */
const MIN_PASSWORD = 8;

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * "Change password" — current, new, confirm, posted to PATCH /users/me/password.
 *
 * The three values live in this component's own state and nowhere else: never
 * logged, never persisted, never handed to a store or a query cache, and wiped
 * the moment the sheet closes rather than after its animation — a typed secret
 * has no business outliving the close by a quarter second.
 *
 * Success has to be announced. Nothing else in the app changes when a password
 * changes, and the session deliberately survives it, so without the
 * confirmation pane a user who expects to be signed out is left guessing
 * whether anything happened at all.
 */
export function ChangePasswordSheet({ visible, onClose }: Props) {
  const { t } = useLanguage();
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const newRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // An untouched field is never shown as wrong — the error only appears once
  // there is something to be wrong about.
  const newPasswordError =
    newPassword.length > 0 && newPassword.length < MIN_PASSWORD ? t.profile.passwordTooShort : null;
  const confirmPasswordError =
    confirmPassword.length > 0 && confirmPassword !== newPassword ? t.profile.passwordMismatch : null;
  // The current password is checked for presence only: the backend does the
  // same, because an older account may hold a password shorter than today's floor.
  const canSubmit =
    currentPassword.length > 0 && newPassword.length >= MIN_PASSWORD && confirmPassword === newPassword;

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setCurrentPasswordError(null);
    setError(null);
    setSucceeded(false);
  };

  const handleClose = () => {
    // Same refusal as the profile sheet: closing mid-save would throw away the
    // one confirmation this change ever gets. The scrim and the drag are stopped
    // at the source by `dismissible` below, because the drag has already moved
    // the sheet off-screen by the time it calls this; what is left for the
    // guard here is the header X and Android's hardware back.
    if (changePassword.isPending) return;
    onClose();
    // Cleared immediately, NOT after the close animation like the other sheets:
    // the fields are secure-entry so nothing is legible while it slides away,
    // and the values should stop existing as early as possible.
    reset();
  };

  const handleSubmit = async () => {
    // Re-checked because the confirm field's Done key calls this directly and
    // never passes through the button's disabled state.
    if (!canSubmit || changePassword.isPending) return;
    setError(null);
    setCurrentPasswordError(null);
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSucceeded(true);
    } catch (err) {
      /**
       * The server's own "Your current password is incorrect" belongs on the
       * field it is about — a message at the bottom of the form makes the user
       * hunt for which of three fields is wrong. Matched, never rendered: the
       * raw text is English and concerns a credential, so only a localized
       * line of ours is ever shown.
       *
       * The phrase is safe to match on: the only other 400 carrying it is the
       * DTO's "Enter your current password", which is about the same field —
       * and the submit guard above makes that one unreachable anyway.
       */
      if (err instanceof ApiError && err.status === 400 && /current password/i.test(err.message)) {
        setCurrentPasswordError(t.profile.passwordCurrentIncorrect);
        return;
      }
      setError(t.profile.passwordUpdateFailed);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      snapHeight={succeeded ? 420 : 600}
      title={succeeded ? t.profile.passwordUpdatedTitle : t.profile.changePassword}
      subtitle={succeeded ? undefined : t.profile.changePasswordSubtitle}
      showClose
      dismissible={!changePassword.isPending}
    >
      {succeeded ? (
        <View style={styles.successPane}>
          <SheetSuccess title={t.profile.passwordUpdatedTitle} body={t.profile.passwordUpdatedBody} />
          <Button title={t.common.close} onPress={handleClose} size="lg" style={styles.successButton} />
        </View>
      ) : (
        <SheetForm
          /* Pinned outside the scroll, floated above the keyboard by SheetForm,
             so the submit is never something you have to scroll to find while
             the last field is focused. The failure line rides with it for the
             same reason. */
          action={
            <>
              {error ? <ErrorNotice message={error} /> : null}
              <Button
                title={t.profile.updatePassword}
                onPress={handleSubmit}
                loading={changePassword.isPending}
                disabled={!canSubmit}
                size="lg"
                icon="lock-closed-outline"
                style={styles.actionButton}
              />
            </>
          }
        >
          <FieldLabel>{t.profile.currentPasswordLabel}</FieldLabel>
          <SheetInput
            value={currentPassword}
            onChangeText={(value) => {
              setCurrentPassword(value);
              // Typing here is the fix for "that was wrong", so the message goes
              // the moment the user starts making it.
              setCurrentPasswordError(null);
            }}
            accessibilityLabel={t.profile.currentPasswordLabel}
            secureTextEntry
            revealable
            revealAccessibilityLabel={t.profile.showPassword}
            hideAccessibilityLabel={t.profile.hidePassword}
            invalid={!!currentPasswordError}
            editable={!changePassword.isPending}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textContentType="password"
            autoComplete="current-password"
            returnKeyType="next"
            onSubmitEditing={() => newRef.current?.focus()}
          />
          {currentPasswordError ? <FieldError>{currentPasswordError}</FieldError> : null}

          <FieldLabel>{t.profile.newPasswordLabel}</FieldLabel>
          <SheetInput
            ref={newRef}
            value={newPassword}
            onChangeText={setNewPassword}
            accessibilityLabel={t.profile.newPasswordLabel}
            secureTextEntry
            revealable
            revealAccessibilityLabel={t.profile.showPassword}
            hideAccessibilityLabel={t.profile.hidePassword}
            invalid={!!newPasswordError}
            editable={!changePassword.isPending}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          {newPasswordError ? <FieldError>{newPasswordError}</FieldError> : null}

          <FieldLabel>{t.profile.confirmPasswordLabel}</FieldLabel>
          <SheetInput
            ref={confirmRef}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            accessibilityLabel={t.profile.confirmPasswordLabel}
            secureTextEntry
            revealable
            revealAccessibilityLabel={t.profile.showPassword}
            hideAccessibilityLabel={t.profile.hidePassword}
            invalid={!!confirmPasswordError}
            editable={!changePassword.isPending}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          {confirmPasswordError ? <FieldError>{confirmPasswordError}</FieldError> : null}
        </SheetForm>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  successPane: { flex: 1, justifyContent: "center" },
  successButton: { alignSelf: "stretch", marginTop: theme.spacing.lg },
  /** The pinned bar owns its own spacing, so the button inside it adds none. */
  actionButton: { alignSelf: "stretch" },
});
