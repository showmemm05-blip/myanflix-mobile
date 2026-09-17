import { useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Linking, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import {
  ErrorNotice,
  FieldError,
  FieldLabel,
  HelperText,
  SheetForm,
  SheetInput,
} from "@/components/wallet/SheetForm";
import { useRemoveAvatar, useUpdateProfile, useUploadAvatar } from "@/hooks/useProfile";
import { pickAvatar } from "@/services/photo-picker";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import { ApiError } from "@/utils/errors";
import { displayNameOf, initials } from "@/utils/format";
import type { AppUser } from "@/types/user";

/** Mirrors the backend's 1..40 rule on the trimmed name. */
const MAX_DISPLAY_NAME = 40;

interface Props {
  user: AppUser;
  visible: boolean;
  onClose: () => void;
}

/** A login identity the account owner can see but not edit. */
function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.readOnlyRow}>
      <ThemedText variant="caption" style={styles.readOnlyLabel}>
        {label}
      </ThemedText>
      <ThemedText variant="body" tabular numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

/**
 * "Edit profile" — the profile photo, one editable field (the display name)
 * and the two identities you sign in with, shown read-only so it is obvious
 * they exist and equally obvious why they are not editable.
 *
 * A bottom sheet rather than a pushed screen, for the same reason the feedback
 * sheet is one: it is a short form you fill in and dismiss, and the app's
 * tuned form behaviour — a submit pinned above the keyboard, no bounce, no
 * jump-to-top on focus — lives in `SheetForm` and only works inside a
 * `BottomSheet`.
 *
 * Success is not announced: the hero name behind the sheet has already changed
 * by the time it closes, and this app has no toast to announce it with.
 */
