import { useEffect, useState } from "react";
import { AccessibilityInfo, Keyboard, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInLeft, FadeInRight, useReducedMotion } from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import { ThemedText } from "@/components/ui/ThemedText";
import { BottomSheet } from "@/components/ui/BottomSheet";
import {
  AmountField,
  ErrorNotice,
  HelperText,
  QuickAmounts,
  SheetForm,
  SheetInput,
  SheetSuccess,
} from "@/components/wallet/SheetForm";
import { ChoiceList, ChoiceListSkeleton } from "@/components/wallet/ChoiceList";
import { InlineError } from "@/components/wallet/InlineError";
import {
  FlowActionBar,
  FlowButton,
  FlowHeader,
  FlowHeading,
  FlowLabel,
  FlowSectionTitle,
  InfoNote,
  SheetStepActions,
  flowActionBar,
} from "@/components/wallet/MoneyFlow";
import { PaymentAccountDetails } from "@/components/wallet/PaymentAccountDetails";
import { SubmittedSummary } from "@/components/wallet/SubmittedSummary";
import { useCreateDeposit } from "@/hooks/useDeposits";
import { useFinanceSettings } from "@/hooks/useFinanceSettings";
import { usePaymentAccounts, usePaymentAccountTypes } from "@/hooks/usePaymentAccounts";
import { ROW_INSET, SHEET_BODY_MAX_WIDTH, useWalletLayout } from "@/hooks/useWalletLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatKyat, formatKyatNumber } from "@/utils/currency";
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
/** Checks 0..2 (amount, range, account) belong to step 1; check 3 (reference) to step 2. */
const LAST_STEP_ONE_CHECK = 2;
/** The checks that are about the amount field (0 = no amount, 1 = out of range) — they mark it red. */
const AMOUNT_CHECKS = [0, 1];
/** The reference check — it rings the reference field red. */
const REFERENCE_CHECK = 3;

const announce = (message: string) => AccessibilityInfo.announceForAccessibility(message);

/**
 * Deposit in two short steps — (1) how much and where to send it, (2) send
 * the money, then confirm with its reference — on a full-height page with a
 * pinned primary button, instead of one long form (Deposit.dc.html,
 * DepositStep2.dc.html).
 * The validation is the original single list, in its original order: Continue
 * runs its first three checks, Submit runs all four, and a failure that
 * belongs to step 1 takes the user back there with the message.
 */
