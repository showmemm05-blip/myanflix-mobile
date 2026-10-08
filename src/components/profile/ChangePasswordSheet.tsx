import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View, type TextInput } from "react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SheetForm } from "@/components/wallet/SheetForm";
import {
  AccountField,
  ActionButton,
  FieldCaption,
  IconDisc,
  InlineError,
  Notice,
  SheetHeader,
  SheetIntro,
  SuccessPanel,
  accountActionBar,
} from "@/components/profile/AccountKit";
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
 * Marquee: ChangePassword.dc.html — a crimson lock disc, the 24pt title, three
 * 56pt fields with an eye toggle each, one crimson commit.
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
  const busy = changePassword.isPending;

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

  const header = (
    <SheetHeader onClose={handleClose} closeLabel={t.common.close} closeDisabled={busy}>
      {succeeded ? null : (
        <IconDisc icon="lock-closed-outline" color={theme.colors.link} fill={theme.colors.primarySoft} />
      )}
    </SheetHeader>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      snapHeight={succeeded ? 440 : 640}
      header={header}
      dismissible={!busy}
    >
      {succeeded ? (
        /* Centred while it fits; at large text sizes the tick, the two lines
           and Close outgrow the 440pt sheet, and it scrolls instead of
           pushing Close off the bottom edge. */
        <ScrollView
          style={styles.successScroll}
          contentContainerStyle={styles.successPane}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >
          <SuccessPanel title={t.profile.passwordUpdatedTitle} body={t.profile.passwordUpdatedBody} />
          <ActionButton title={t.common.close} tone="play" onPress={handleClose} style={styles.successButton} />
        </ScrollView>
      ) : (
        <SheetForm
          actionStyle={accountActionBar}
          /* Pinned outside the scroll, floated above the keyboard by SheetForm,
             so the submit is never something you have to scroll to find while
             the last field is focused. The failure line rides with it for the
             same reason. */
          action={
            <>
              {error ? <Notice message={error} /> : null}
              <ActionButton
                title={t.profile.updatePassword}
                icon="lock-closed-outline"
                onPress={handleSubmit}
                loading={busy}
                disabled={!canSubmit}
              />
            </>
          }
        >
          <SheetIntro
            title={t.profile.changePassword}
            subtitle={t.profile.changePasswordSubtitle}
            style={styles.intro}
          />

          <View style={styles.fields}>
            <View>
              <FieldCaption>{t.profile.currentPasswordLabel}</FieldCaption>
              <View style={styles.fieldGap}>
                <AccountField
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
                  editable={!busy}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  textContentType="password"
                  autoComplete="current-password"
                  returnKeyType="next"
                  onSubmitEditing={() => newRef.current?.focus()}
                />
              </View>
              {currentPasswordError ? <InlineError>{currentPasswordError}</InlineError> : null}
            </View>

            <View>
              <FieldCaption>{t.profile.newPasswordLabel}</FieldCaption>
              <View style={styles.fieldGap}>
                <AccountField
                  ref={newRef}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  accessibilityLabel={t.profile.newPasswordLabel}
                  secureTextEntry
                  revealable
                  revealAccessibilityLabel={t.profile.showPassword}
                  hideAccessibilityLabel={t.profile.hidePassword}
                  invalid={!!newPasswordError}
                  editable={!busy}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  textContentType="newPassword"
                  autoComplete="new-password"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                />
              </View>
              {newPasswordError ? <InlineError>{newPasswordError}</InlineError> : null}
            </View>

            <View>
              <FieldCaption>{t.profile.confirmPasswordLabel}</FieldCaption>
              <View style={styles.fieldGap}>
                <AccountField
                  ref={confirmRef}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  accessibilityLabel={t.profile.confirmPasswordLabel}
                  secureTextEntry
                  revealable
                  revealAccessibilityLabel={t.profile.showPassword}
                  hideAccessibilityLabel={t.profile.hidePassword}
                  invalid={!!confirmPasswordError}
                  editable={!busy}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  textContentType="newPassword"
                  autoComplete="new-password"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              </View>
              {confirmPasswordError ? <InlineError>{confirmPasswordError}</InlineError> : null}
            </View>
          </View>
        </SheetForm>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: theme.spacing.md },
  fields: { gap: 20, marginTop: theme.spacing.lg },
  fieldGap: { marginTop: theme.spacing.sm },
  successScroll: { flex: 1 },
  successPane: { flexGrow: 1, justifyContent: "center", paddingBottom: theme.spacing.sm },
  successButton: { marginTop: theme.spacing.xl },
});
