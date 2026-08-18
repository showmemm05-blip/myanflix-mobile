import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import {
  ErrorNotice,
  FieldLabel,
  HelperText,
  MethodGrid,
  QuickAmounts,
  SheetInput,
  SheetSuccess,
} from "@/components/wallet/SheetForm";
import { useCreateWithdrawal } from "@/hooks/useWithdrawals";
import { useFinanceSettings } from "@/hooks/useFinanceSettings";
import { usePaymentAccountTypes } from "@/hooks/usePaymentAccounts";
import { useWallet } from "@/hooks/useWallet";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatKyat } from "@/utils/currency";
import { ApiError } from "@/utils/errors";
import { theme } from "@/theme";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000];
const DEFAULT_AMOUNT = "10000";

export function WithdrawSheet({ visible, onClose }: Props) {
  const { t } = useLanguage();
  const createWithdrawal = useCreateWithdrawal();
  const { data: financeSettings } = useFinanceSettings();
  const { data: types } = usePaymentAccountTypes();
  const { data: wallet } = useWallet();
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const availableBalance = wallet?.balance ?? 0;
  const numericAmount = Number(amount) || 0;
  // Same catalog flag the admin sets per payment method — a bank transfer needs
  // a bank named, a mobile wallet doesn't.
  const requiresBankName = Boolean(types?.find((ty) => ty.value === accountType)?.requiresBankName);

  const reset = () => {
    setAmount(DEFAULT_AMOUNT);
    setAccountType(null);
    setAccountName("");
    setAccountNumber("");
    setBankName("");
    setError(null);
    setSucceeded(false);
  };

  const handleClose = () => {
    onClose();
    // Wait for the sheet's own close animation before resetting, so the
    // form doesn't visibly snap back to defaults while still sliding away.
    setTimeout(reset, 250);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!accountType) {
      setError(t.wallet.withdrawNoType);
      return;
    }
    if (!accountName.trim() || !accountNumber.trim()) {
      setError(t.wallet.withdrawAccountError);
      return;
    }
    if (requiresBankName && !bankName.trim()) {
      setError(t.wallet.withdrawBankNameError);
      return;
    }
    if (!numericAmount || numericAmount <= 0) {
      setError(t.wallet.withdrawAmountError);
      return;
    }
    if (
      financeSettings &&
      (numericAmount < financeSettings.minWithdrawalAmount || numericAmount > financeSettings.maxWithdrawalAmount)
    ) {
      setError(
        t.wallet.amountRangeError
          .replace("{min}", formatKyat(financeSettings.minWithdrawalAmount))
          .replace("{max}", formatKyat(financeSettings.maxWithdrawalAmount)),
      );
      return;
    }
    if (numericAmount > availableBalance) {
      setError(t.wallet.withdrawInsufficientError);
      return;
    }
    try {
      await createWithdrawal.mutateAsync({
        amount: numericAmount,
        accountType,
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        bankName: requiresBankName ? bankName.trim() : undefined,
      });
      setSucceeded(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.wallet.withdrawFailure);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      snapHeight={660}
      title={succeeded ? t.wallet.withdrawSuccessTitle : t.wallet.withdrawTitle}
      subtitle={succeeded ? undefined : t.wallet.withdrawAvailable.replace("{balance}", formatKyat(availableBalance))}
      showClose
    >
      {succeeded ? (
        <View style={styles.successPane}>
          <SheetSuccess title={t.wallet.withdrawSuccessTitle} body={t.wallet.withdrawSuccessBody} />
          <Button title={t.common.close} onPress={handleClose} size="lg" style={styles.submitButton} />
        </View>
      ) : (
        // The sheet lives in a Modal, which never resizes for the keyboard — without
        // this the account name/number fields are typed into blind behind it.
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <FieldLabel>{t.wallet.depositAmount}</FieldLabel>
            <SheetInput
              value={amount}
              onChangeText={(value) => setAmount(value.replace(/\D/g, ""))}
              keyboardType="number-pad"
              placeholder={DEFAULT_AMOUNT}
              numeric
              accessibilityLabel={t.wallet.depositAmount}
            />
            <QuickAmounts values={QUICK_AMOUNTS} amount={amount} onSelect={(value) => setAmount(String(value))} />
            <HelperText>{t.wallet.withdrawAvailable.replace("{balance}", formatKyat(availableBalance))}</HelperText>
            {financeSettings ? (
              <HelperText>
                {t.wallet.amountRangeHint
                  .replace("{min}", formatKyat(financeSettings.minWithdrawalAmount))
                  .replace("{max}", formatKyat(financeSettings.maxWithdrawalAmount))}
              </HelperText>
            ) : null}

            <FieldLabel>{t.wallet.withdrawAccountType}</FieldLabel>
            <MethodGrid
              options={(types ?? []).map((ty) => ({ key: ty.value, label: ty.label, logoUrl: ty.logoUrl }))}
              selectedKey={accountType}
              onSelect={setAccountType}
            />

            {requiresBankName ? (
              <>
                <FieldLabel>{t.wallet.withdrawBankName}</FieldLabel>
                <SheetInput
                  value={bankName}
                  onChangeText={setBankName}
                  placeholder={t.wallet.withdrawBankNamePlaceholder}
                  accessibilityLabel={t.wallet.withdrawBankName}
                />
              </>
            ) : null}

            <FieldLabel>{t.wallet.withdrawAccountName}</FieldLabel>
            <SheetInput
              value={accountName}
              onChangeText={setAccountName}
              placeholder={t.wallet.withdrawAccountNamePlaceholder}
              accessibilityLabel={t.wallet.withdrawAccountName}
            />

            <FieldLabel>{t.wallet.withdrawAccountNumber}</FieldLabel>
            <SheetInput
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="09xxxxxxxxx"
              accessibilityLabel={t.wallet.withdrawAccountNumber}
            />

            <View style={styles.confirmBox}>
              <Ionicons name="information-circle-outline" size={18} color={theme.colors.info} />
              <ThemedText variant="caption" tabular style={styles.confirmText}>
                {t.wallet.withdrawConfirm.replace("{amount}", formatKyat(numericAmount))}
              </ThemedText>
            </View>

            {error ? <ErrorNotice message={error} /> : null}

            {/* Kept in the scroll flow (not pinned): the sheet renders in a
                Modal, which doesn't resize for the keyboard — a pinned footer
                would sit behind it while an input is focused. */}
            <Button
              title={t.wallet.withdrawSubmit}
              onPress={handleSubmit}
              loading={createWithdrawal.isPending}
              disabled={
                !accountType ||
                !accountName.trim() ||
                !accountNumber.trim() ||
                (requiresBankName && !bankName.trim()) ||
                numericAmount <= 0
              }
              size="lg"
              icon="arrow-up-circle-outline"
              style={styles.submitButton}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { paddingBottom: theme.spacing.lg },
  successPane: { flex: 1, justifyContent: "center" },
  submitButton: { marginTop: theme.spacing.lg, alignSelf: "stretch" },
  confirmBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.infoSoft,
    borderWidth: 1,
    borderColor: theme.colors.info + "33",
  },
  confirmText: { flex: 1, color: theme.colors.text },
});
