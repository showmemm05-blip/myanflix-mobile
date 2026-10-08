import { useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ThemedText } from "@/components/ui/ThemedText";
import { SheetForm } from "@/components/wallet/SheetForm";
import {
  ActionButton,
  IconDisc,
  Notice,
  SheetHeader,
  SheetIntro,
  accountActionBar,
} from "@/components/profile/AccountKit";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/localization/LanguageProvider";
import type { TranslationShape } from "@/localization/translations";
import { ApiError } from "@/utils/errors";
import { theme } from "@/theme";

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * The server's refusals, in the user's language. Every 409/403 DELETE
 * /users/me can answer with is listed in backend users.service.ts
 * (ACCOUNT_DELETE_*_MESSAGE and the staff check); the wording is matched,
 * never rendered raw.
 */
function describeError(err: unknown, t: TranslationShape): string {
  const p = t.profile;
  if (!(err instanceof ApiError)) return p.deleteAccountFailed;
  if (err.status === 0) return t.common.networkError;
  if (err.status === 403) return p.deleteAccountStaffError;
  if (err.status === 409) {
    if (/wallet still has money/i.test(err.message)) return p.deleteAccountBalanceError;
    if (/deposit waiting/i.test(err.message)) return p.deleteAccountPendingDepositError;
    if (/withdrawal waiting/i.test(err.message)) return p.deleteAccountPendingWithdrawalError;
  }
  return p.deleteAccountFailed;
}

/**
 * "Delete account" (audit H-16; app-store rule): says plainly what happens,
 * asks once more in an in-app dialog, then calls DELETE /users/me.
 * Marquee: DeleteAccount.dc.html — a red trash disc, the title over a bold
 * red "This can't be undone.", four points on hairlines, one deep-red button.
 *
 * The confirmation is the board's in-app dialog (owner, 2026-10-05; it was
 * the native OS alert before), with the same strings the alert carried. It
 * stays open while the request runs — its Delete shows the busy dots and
 * nothing can close it — and a refusal closes it and lands in the sheet's
 * notice, as before. The dialog is rendered INSIDE the sheet: iOS presents a
 * Modal from the nearest view controller, which here is the sheet's own.
 *
 * The server decides whether it may happen — it refuses while the wallet
 * holds money or a deposit/withdrawal is waiting for review — so nothing is
 * pre-checked here from a balance that may be stale; the refusal is shown in
 * the sheet instead. On success the server has already revoked every session,
 * and the app signs out locally exactly as "Log out" does, which takes this
 * screen away.
 */
export function DeleteAccountSheet({ visible, onClose }: Props) {
  const { t } = useLanguage();
  const p = t.profile;
  const { deleteAccount } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Set in the same tick as the tap, unlike `isDeleting`, which a second tap
   * landing before the next render would still read as false. The native
   * alert closed itself on the first tap; this dialog stays open, so this is
   * what keeps a fast double tap to ONE DELETE /users/me.
   */
  const inFlight = useRef(false);

  const handleClose = () => {
    // Closing mid-request would hide the one answer this action gets.
    if (inFlight.current) return;
    onClose();
    setConfirming(false);
    setError(null);
  };

  const runDelete = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setIsDeleting(true);
    try {
      await deleteAccount();
      setConfirming(false);
      // The navigator has already swapped to sign-in; this NATIVE notice
      // outlives the screen (it is drawn in a window of its own), which an
      // in-app dialog in this unmounting sheet could not.
      Alert.alert(p.deleteAccountDoneTitle, p.deleteAccountDoneBody);
    } catch (err) {
      setConfirming(false);
      setError(describeError(err, t));
    } finally {
      inFlight.current = false;
      setIsDeleting(false);
    }
  };

  const confirm = () => {
    if (inFlight.current) return;
    setConfirming(true);
  };

  const cancelConfirm = () => {
    if (inFlight.current) return;
    setConfirming(false);
  };

  const points: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: "person-remove-outline", text: p.deleteAccountPointData },
    { icon: "receipt-outline", text: p.deleteAccountPointRecords },
    { icon: "wallet-outline", text: p.deleteAccountPointMoney },
    { icon: "call-outline", text: p.deleteAccountPointPhone },
  ];

  const header = (
    <SheetHeader onClose={handleClose} closeLabel={t.common.close} closeDisabled={isDeleting}>
      <IconDisc icon="trash-outline" color={theme.colors.danger} fill={theme.colors.dangerSoft} size={64} iconSize={28} />
    </SheetHeader>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      snapHeight={700}
      header={header}
      dismissible={!isDeleting}
    >
      <SheetForm
        actionStyle={accountActionBar}
        action={
          <>
            {error ? <Notice message={error} /> : null}
            <ActionButton
              title={p.deleteAccountButton}
              tone="destructive"
              icon="trash-outline"
              onPress={confirm}
              loading={isDeleting}
            />
          </>
        }
      >
        <SheetIntro
          title={p.deleteAccount}
          subtitle={p.deleteAccountSubtitle}
          subtitleTone="danger"
          style={styles.intro}
        />
        <View style={styles.points}>
          {points.map((point, index) => (
            <View key={point.icon} style={[styles.point, index < points.length - 1 && styles.pointDivider]}>
              <View style={styles.pointDisc} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Ionicons name={point.icon} size={18} color={theme.colors.textMuted} />
              </View>
              <ThemedText variant="body" color={theme.colors.textBody} style={styles.pointText}>
                {point.text}
              </ThemedText>
            </View>
          ))}
        </View>
        {/* Its own window, so where it sits here does not affect the layout —
            only that it is inside the sheet (see the note above). */}
        <ConfirmDialog
          visible={confirming}
          title={p.deleteAccountConfirmTitle}
          message={p.deleteAccountConfirmBody}
          confirmLabel={p.deleteAccountConfirmAction}
          cancelLabel={t.common.cancel}
          onConfirm={() => {
            void runDelete();
          }}
          onCancel={cancelConfirm}
          busy={isDeleting}
        />
      </SheetForm>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: theme.spacing.md },
  points: { marginTop: 20 },
  point: { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingVertical: 12 },
  pointDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  pointDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  /** The board's 6pt drop centres the first line on the 36pt disc. */
  pointText: { flex: 1, paddingTop: 6 },
});
