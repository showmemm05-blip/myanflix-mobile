import { useState } from "react";
import { AccessibilityInfo, Linking, Pressable, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ThemedText } from "@/components/ui/ThemedText";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SheetForm } from "@/components/wallet/SheetForm";
import {
  AccountField,
  ActionButton,
  BusyDots,
  Notice,
  SheetHeader,
  accountActionBar,
} from "@/components/profile/AccountKit";
import { useRemoveAvatar, useUpdateProfile, useUploadAvatar } from "@/hooks/useProfile";
import { pickAvatar } from "@/services/photo-picker";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import { ApiError } from "@/utils/errors";
import { displayNameOf, initials } from "@/utils/format";
import type { AppUser } from "@/types/user";

/** Mirrors the backend's 1..40 rule on the trimmed name. */
const MAX_DISPLAY_NAME = 40;
/** EditProfile.dc.html's centred portrait. */
const AVATAR_SIZE = 120;

interface Props {
  user: AppUser;
  visible: boolean;
  onClose: () => void;
}

/**
 * A login identity the account owner can see but not edit — the label on the
 * left, the value and a padlock on the right. Wraps under the label rather
 * than truncating when a large text size leaves no room beside it.
 */
function ReadOnlyRow({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  return (
    <View style={[styles.readOnlyRow, divider && styles.readOnlyDivider]} accessible accessibilityLabel={`${label}, ${value}`}>
      <ThemedText variant="body" color={theme.colors.textMuted}>
        {label}
      </ThemedText>
      <View style={styles.readOnlyValue}>
        <ThemedText variant="body" weight="bold" tabular style={styles.readOnlyText}>
          {value}
        </ThemedText>
        <Ionicons name="lock-closed-outline" size={15} color={theme.colors.textFaint} />
      </View>
    </View>
  );
}

/** The boards' 44pt pill for the photo actions (Upload/Change, Remove). */
function PhotoPill({
  title,
  icon,
  onPress,
  disabled,
  busy,
  tone = "tonal",
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: "tonal" | "danger" | "plain";
}) {
  const reduceMotion = useReducedMotion();
  const ink =
    tone === "danger" ? theme.colors.danger : theme.colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={({ pressed }) => [
        styles.pill,
        tone === "tonal" && styles.pillTonal,
        disabled && styles.pillDisabled,
        pressed && !disabled && (reduceMotion ? styles.pressedStill : styles.pressed),
      ]}
    >
      <Ionicons name={icon} size={18} color={ink} />
      <ThemedText weight={tone === "plain" ? "extrabold" : "bold"} color={ink} style={styles.pillLabel}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

/**
 * "Edit profile" — the profile photo, one editable field (the display name)
 * and the two identities you sign in with, shown read-only so it is obvious
 * they exist and equally obvious why they are not editable.
 * Marquee: EditProfile.dc.html — close · centred title, a 120pt portrait with
 * its photo pills under it, the 56pt name field, the two locked identities.
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
  const reduceMotion = useReducedMotion();
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
   * Every photo message lands here and renders in the line under the photo
   * pills — NOT in the pinned notice, which belongs to Save and speaks for the
   * whole form. A message about the picture points at the picture. (This app
   * has no toast.)
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

  const header = (
    <SheetHeader
      onClose={handleClose}
      closeLabel={t.common.close}
      closeDisabled={updateProfile.isPending || photoPending}
      closeSide="left"
      centerTitle={t.profile.editProfile}
    />
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      // One fixed height, never conditional on whether Remove is showing: that
      // button appears the instant an upload lands, and resizing the sheet
      // under the user's finger at that moment is worse than a little slack.
      snapHeight={780}
      header={header}
      dismissible={!updateProfile.isPending && !photoPending}
    >
      <SheetForm
        actionStyle={accountActionBar}
        action={
          <>
            {error ? <Notice message={error} /> : null}
            <ActionButton
              title={t.common.save}
              icon="checkmark"
              onPress={handleSave}
              loading={updateProfile.isPending}
              disabled={!canSubmit}
            />
          </>
        }
      >
        {/* The subtitle scrolls with the form rather than riding in the fixed
            header: it wraps freely, and at large text sizes (long Burmese
            especially) a header that grows with it would leave little room
            for the name field once the keyboard is up. */}
        <ThemedText variant="caption" color={theme.colors.textFaint} style={styles.subtitle}>
          {t.profile.editProfileSubtitle}
        </ThemedText>

        {/* The photo goes first, matching the website's Photo-then-Details
            order — and because these are buttons rather than fields, keeping
            them above the only text input means SheetForm's reveal-on-focus
            never has to fight them. */}
        <View
          style={styles.avatarWrap}
          accessible
          accessibilityRole="image"
          accessibilityLabel={t.profile.photoSection}
          accessibilityState={{ busy: photoPending }}
        >
          {shownAvatar ? (
            <Image
              source={{ uri: shownAvatar }}
              style={styles.avatar}
              contentFit="cover"
              transition={reduceMotion ? 0 : 200}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              {/* The same helpers the profile hero and the top bar use, so
                  all three fall back to the same two letters. */}
              <ThemedText weight="extrabold" color={theme.colors.onAvatar} style={styles.initials}>
                {initials(displayNameOf(user))}
              </ThemedText>
            </View>
          )}
          {photoPending ? (
            <View style={styles.avatarBusy}>
              <BusyDots color={theme.colors.text} />
            </View>
          ) : null}
        </View>

        <View style={styles.photoActions}>
          <PhotoPill
            title={user.avatarUrl ? t.profile.changePhoto : t.profile.uploadPhoto}
            icon="camera-outline"
            onPress={handleChangePhoto}
            // Both pills are disabled together so neither request can start
            // while the other is running — but Save is untouched.
            disabled={photoPending}
            busy={photoBusy === "upload"}
          />
          {user.avatarUrl ? (
            <PhotoPill
              title={t.profile.removePhoto}
              icon="trash-outline"
              tone="danger"
              onPress={handleRemovePhoto}
              disabled={photoPending}
              busy={photoBusy === "remove"}
            />
          ) : null}
        </View>
        {photoError ? (
          <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite">
            <ThemedText variant="caption" weight="semibold" color={theme.colors.danger} style={styles.photoMessage}>
              {photoError}
            </ThemedText>
          </View>
        ) : (
          <ThemedText variant="caption" color={theme.colors.textFaint} style={styles.photoMessage}>
            {t.profile.photoSectionHint}
          </ThemedText>
        )}
        {settingsNeeded ? (
          <View style={styles.settingsRow}>
            <PhotoPill
              title={t.profile.photoOpenSettings}
              icon="options-outline"
              tone="plain"
              onPress={() => {
                // Nothing useful to say if the OS refuses to open its own
                // settings, and the message above already stands.
                Linking.openSettings().catch(() => {});
              }}
            />
          </View>
        ) : null}

        {/* The board's overline label. Burmese has no case and ThemedText
            drops its tracking, so only the English reads as capitals. */}
        <ThemedText variant="overline" style={styles.nameLabel}>
          {t.profile.displayNameLabel.toUpperCase()}
        </ThemedText>
        <View style={styles.nameField}>
          <AccountField
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={user.username}
            accessibilityLabel={t.profile.displayNameLabel}
            // A soft stop well above the 40 the server enforces, so typing past
            // the limit shows the message instead of silently swallowing keys.
            maxLength={80}
            autoCapitalize="words"
            autoCorrect={false}
            autoComplete="nickname"
            returnKeyType="done"
            onSubmitEditing={handleSave}
            editable={!updateProfile.isPending}
            invalid={tooLong}
          />
        </View>
        {tooLong ? (
          <View accessibilityLiveRegion="polite">
            <ThemedText variant="caption" weight="semibold" color={theme.colors.danger} style={styles.nameHelp}>
              {t.profile.displayNameTooLong}
            </ThemedText>
          </View>
        ) : (
          <ThemedText variant="caption" color={theme.colors.textFaint} style={styles.nameHelp}>
            {t.profile.displayNameHint}
          </ThemedText>
        )}

        <View style={styles.identities}>
          <ReadOnlyRow label={t.profile.usernameLabel} value={user.username} divider />
          <ReadOnlyRow label={t.profile.phoneLabel} value={user.phone ?? t.profile.phoneNotSet} />
        </View>

        <ThemedText variant="caption" color={theme.colors.textFaint} style={styles.lockText}>
          {t.profile.loginIdentityNote}
        </ThemedText>
      </SheetForm>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  subtitle: { textAlign: "center", paddingBottom: theme.spacing.xs },
  avatarWrap: {
    alignSelf: "center",
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    marginTop: 20,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
  },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.avatar,
  },
  initials: { fontSize: 42, lineHeight: 52 },
  avatarBusy: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,8,11,0.55)",
  },
  /** Centred and wrapping: at large text sizes the two pills stack instead of overflowing. */
  photoActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: theme.layout.minTouch,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 18,
    borderRadius: 22,
    maxWidth: "100%",
  },
  pillTonal: { backgroundColor: theme.colors.tonal },
  pillDisabled: { opacity: 0.5 },
  pillLabel: { flexShrink: 1 },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.8 },
  photoMessage: { marginTop: 10, textAlign: "center" },
  settingsRow: { alignItems: "center", marginTop: 6 },
  nameLabel: { marginTop: 28 },
  nameField: { marginTop: theme.spacing.sm },
  nameHelp: { marginTop: theme.spacing.sm },
  identities: { marginTop: theme.spacing.lg },
  readOnlyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    minHeight: 56,
    paddingVertical: theme.spacing.sm,
  },
  readOnlyDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  readOnlyValue: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexShrink: 1 },
  readOnlyText: { flexShrink: 1, textAlign: "right" },
  lockText: { marginTop: 12 },
});
