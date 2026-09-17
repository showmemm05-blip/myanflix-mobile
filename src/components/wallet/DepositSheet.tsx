import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import {
  ErrorNotice,
  FieldLabel,
  HelperText,
  MethodGrid,
  QuickAmounts,
  SheetForm,
  SheetInput,
  SheetSuccess,
} from "@/components/wallet/SheetForm";
import { useCreateDeposit } from "@/hooks/useDeposits";
import { useFinanceSettings } from "@/hooks/useFinanceSettings";
import { usePaymentAccounts, usePaymentAccountTypes } from "@/hooks/usePaymentAccounts";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatKyat } from "@/utils/currency";
import { ApiError } from "@/utils/errors";
import { theme } from "@/theme";
import type { PaymentAccount } from "@/types/payment-account";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000];
const REFERENCE_PATTERN = /^\d{6}$/;
const DEFAULT_AMOUNT = "10000";

export function DepositSheet({ visible, onClose }: Props) {
  const { t } = useLanguage();
  const createDeposit = useCreateDeposit();
  const { data: financeSettings } = useFinanceSettings();
  const { data: accounts, isLoading: accountsLoading } = usePaymentAccounts();
  const { data: types } = usePaymentAccountTypes();
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);

  // Group accounts by method type (KBZPay, Bank Account, ...) so the user
  // picks a method first, then which specific account under that method to
  // send to — mirrors the userwebsite deposit flow.
  const accountsByType = new Map<string, PaymentAccount[]>();
  for (const account of accounts ?? []) {
    const list = accountsByType.get(account.type) ?? [];
    list.push(account);
    accountsByType.set(account.type, list);
  }
  const methodTypes = Array.from(accountsByType.keys()).map((type) => {
    const match = types?.find((ty) => ty.value === type);
    return { type, label: match?.label ?? type, logoUrl: match?.logoUrl ?? null };
  });

  // Both of these fall back to "the first available option" whenever
  // nothing has been explicitly selected yet (or the selection no longer
  // exists), without needing an effect to sync it into state.
  const effectiveType = methodTypes.some((m) => m.type === selectedType)
    ? selectedType
    : (methodTypes[0]?.type ?? null);
  const accountsForType = effectiveType ? (accountsByType.get(effectiveType) ?? []) : [];
  const selectedAccount = accountsForType.find((a) => a.id === accountId) ?? accountsForType[0] ?? null;

  const methodLabel = (account: PaymentAccount) => {
    const label = types?.find((ty) => ty.value === account.type)?.label ?? account.type;
    return account.bankName ? `${label} - ${account.bankName}` : label;
  };

  const reset = () => {
    setAmount(DEFAULT_AMOUNT);
    setSelectedType(null);
    setAccountId(null);
    setReference("");
    setError(null);
    setSucceeded(false);
  };

  const handleCopyAccountNumber = async (id: string, accountNumber: string) => {
    // Same guard as BlockActionsSheet.copyParagraph: a clipboard failure is a
    // quiet no-op, never an unhandled rejection out of an onPress.
    try {
      await Clipboard.setStringAsync(accountNumber);
    } catch {
      return;
    }
    setCopiedAccountId(id);
    setTimeout(() => setCopiedAccountId((prev) => (prev === id ? null : prev)), 1500);
  };

  const handleClose = () => {
    // Same refusal as ChangePasswordSheet/EditProfileSheet: closing mid-flight
    // hides the only confirmation this deposit ever gets, and an unconfirmed
    // deposit gets submitted twice. This guards the header X and Android's
    // hardware back; `dismissible` below stops the scrim and the drag.
    if (createDeposit.isPending) return;
    onClose();
    // Wait for the sheet's own close animation before resetting, so the
    // form doesn't visibly snap back to defaults while still sliding away.
    setTimeout(reset, 250);
  };

  const handleSubmit = async () => {
    setError(null);
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError(t.wallet.depositAmountError);
      return;
    }
    if (
      financeSettings &&
      (numericAmount < financeSettings.minDepositAmount || numericAmount > financeSettings.maxDepositAmount)
    ) {
      setError(
        t.wallet.amountRangeError
          .replace("{min}", formatKyat(financeSettings.minDepositAmount))
          .replace("{max}", formatKyat(financeSettings.maxDepositAmount)),
      );
      return;
    }
    if (!selectedAccount) {
      setError(t.wallet.depositNoMethods);
      return;
    }
    if (!REFERENCE_PATTERN.test(reference)) {
      setError(t.wallet.depositReferenceError);
      return;
    }
    try {
      await createDeposit.mutateAsync({
        amount: numericAmount,
        paymentMethod: methodLabel(selectedAccount),
        reference,
        accountName: selectedAccount.accountName,
        paymentAccountId: selectedAccount.id,
      });
      setSucceeded(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.wallet.depositFailure);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      snapHeight={660}
      title={succeeded ? t.wallet.depositSuccessTitle : t.wallet.depositTitle}
      showClose
      dismissible={!createDeposit.isPending}
    >
      {succeeded ? (
        <View style={styles.successPane}>
          <SheetSuccess title={t.wallet.depositSuccessTitle} body={t.wallet.depositSuccessBody} />
          <Button title={t.common.close} onPress={handleClose} size="lg" style={styles.submitButton} />
        </View>
      ) : (
        <SheetForm
          /* Pinned outside the scroll so the submit is never something you have
             to scroll to find, and floated above the keyboard by SheetForm so
             it stays reachable while a field is focused. The error rides with
             the button rather than sitting at the end of the form: a bad
             reference number or amount has to be readable from wherever the
             form happens to be scrolled. */
          action={
            <>
              {error ? <ErrorNotice message={error} /> : null}
              <Button
                title={t.wallet.depositSubmit}
                onPress={handleSubmit}
                loading={createDeposit.isPending}
                disabled={!selectedAccount}
                size="lg"
                icon="arrow-down-circle-outline"
                style={styles.actionButton}
              />
            </>
          }
        >
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
          {financeSettings ? (
            <HelperText>
              {t.wallet.amountRangeHint
                .replace("{min}", formatKyat(financeSettings.minDepositAmount))
                .replace("{max}", formatKyat(financeSettings.maxDepositAmount))}
            </HelperText>
          ) : null}

          <FieldLabel>{t.wallet.depositMethod}</FieldLabel>
          {accountsLoading ? (
            <ActivityIndicator color={theme.colors.primary} style={styles.methodsLoading} />
          ) : methodTypes.length === 0 ? (
            <HelperText>{t.wallet.depositNoMethods}</HelperText>
          ) : (
            <>
              <MethodGrid
                options={methodTypes.map((m) => ({ key: m.type, label: m.label, logoUrl: m.logoUrl }))}
                selectedKey={effectiveType}
                onSelect={(key) => {
                  setSelectedType(key);
                  setAccountId(null);
                }}
              />

              {accountsForType.length > 0 ? (
                <>
                  <FieldLabel>
                    {accountsForType.length > 1 ? t.wallet.depositChooseAccount : t.wallet.depositSendTo}
                  </FieldLabel>
                  <View style={styles.accountList}>
                    {accountsForType.map((account) => {
                      const active = selectedAccount?.id === account.id;
                      const copied = copiedAccountId === account.id;
                      return (
                        <Pressable
                          key={account.id}
                          onPress={() => setAccountId(account.id)}
                          style={({ pressed }) => [
                            styles.sendToBox,
                            active && styles.sendToBoxActive,
                            pressed && styles.pressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={account.accountName}
                        >
                          <View style={styles.sendToHeader}>
                            <ThemedText variant="body" weight="semibold" numberOfLines={1} style={styles.sendToTitle}>
                              {account.accountName}
                            </ThemedText>
                            {active ? (
                              <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                            ) : null}
                          </View>

                          <View style={styles.sendToRow}>
                            <ThemedText variant="caption" style={styles.sendToLabel}>
                              {t.wallet.depositAccountNumber}
                            </ThemedText>
                            <View style={styles.sendToValueRow}>
                              <ThemedText variant="body" weight="semibold" tabular numberOfLines={1} style={styles.sendToValue}>
                                {account.accountNumber}
                              </ThemedText>
                              <Pressable
                                onPress={() => handleCopyAccountNumber(account.id, account.accountNumber)}
                                hitSlop={10}
                                style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
                                accessibilityRole="button"
                                accessibilityLabel={t.wallet.depositAccountNumber}
                              >
                                <Ionicons
                                  name={copied ? "checkmark" : "copy-outline"}
                                  size={16}
                                  color={copied ? theme.colors.finance : theme.colors.textMuted}
                                />
                              </Pressable>
                            </View>
                          </View>

                          {account.bankName ? (
                            <View style={styles.sendToRow}>
                              <ThemedText variant="caption" style={styles.sendToLabel}>
                                {t.wallet.depositBankName}
                              </ThemedText>
                              <ThemedText variant="caption" weight="semibold" numberOfLines={1} style={styles.sendToValue}>
                                {account.bankName}
                              </ThemedText>
                            </View>
                          ) : null}

                          {account.note ? (
                            <ThemedText variant="caption" style={styles.sendToNote}>
                              {account.note}
                            </ThemedText>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </>
          )}

          <FieldLabel>{t.wallet.depositReferenceLabel}</FieldLabel>
          <SheetInput
            value={reference}
            onChangeText={(value) => setReference(value.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000123"
            numeric
            accessibilityLabel={t.wallet.depositReferenceLabel}
          />
          <HelperText>
            {t.wallet.depositReferenceHelp.replace("{method}", selectedAccount ? methodLabel(selectedAccount) : "")}
          </HelperText>
        </SheetForm>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  successPane: { flex: 1, justifyContent: "center" },
  submitButton: { marginTop: theme.spacing.lg, alignSelf: "stretch" },
  actionButton: { alignSelf: "stretch" },
  methodsLoading: { marginTop: theme.spacing.sm, alignSelf: "flex-start" },
  accountList: { gap: theme.spacing.sm },
  /**
   * Same idle fill as the shared chip/method tiles above it. It keeps the
   * violet-tinted (not solid) selected fill because account numbers have to
   * stay readable inside it.
   */
  sendToBox: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  sendToBoxActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.accent },
  sendToHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  sendToTitle: { flex: 1 },
  sendToRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  sendToLabel: { color: theme.colors.textFaint },
  sendToValueRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, flexShrink: 1 },
  sendToValue: { textAlign: "right", flexShrink: 1 },
  copyButton: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sendToNote: { color: theme.colors.textFaint, marginTop: 2 },
  pressed: { opacity: 0.8 },
});
