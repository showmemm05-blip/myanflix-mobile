import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ThemedText } from "@/components/ui/ThemedText";
import { ErrorNotice, SheetForm } from "@/components/wallet/SheetForm";
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
 * asks once more in a native dialog, then calls DELETE /users/me.
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
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    // Closing mid-request would hide the one answer this action gets.
    if (isDeleting) return;
    onClose();
    setError(null);
  };

  const runDelete = async () => {
    setError(null);
    setIsDeleting(true);
    try {
      await deleteAccount();
      // The navigator has already swapped to sign-in; the dialog outlives it.
      Alert.alert(p.deleteAccountDoneTitle, p.deleteAccountDoneBody);
    } catch (err) {
      setError(describeError(err, t));
    } finally {
      setIsDeleting(false);
    }
  };

  const confirm = () => {
    if (isDeleting) return;
    Alert.alert(p.deleteAccountConfirmTitle, p.deleteAccountConfirmBody, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: p.deleteAccountConfirmAction,
        style: "destructive",
        onPress: () => {
          void runDelete();
        },
      },
    ]);
  };

  const points: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: "person-remove-outline", text: p.deleteAccountPointData },
    { icon: "receipt-outline", text: p.deleteAccountPointRecords },
    { icon: "wallet-outline", text: p.deleteAccountPointMoney },
    { icon: "call-outline", text: p.deleteAccountPointPhone },
  ];

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      snapHeight={600}
      title={p.deleteAccount}
      subtitle={p.deleteAccountSubtitle}
      showClose
      dismissible={!isDeleting}
    >
      <SheetForm
        action={
          <>
            {error ? <ErrorNotice message={error} /> : null}
            <Button
              title={p.deleteAccountButton}
              onPress={confirm}
              loading={isDeleting}
              disabled={isDeleting}
              size="lg"
              icon="trash-outline"
              color={theme.colors.danger}
              style={styles.actionButton}
            />
          </>
        }
      >
        <View style={styles.points}>
          {points.map((point) => (
            <View key={point.icon} style={styles.point}>
              <Ionicons name={point.icon} size={18} color={theme.colors.textMuted} style={styles.pointIcon} />
              <ThemedText variant="body" style={styles.pointText}>
                {point.text}
              </ThemedText>
            </View>
          ))}
        </View>
      </SheetForm>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  points: { gap: theme.spacing.md },
  point: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  pointIcon: { marginTop: 2 },
  pointText: { flex: 1, color: theme.colors.textMuted },
  /** The pinned bar owns its own spacing, so the button inside it adds none. */
  actionButton: { alignSelf: "stretch" },
});