export function EditProfileSheet({ user, visible, onClose }: Props) {
  const { t } = useLanguage();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();
  // Asked for at the point of use, never on mount — a photo prompt on a screen
  // the user only opened to fix their name is how you burn a permission you
  // will need later.
  const [permission, requestPermission] = ImagePicker.useMediaLibraryPermissions();
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [error, setError] = useState<string | null>(null);

  /**
   * The photo's own busy flag, kept apart from `updateProfile.isPending` on
   * purpose: these are two independent requests to two different endpoints, so
   * an upload must not grey out Save and a rename must not grey out the camera
   * button. They only ever meet at dismissal, below.
   */
  const [photoBusy, setPhotoBusy] = useState<"upload" | "remove" | null>(null);
  /**
   * Every photo message lands here and renders as a `FieldError` under the
   * photo row — NOT in the pinned `ErrorNotice`, which belongs to Save and
   * speaks for the whole form. A message about the picture points at the
   * picture. (This app has no toast.)
   */
  const [photoError, setPhotoError] = useState<string | null>(null);
  /** Only after a permanent refusal, when re-asking is no longer possible. */
  const [settingsNeeded, setSettingsNeeded] = useState(false);
  /**
   * The local file just picked, shown while the upload is in flight so the
   * chosen picture is on screen before the round trip finishes.
   */
  const [preview, setPreview] = useState<string | null>(null);

  const shownAvatar = preview ?? user.avatarUrl;
  const photoPending = photoBusy !== null;

  const trimmed = displayName.trim();
  // `null` clears the name back to unset. Never `""` — the backend trims it and
  // then fails its own 1..40 length rule, which is a 400, not a clear.
  const nextName = trimmed.length > 0 ? trimmed : null;
  const tooLong = trimmed.length > MAX_DISPLAY_NAME;
  const dirty = nextName !== (user.displayName ?? null);
  const canSubmit = dirty && !tooLong;

  const handleClose = () => {
    // A save that lands after the sheet is gone leaves the user with no idea
    // whether their name was taken, so an in-flight request refuses the close.
    // The scrim and the drag are stopped at the source by `dismissible` below —
    // refusing the drag HERE would be too late, since it has already animated
    // the sheet off-screen by the time it reports. This still guards the header
    // X and Android's hardware back, neither of which moves anything.
    // The same reasoning covers an in-flight photo upload, which is why
    // `photoBusy` extends this guard rather than adding a second mechanism.
    if (updateProfile.isPending || photoPending) return;
    closeAndReset();
  };

  /**
   * Close, then wipe every transient state once the slide-out is over, so the
   * form does not visibly change while it is still on screen. The typed name is
   * deliberately KEPT — no "discard?" interrogation for one field.
   *
   * Shared with the Save path rather than duplicated there: this component
   * stays mounted for the life of the profile screen and only toggles
   * `visible`, so a close that skips this leaves the last photo error — or a
   * stale preview — sitting there waiting to reappear the next time the sheet
   * is opened, attached to nothing the user did.
   */
  function closeAndReset() {
    onClose();
    setTimeout(() => {
      setError(null);
      setPhotoError(null);
      setSettingsNeeded(false);
      setPreview(null);
    }, 250);
  }

  /**
   * Returns true when the library may be opened. `limited` counts as yes:
   * iOS 14+ / Android 14+ "selected photos" is a perfectly good state for
   * picking one avatar, and refusing it would strand those users.
   */
  const ensurePhotoPermission = async () => {
    if (permission?.granted) return true;
    const next = await requestPermission();
    if (next.granted || next.accessPrivileges === "limited") return true;
    setPhotoError(t.profile.photoPermissionDenied);
    // `canAskAgain === false` is "don't ask again" / iOS Denied — the OS will
    // never prompt again, so Settings is the only route left. While it can
    // still ask, the next tap simply re-asks, and sending someone to Settings
    // for a dialog they can just re-answer is the worse outcome.
    setSettingsNeeded(!next.canAskAgain);
    return false;
  };

  const handleChangePhoto = async () => {
    // Re-checked rather than assumed, the same way `handleSave` does.
    if (photoPending) return;
    setPhotoError(null);
    setSettingsNeeded(false);
    // Set BEFORE the permission dialog and the picker, not just around the
    // request. That is what closes the double-tap hole AND what keeps the sheet
    // from being dragged away during the whole time the OS picker is on top of
    // it — `dismissible` below reads this flag.
    setPhotoBusy("upload");
    try {
      if (!(await ensurePhotoPermission())) return;

      const picked = await pickAvatar();
      if (!picked.ok) {
        // "canceled" is not a failure and says nothing.
        if (picked.reason === "invalidType") setPhotoError(t.profile.photoInvalidType);
        else if (picked.reason === "tooLarge") setPhotoError(t.profile.photoTooLarge);
        return;
      }

      setPreview(picked.uri);
      try {
        await uploadAvatar.mutateAsync(picked.form);
        // The swapped avatar is the entire confirmation, and a screen-reader
        // user cannot perceive it — so it is spoken rather than shown.
        AccessibilityInfo.announceForAccessibility(t.profile.photoUpdated);
        // The preview is deliberately NOT cleared here. The backend versions
        // the stored key with a timestamp, so every upload is a brand-new URL
        // expo-image has never fetched; clearing would blink the new photo back
        // to the initials for a whole round trip. It stays as a local copy of
        // exactly what the server now holds. (Which is also why no `?t=` cache
        // buster belongs on the URL: there is no stale entry to bust, and one
        // would re-download the avatar on every mount.)
      } catch (err) {
        // Nothing was stored, so fall back to whatever is still on the server.
        setPreview(null);
        // The server's own 400/413 text is English and written for logs; the
        // user gets the same one line the local checks would have given.
        const status = err instanceof ApiError ? err.status : 0;
        setPhotoError(
          status === 413
            ? t.profile.photoTooLarge
            : status === 400
              ? t.profile.photoInvalidType
              : t.profile.photoUploadFailed,
        );
      }
    } finally {
      setPhotoBusy(null);
    }
  };

  const handleRemovePhoto = async () => {
    if (photoPending) return;
    setPhotoError(null);
    setSettingsNeeded(false);
    setPhotoBusy("remove");
    try {
      await removeAvatar.mutateAsync();
      // A photo uploaded moments ago is still sitting in `preview`; without
      // this it would linger in the sheet after being removed.
      setPreview(null);
      AccessibilityInfo.announceForAccessibility(t.profile.photoRemoved);
    } catch {
      setPhotoError(t.profile.photoRemoveFailed);
    } finally {
      setPhotoBusy(null);
    }
  };

  const handleSave = async () => {
    // The keyboard's Done key reaches this without going through the button's
    // disabled state, so the guard is re-checked rather than assumed.
    if (!canSubmit || updateProfile.isPending) return;
    setError(null);
    try {
      const updated = await updateProfile.mutateAsync(nextName);
      // Echo the server's value back, so a trim it applied is visible rather
      // than leaving the field disagreeing with what was stored.
      setDisplayName(updated.displayName ?? "");
      closeAndReset();
    } catch {
      // The backend's 400 text is English and written for logs; the user gets
      // one localized line instead.
      setError(t.profile.profileUpdateFailed);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      // One fixed height, never conditional on whether Remove is showing: that
      // button appears the instant an upload lands, and resizing the sheet
      // under the user's finger at that moment is worse than a little slack.
      snapHeight={620}
      title={t.profile.editProfile}
      subtitle={t.profile.editProfileSubtitle}
      showClose
      dismissible={!updateProfile.isPending && !photoPending}
    >
      <SheetForm
        action={
          <>
            {error ? <ErrorNotice message={error} /> : null}
            <Button
              title={t.common.save}
              onPress={handleSave}
              loading={updateProfile.isPending}
              disabled={!canSubmit}
              size="lg"
              icon="checkmark-outline"
              style={styles.actionButton}
            />
          </>
        }
      >
        {/* The photo goes first, matching the website's Photo-then-Details
            order — and because these are buttons rather than fields, keeping
            them above the only text input means SheetForm's reveal-on-focus
            never has to fight them. */}
        <FieldLabel>{t.profile.photoSection}</FieldLabel>
        <View style={styles.photoRow}>
          <View style={styles.avatarWrap}>
            {shownAvatar ? (
              <Image source={{ uri: shownAvatar }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                {/* The same helpers the profile hero and the top bar use, so
                    all three fall back to the same two letters. */}
                <ThemedText variant="title" weight="bold">
                  {initials(displayNameOf(user))}
                </ThemedText>
              </View>
            )}
            {photoPending ? (
              <View style={styles.avatarBusy}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : null}
          </View>

          <View style={styles.photoActions}>
            <Button
              title={user.avatarUrl ? t.profile.changePhoto : t.profile.uploadPhoto}
              onPress={handleChangePhoto}
              variant="soft"
              icon="camera-outline"
              loading={photoBusy === "upload"}
              // Both buttons are disabled together so neither request can start
              // while the other is running — but Save is untouched.
              disabled={photoPending}
            />
            {user.avatarUrl ? (
              <Button
                title={t.profile.removePhoto}
                onPress={handleRemovePhoto}
                variant="ghost"
                icon="trash-outline"
                color={theme.colors.danger}
                loading={photoBusy === "remove"}
                disabled={photoPending}
              />
            ) : null}
          </View>
        </View>
        {photoError ? <FieldError>{photoError}</FieldError> : <HelperText>{t.profile.photoSectionHint}</HelperText>}
        {settingsNeeded ? (
          <Button
            title={t.profile.photoOpenSettings}
            onPress={() => {
              // Nothing useful to say if the OS refuses to open its own
              // settings, and the message above already stands.
              Linking.openSettings().catch(() => {});
            }}
            variant="ghost"
            icon="settings-outline"
            style={styles.settingsButton}
          />
        ) : null}

        <FieldLabel>{t.profile.displayNameLabel}</FieldLabel>
        <SheetInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={user.username}
          accessibilityLabel={t.profile.displayNameLabel}
          // A soft stop well above the 40 the server enforces, so typing past
          // the limit shows the message instead of silently swallowing keys.
          maxLength={80}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleSave}
          editable={!updateProfile.isPending}
          invalid={tooLong}
        />
        {tooLong ? (
          <FieldError>{t.profile.displayNameTooLong}</FieldError>
        ) : (
          <HelperText>{t.profile.displayNameHint}</HelperText>
        )}

        <View style={styles.identities}>
          <ReadOnlyRow label={t.profile.usernameLabel} value={user.username} />
          <ReadOnlyRow label={t.profile.phoneLabel} value={user.phone ?? t.profile.phoneNotSet} />
        </View>

        <View style={styles.lockNote}>
          <Ionicons name="lock-closed-outline" size={14} color={theme.colors.textFaint} style={styles.lockIcon} />
          <ThemedText variant="caption" style={styles.lockText}>
            {t.profile.loginIdentityNote}
          </ThemedText>
        </View>
      </SheetForm>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actionButton: { alignSelf: "stretch" },
  photoRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  avatarWrap: { width: 72, height: 72 },
  /** 72 rather than the hero's 92 — it shares this row with two buttons. */
  avatar: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
  },
  avatarBusy: {
    ...StyleSheet.absoluteFill,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.scrim,
    alignItems: "center",
    justifyContent: "center",
  },
  /** Stacked, not side by side: two labelled buttons do not fit one ~240pt column. */
  photoActions: { flex: 1, gap: theme.spacing.sm },
  settingsButton: { alignSelf: "flex-start", marginTop: theme.spacing.xs },
  identities: { gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  readOnlyRow: {
    gap: 2,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSunken,
  },
  readOnlyLabel: { color: theme.colors.textFaint },
  lockNote: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  lockIcon: { marginTop: 2 },
  lockText: { flex: 1, color: theme.colors.textFaint },
});