export function DepositSheet({ visible, onClose }: Props) {
  const { t } = useLanguage();
  const { quickAmountColumns } = useWalletLayout();
  const reduceMotion = useReducedMotion();
  const createDeposit = useCreateDeposit();
  const { data: financeSettings } = useFinanceSettings();
  const {
    data: accounts,
    isLoading: accountsLoading,
    isError: accountsFailed,
    isFetching: accountsFetching,
    refetch: refetchAccounts,
  } = usePaymentAccounts();
  // The sheet stays mounted behind `visible`, so the query never remounts:
  // ask for a fresh list on every open instead (the hook's staleTime is 0).
  useEffect(() => {
    if (visible) void refetchAccounts();
  }, [visible, refetchAccounts]);
  const { data: types } = usePaymentAccountTypes();
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Which check the current error came from (null = the server's answer) — only to mark that field. */
  const [errorCheck, setErrorCheck] = useState<number | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  /** Which way the last step change went; null = no change yet (no slide on open). */
  const [motion, setMotion] = useState<"forward" | "back" | null>(null);
  /** What was submitted, kept for the success pane only. */
  const [submitted, setSubmitted] = useState<{ amount: number; method: string; reference: string } | null>(null);

  // Group accounts by method type (KBZPay, Bank Account, ...): the selection
  // is a method, then which specific account under that method to send to —
  // mirrors the userwebsite deposit flow.
  const accountsByType = new Map<string, PaymentAccount[]>();
  for (const account of accounts ?? []) {
    const list = accountsByType.get(account.type) ?? [];
    list.push(account);
    accountsByType.set(account.type, list);
  }
  const methodTypes = Array.from(accountsByType.keys());

  // Both of these fall back to "the first available option" whenever
  // nothing has been explicitly selected yet (or the selection no longer
  // exists), without needing an effect to sync it into state.
  const effectiveType = methodTypes.some((type) => type === selectedType) ? selectedType : (methodTypes[0] ?? null);
  const accountsForType = effectiveType ? (accountsByType.get(effectiveType) ?? []) : [];
  const selectedAccount = accountsForType.find((a) => a.id === accountId) ?? accountsForType[0] ?? null;

  // Sent as `paymentMethod` in the "<label> - <bank>" shape every stored
  // deposit already carries, so this format must not change.
  const methodLabel = (account: PaymentAccount) => {
    const label = types?.find((ty) => ty.value === account.type)?.label ?? account.type;
    return account.bankName ? `${label} - ${account.bankName}` : label;
  };
  const logoFor = (account: PaymentAccount) => types?.find((ty) => ty.value === account.type)?.logoUrl ?? null;

  /**
   * Every account in one "Send To" list, method by method in the same order
   * as before. Picking a row sets the same two values the old method tiles +
   * account cards did (method, then account), so the first-available
   * fallbacks above and the validation below are untouched.
   */
  const accountChoices = methodTypes.flatMap((type) => accountsByType.get(type) ?? []);

  const numericAmount = Number(amount);

  /**
   * The deposit's validation, as one ordered list with the original messages
   * in the original order. Returns the first failure among checks 0..`upTo`.
   */
  const firstError = (upTo: number): { index: number; message: string } | null => {
    const checks: (() => string | null)[] = [
      () => (!numericAmount || numericAmount <= 0 ? t.wallet.depositAmountError : null),
      () =>
        financeSettings &&
        (numericAmount < financeSettings.minDepositAmount || numericAmount > financeSettings.maxDepositAmount)
          ? t.wallet.amountRangeError
              .replace("{min}", formatKyat(financeSettings.minDepositAmount))
              .replace("{max}", formatKyat(financeSettings.maxDepositAmount))
          : null,
      () => (!selectedAccount ? t.wallet.depositNoMethods : null),
      () => (!REFERENCE_PATTERN.test(reference) ? t.wallet.depositReferenceError : null),
    ];
    for (let index = 0; index < checks.length && index <= upTo; index += 1) {
      const message = checks[index]();
      if (message) return { index, message };
    }
    return null;
  };

  const reset = () => {
    setAmount(DEFAULT_AMOUNT);
    setSelectedType(null);
    setAccountId(null);
    setReference("");
    setError(null);
    setErrorCheck(null);
    setSucceeded(false);
    setStep(1);
    setMotion(null);
    setSubmitted(null);
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
    announce(t.wallet.copied);
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

  const goToStep = (next: 1 | 2) => {
    setMotion(next === 2 ? "forward" : "back");
    setStep(next);
  };

  const handleContinue = () => {
    const failure = firstError(LAST_STEP_ONE_CHECK);
    if (failure) {
      setError(failure.message);
      setErrorCheck(failure.index);
      announce(failure.message);
      return;
    }
    setError(null);
    setErrorCheck(null);
    Keyboard.dismiss();
    goToStep(2);
    announce(`${t.wallet.stepOf.replace("{n}", "2").replace("{total}", "2")}, ${t.wallet.depositStepConfirm}`);
  };

  const handleBack = () => {
    setError(null);
    setErrorCheck(null);
    goToStep(1);
  };

  const handleSubmit = async () => {
    setError(null);
    setErrorCheck(null);
    const failure = firstError(Number.POSITIVE_INFINITY);
    if (failure) {
      setError(failure.message);
      setErrorCheck(failure.index);
      if (failure.index <= LAST_STEP_ONE_CHECK) goToStep(1);
      announce(failure.message);
      return;
    }
    // Already guaranteed by check 2; restated so the type narrows.
    if (!selectedAccount) return;
    try {
      await createDeposit.mutateAsync({
        amount: numericAmount,
        paymentMethod: methodLabel(selectedAccount),
        reference,
        accountName: selectedAccount.accountName,
        paymentAccountId: selectedAccount.id,
      });
      setSubmitted({ amount: numericAmount, method: methodLabel(selectedAccount), reference });
      setSucceeded(true);
      announce(t.wallet.depositSuccessTitle);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t.wallet.depositFailure;
      setError(message);
      announce(message);
    }
  };

  /** The board's `.rise`: each step slides in 16pt from the side it comes from. */
  const entering =
    reduceMotion || !motion
      ? undefined
      : motion === "forward"
        ? FadeInRight.duration(300)
        : FadeInLeft.duration(300);

  const amountInvalid = errorCheck !== null && AMOUNT_CHECKS.includes(errorCheck);

  const stepOne = (
    <>
      <FlowHeading>{t.wallet.depositStepAmount}</FlowHeading>
      <View style={styles.amountSection}>
        <AmountField
          label={t.wallet.summaryAmount}
          value={amount}
          onChangeText={setAmount}
          placeholder={formatKyatNumber(Number(DEFAULT_AMOUNT))}
          accessibilityLabel={t.wallet.depositAmount}
          invalid={amountInvalid}
        />
        {financeSettings ? (
          <HelperText style={styles.helper}>
            {t.wallet.amountRangeHint
              .replace("{min}", formatKyat(financeSettings.minDepositAmount))
              .replace("{max}", formatKyat(financeSettings.maxDepositAmount))}
          </HelperText>
        ) : null}
        <QuickAmounts
          values={QUICK_AMOUNTS}
          amount={amount}
          onSelect={(value) => setAmount(String(value))}
          columns={quickAmountColumns}
        />
      </View>

      <FlowSectionTitle style={styles.sendToTitle}>{t.wallet.depositSendTo}</FlowSectionTitle>
      <View style={styles.listSection}>
        {accountsLoading ? (
          <ChoiceListSkeleton />
        ) : accountsFailed && !accounts ? (
          // A failed list is not "no methods": say so, and offer the retry.
          <InlineError
            message={t.wallet.listError}
            onRetry={() => void refetchAccounts()}
            retrying={accountsFetching}
            style={styles.methodsError}
          />
        ) : methodTypes.length === 0 ? (
          <ThemedText style={styles.noMethods}>{t.wallet.depositNoMethods}</ThemedText>
        ) : (
          <ChoiceList
            accessibilityLabel={t.wallet.depositSendTo}
            selectedKey={selectedAccount?.id ?? null}
            onSelect={(id) => {
              const account = accountChoices.find((a) => a.id === id);
              if (!account) return;
              setSelectedType(account.type);
              setAccountId(account.id);
            }}
            options={accountChoices.map((account) => ({
              key: account.id,
              title: methodLabel(account),
              subtitle: `${account.accountName} · ${account.accountNumber}`,
              logoUrl: logoFor(account),
              bank: !!account.bankName,
              // One element to a screen reader: it reads the number aloud and
              // offers copying as a custom action, as the account card did.
              accessibilityLabel: [
                methodLabel(account),
                account.accountName,
                `${t.wallet.depositAccountNumber} ${account.accountNumber}`,
                account.note ?? "",
              ]
                .filter(Boolean)
                .join(", "),
              actions: [{ name: "copy", label: t.wallet.copyAccountNumber }],
              onAction: (name) => {
                if (name === "copy") void handleCopyAccountNumber(account.id, account.accountNumber);
              },
            }))}
          />
        )}
      </View>

      <InfoNote>{t.wallet.depositNextNote}</InfoNote>
    </>
  );

  const stepTwo = (
    <>
      <FlowHeading>{t.wallet.depositStepConfirm}</FlowHeading>
      <View
        style={styles.amountSummary}
        accessible
        accessibilityLabel={`${t.wallet.summaryAmount}, ${formatKyat(numericAmount)}`}
      >
        <FlowLabel>{t.wallet.summaryAmount}</FlowLabel>
        <ThemedText
          weight="black"
          tabular
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={styles.amountValue}
        >
          {formatKyatNumber(numericAmount)}
          <ThemedText weight="extrabold" style={styles.amountUnit}>
            {"  Ks"}
          </ThemedText>
        </ThemedText>
      </View>

      {selectedAccount ? (
        <>
          <FlowSectionTitle style={styles.payToTitle}>{t.wallet.depositSendTo}</FlowSectionTitle>
          <PaymentAccountDetails
            account={selectedAccount}
            methodLabel={methodLabel(selectedAccount)}
            logoUrl={logoFor(selectedAccount)}
            copied={copiedAccountId === selectedAccount.id}
            onCopy={() => void handleCopyAccountNumber(selectedAccount.id, selectedAccount.accountNumber)}
          />
        </>
      ) : null}

      <View style={styles.rule} />

      <View style={styles.referenceSection}>
        <FlowLabel>{t.wallet.depositReferenceLabel}</FlowLabel>
        <SheetInput
          value={reference}
          onChangeText={(value) => setReference(value.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000123"
          numeric
          invalid={errorCheck === REFERENCE_CHECK}
          accessibilityLabel={t.wallet.depositReferenceLabel}
        />
        <HelperText style={styles.helper}>
          {t.wallet.depositReferenceHelp.replace("{method}", selectedAccount ? methodLabel(selectedAccount) : "")}
        </HelperText>
      </View>
    </>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      fullScreen
      header={
        <FlowHeader
          // The success pane says "Deposit submitted" once, in its body.
          title={succeeded ? undefined : t.wallet.depositTitle}
          onClose={handleClose}
          closeLabel={t.common.close}
          step={
            succeeded
              ? undefined
              : { n: step, total: 2, title: step === 1 ? t.wallet.depositStepAmount : t.wallet.depositStepConfirm }
          }
        />
      }
      closeLabel={t.common.close}
      dismissible={!createDeposit.isPending}
    >
      {succeeded ? (
        <View style={styles.successRoot}>
          <ScrollView contentContainerStyle={styles.successPane} showsVerticalScrollIndicator={false}>
            <View style={styles.narrow}>
              {/* The page's 16pt margins: the full-height sheet has no side padding of its own. */}
              <View style={styles.inset}>
                <SheetSuccess title={t.wallet.depositSuccessTitle} body={t.wallet.depositSuccessBody} haloSize={96} />
              </View>
              {submitted ? (
                <View style={styles.summary}>
                  <SubmittedSummary
                    rows={[
                      {
                        label: t.wallet.summaryAmount,
                        value: formatKyat(submitted.amount),
                        color: theme.colors.finance,
                      },
                      { label: t.wallet.depositMethod, value: submitted.method },
                      { label: t.wallet.depositReferenceLabel, value: submitted.reference },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          </ScrollView>
          <FlowActionBar contentStyle={styles.narrow}>
            <FlowButton title={t.common.close} variant="play" onPress={handleClose} />
          </FlowActionBar>
        </View>
      ) : (
        <SheetForm
          // A new step starts at the top of its own form, never mid-scroll.
          key={`step-${step}`}
          contentStyle={styles.narrow}
          actionStyle={flowActionBar}
          actionPassThrough
          /* Pinned outside the scroll so the submit is never something you have
             to scroll to find, and floated above the keyboard by SheetForm so
             it stays reachable while a field is focused. The error rides with
             the button rather than sitting at the end of the form: a bad
             reference number or amount has to be readable from wherever the
             form happens to be scrolled. */
          action={
            <FlowActionBar contentStyle={styles.narrow}>
              {error ? <ErrorNotice message={error} /> : null}
              {step === 1 ? (
                <FlowButton title={t.wallet.continue} onPress={handleContinue} disabled={!selectedAccount} />
              ) : (
                <SheetStepActions
                  submitTitle={t.wallet.depositSubmit}
                  onSubmit={handleSubmit}
                  submitting={createDeposit.isPending}
                  submitDisabled={!selectedAccount}
                  onBack={handleBack}
                />
              )}
            </FlowActionBar>
          }
        >
          <Animated.View entering={entering}>{step === 1 ? stepOne : stepTwo}</Animated.View>
        </SheetForm>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  narrow: { width: "100%", maxWidth: SHEET_BODY_MAX_WIDTH, alignSelf: "center" },
  inset: { paddingHorizontal: ROW_INSET },
  amountSection: { paddingTop: 28, paddingHorizontal: ROW_INSET },
  helper: { marginTop: 10 },
  sendToTitle: { paddingTop: 36, paddingHorizontal: ROW_INSET },
  /** The account rows run edge to edge and pad themselves. */
  listSection: { paddingTop: theme.spacing.sm },
  methodsError: { paddingVertical: theme.spacing.xs, paddingHorizontal: ROW_INSET },
  noMethods: { paddingVertical: 12, paddingHorizontal: ROW_INSET, color: theme.colors.textMuted },
  amountSummary: { paddingTop: 28, paddingHorizontal: ROW_INSET },
  amountValue: { fontSize: 34, lineHeight: 40, letterSpacing: -1, color: theme.colors.text },
  amountUnit: { fontSize: 17, color: theme.colors.textFaint, letterSpacing: 0 },
  payToTitle: { paddingTop: theme.spacing.xl, paddingHorizontal: ROW_INSET },
  rule: { height: 1, marginTop: 28, marginHorizontal: ROW_INSET, backgroundColor: theme.colors.border },
  referenceSection: { paddingTop: 28, paddingHorizontal: ROW_INSET },
  successRoot: { flex: 1 },
  successPane: { paddingTop: theme.spacing.xxl, paddingBottom: theme.spacing.lg },
  summary: { marginTop: theme.spacing.xl },
});
