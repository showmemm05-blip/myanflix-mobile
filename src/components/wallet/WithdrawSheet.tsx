import { useRef, useState } from "react";
import { AccessibilityInfo, Keyboard, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeInLeft, FadeInRight, useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { AccountTypeTiles, AccountTypeTilesSkeleton } from "@/components/wallet/AccountTypeTiles";
import {
  AmountField,
  ErrorNotice,
  HelperText,
  QuickAmounts,
  SheetForm,
  SheetInput,
  SheetSuccess,
} from "@/components/wallet/SheetForm";
import { InlineError } from "@/components/wallet/InlineError";
import { maskedKyat, useBalanceVisibility } from "@/components/wallet/MaskedAmount";
import { MethodLogo } from "@/components/wallet/MethodLogo";
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
import { PressScale } from "@/components/wallet/PressScale";
import { SubmittedSummary } from "@/components/wallet/SubmittedSummary";
import { CodeNote } from "@/components/withdrawal-code/CodeNote";
import { CreateCodeFlow } from "@/components/withdrawal-code/CreateCodeFlow";
import { EnterCodeSheet } from "@/components/withdrawal-code/EnterCodeSheet";
import { ForgotCodeFlow } from "@/components/withdrawal-code/ForgotCodeFlow";
import { useResetSms, useSingleFlight } from "@/components/withdrawal-code/useCodeEntry";
import { lockEnd } from "@/components/withdrawal-code/codeRules";
import {
  failureText,
  plainErrorMessage,
  readCodeFailure,
  type CodeFailure,
} from "@/components/withdrawal-code/codeErrors";
import { useCreateWithdrawal } from "@/hooks/useWithdrawals";
import { WITHDRAWAL_CODE_STATUS_KEY, useFetchWithdrawalCodeStatus } from "@/hooks/useWithdrawalCode";
import { useAuth } from "@/hooks/useAuth";
import { useFinanceSettings } from "@/hooks/useFinanceSettings";
import { usePaymentAccountTypes } from "@/hooks/usePaymentAccounts";
import { useWallet } from "@/hooks/useWallet";
import { ROW_INSET, SHEET_BODY_MAX_WIDTH, useWalletLayout } from "@/hooks/useWalletLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatKyat, formatKyatNumber } from "@/utils/currency";
import { ApiError } from "@/utils/errors";
import { theme } from "@/theme";
import { useQueryClient } from "@tanstack/react-query";
import type { WithdrawalCodeStatus } from "@/types/withdrawal-code";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000];
const DEFAULT_AMOUNT = "10000";
/** Checks 0..2 (type, name/number, bank) belong to step 1; checks 3..5 (amount) to step 2. */
const LAST_STEP_ONE_CHECK = 2;
/** The check that is about the receiving account's name/number — it rings whichever is empty. */
const ACCOUNT_CHECK = 1;
/** The check that is about the bank name — it rings that field. */
const BANK_CHECK = 2;
/** Checks from here on are about the amount — they mark the amount field red. */
const FIRST_AMOUNT_CHECK = 3;

const announce = (message: string) => AccessibilityInfo.announceForAccessibility(message);

/**
 * The withdrawal-code pages that can replace the two steps (the code's own
 * header and keypad): the first code (A1–A2), or "Forgot code?" (C1–C3).
 * The code entry for an account that has one is a sheet OVER step 2 instead.
 */
type CodePages = "create" | "forgot" | null;

/** The code pages draw their own header; the sheet's drag strip stays empty while they are up. */
const NO_HEADER = <View />;

/** The fresh status's lock, as the code sheet needs it. */
const lockOf = (status: WithdrawalCodeStatus | undefined) =>
  status?.lockedUntil ? lockEnd(status.lockedUntil) : null;

/** The later of two lock ends (null = not locked). */
const laterLock = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));

/**
 * Withdraw in two short steps — (1) where the money should go, (2) how much —
 * on a full-height page with a pinned primary button (Withdraw.dc.html,
 * WithdrawStep2.dc.html), and the original
 * validation as one ordered list: account checks first,
 * amount checks after, so Continue runs exactly its first three and Submit
 * runs all six, giving the same message for the same mistake as before.
 *
 * Every withdrawal needs the account's 6-digit withdrawal code (owner,
 * 2026-10-05; WithdrawalCode Flow.dc.html). Submit runs the same checks as
 * before, then reads the code status fresh: an account without a code
 * creates one on two full-height pages (Create, then Enter it again) whose
 * last button sends the withdrawal; an account with one gets the "Enter your
 * withdrawal code" sheet over step 2, with "Forgot code?" for an SMS reset.
 * The server judges every code; this flow never keeps one past the request
 * it rides on. A refusal about the code stays on the code screen; any other
 * answer comes back to step 2's error line exactly as before.
 */
export function WithdrawSheet({ visible, onClose }: Props) {
  const { t } = useLanguage();
  const { quickAmountColumns } = useWalletLayout();
  const reduceMotion = useReducedMotion();
  const { hidden, toggle: toggleHidden } = useBalanceVisibility();
  const createWithdrawal = useCreateWithdrawal();
  const { data: financeSettings } = useFinanceSettings();
  const {
    data: types,
    isLoading: typesLoading,
    isError: typesFailed,
    isFetching: typesFetching,
    refetch: refetchTypes,
  } = usePaymentAccountTypes();
  const { data: wallet } = useWallet();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchCodeStatus = useFetchWithdrawalCodeStatus();
  const resetSms = useResetSms();
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Which check the current error came from (null = the server's answer) — only to mark that field. */
  const [errorCheck, setErrorCheck] = useState<number | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  /** Which way the last step change went; null = no change yet (no slide on open). */
  const [motion, setMotion] = useState<"forward" | "back" | null>(null);
  /** What was submitted, kept for the success pane only. */
  const [submitted, setSubmitted] = useState<{ amount: number; account: string } | null>(null);
  /** The code pages showing in place of the steps, if any. */
  const [codePages, setCodePages] = useState<CodePages>(null);
  /** The "Enter your withdrawal code" sheet over step 2. */
  const [enterOpen, setEnterOpen] = useState(false);
  /** Bumped on every open of that sheet, which remounts it: nothing typed survives a close. */
  const [enterSession, setEnterSession] = useState(0);
  const [enterLockedUntil, setEnterLockedUntil] = useState<number | null>(null);
  /** Submit is reading the code status. */
  const [checkingCode, setCheckingCode] = useState(false);
  /**
   * The withdrawal that succeeded also made the code — the success pane says
   * so (CodeCreated "created" / "reset"). Set with the success itself, so a
   * later withdrawal through the Enter sheet never inherits it.
   */
  const [codeNote, setCodeNote] = useState<"created" | "reset" | null>(null);
  /**
   * The lock the last LOCKED answer reported since the last fresh status
   * read. Back from "Forgot code?" the Enter sheet takes the later of this
   * and the cached status — the cache alone may be gone (nothing on the
   * wallet screen watches it, so it can be dropped after 5 minutes).
   */
  const lastLockRef = useRef<number | null>(null);
  /** Android's back goes to the code page on screen, which steps back like its own back button. */
  const codeBackRef = useRef<(() => void) | null>(null);
  /** Bumped by every reset, so a status read that lands after a close opens nothing. */
  const sessionRef = useRef(0);
  /** One withdrawal request at a time, even for a double tap inside one frame. */
  const sendingRef = useRef(false);
  const once = useSingleFlight();

  const availableBalance = wallet?.balance ?? 0;
  const numericAmount = Number(amount) || 0;
  // Same catalog flag the admin sets per payment method — a bank transfer needs
  // a bank named, a mobile wallet doesn't.
  const selectedTypeInfo = types?.find((ty) => ty.value === accountType);
  const requiresBankName = Boolean(selectedTypeInfo?.requiresBankName);
  const accountFieldsMissing =
    !accountType || !accountName.trim() || !accountNumber.trim() || (requiresBankName && !bankName.trim());

  /**
   * The withdrawal's validation, as one ordered list with the original
   * messages in the original order. Returns the first failure among checks
   * 0..`upTo`.
   */
  const firstError = (upTo: number): { index: number; message: string } | null => {
    const checks: (() => string | null)[] = [
      () => (!accountType ? t.wallet.withdrawNoType : null),
      () => (!accountName.trim() || !accountNumber.trim() ? t.wallet.withdrawAccountError : null),
      () => (requiresBankName && !bankName.trim() ? t.wallet.withdrawBankNameError : null),
      () => (!numericAmount || numericAmount <= 0 ? t.wallet.withdrawAmountError : null),
      () =>
        financeSettings &&
        (numericAmount < financeSettings.minWithdrawalAmount || numericAmount > financeSettings.maxWithdrawalAmount)
          ? t.wallet.amountRangeError
              .replace("{min}", formatKyat(financeSettings.minWithdrawalAmount))
              .replace("{max}", formatKyat(financeSettings.maxWithdrawalAmount))
          : null,
      () => (numericAmount > availableBalance ? t.wallet.withdrawInsufficientError : null),
    ];
    for (let index = 0; index < checks.length && index <= upTo; index += 1) {
      const message = checks[index]();
      if (message) return { index, message };
    }
    return null;
  };

  const reset = () => {
    setAmount(DEFAULT_AMOUNT);
    setAccountType(null);
    setAccountName("");
    setAccountNumber("");
    setBankName("");
    setError(null);
    setErrorCheck(null);
    setSucceeded(false);
    setStep(1);
    setMotion(null);
    setSubmitted(null);
    setCodePages(null);
    setEnterOpen(false);
    setEnterLockedUntil(null);
    setCheckingCode(false);
    setCodeNote(null);
    lastLockRef.current = null;
    // A verified "Forgot code?" SMS and its reset token go with the withdrawal.
    resetSms.forget();
    sessionRef.current += 1;
  };

  const handleClose = () => {
    // Same refusal as ChangePasswordSheet/EditProfileSheet: closing mid-flight
    // hides the only confirmation this withdrawal ever gets, and an unconfirmed
    // request gets submitted twice. This guards the header X and Android's
    // hardware back; `dismissible` below stops the scrim and the drag.
    if (createWithdrawal.isPending) return;
    // On a code page, back means one page back (its own back button decides
    // whether that leaves the pages), never the whole withdrawal.
    if (codePages && codeBackRef.current) {
      codeBackRef.current();
      return;
    }
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
    announce(`${t.wallet.stepOf.replace("{n}", "2").replace("{total}", "2")}, ${t.wallet.withdrawStepAmount}`);
  };

  const handleBack = () => {
    setError(null);
    setErrorCheck(null);
    goToStep(1);
  };

  const handleSubmit = async () => {
    if (checkingCode || createWithdrawal.isPending) return;
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
    // Already guaranteed by check 0; restated so the type narrows.
    if (!accountType) return;
    // The code has its own keypad; the amount field's keyboard would cover it.
    Keyboard.dismiss();
    // Create a code or enter it? Asked fresh: a code made on the website a
    // minute ago, or a lock from another device, must count.
    const session = sessionRef.current;
    setCheckingCode(true);
    let status: WithdrawalCodeStatus;
    try {
      status = await fetchCodeStatus();
    } catch (err) {
      if (session !== sessionRef.current) return;
      setCheckingCode(false);
      const message = plainErrorMessage(err, t, t.withdrawalCode.statusError);
      setError(message);
      announce(message);
      return;
    }
    if (session !== sessionRef.current) return;
    setCheckingCode(false);
    lastLockRef.current = lockOf(status);
    if (status.hasCode) openEnterCode(lastLockRef.current);
    else openCreateCode();
  };

  /** "Step 1 of 2, Create your withdrawal code" — what a screen reader hears as a code page opens. */
  const announcePage = (n: number, total: number, title: string) =>
    announce(`${t.wallet.stepOf.replace("{n}", String(n)).replace("{total}", String(total))}, ${title}`);

  const openCreateCode = () => {
    setEnterOpen(false);
    setCodePages("create");
    announcePage(1, 2, t.withdrawalCode.createTitle);
  };

  const openEnterCode = (lockedUntil: number | null) => {
    setCodePages(null);
    setEnterLockedUntil(lockedUntil);
    setEnterSession((n) => n + 1);
    setEnterOpen(true);
  };

  /**
   * Sends the withdrawal with `code` — the one request that moves money,
   * unchanged except for the code it now carries. Resolves with a WRONG or
   * LOCKED refusal for the code screen that sent it, or null once this sheet
   * has taken over: the success pane, "Create code" if the account turns out
   * to have none, or step 2's error line for every other answer (a server
   * amount check, no connection…), which reads exactly as it did before.
   * `note`: this withdrawal rides on a code just made ("created") or just
   * reset ("reset"); the success pane says so.
   */
  const submitWithCode = async (
    code: string,
    note: "created" | "reset" | null = null,
  ): Promise<CodeFailure | null> => {
    if (!accountType || sendingRef.current) return null;
    sendingRef.current = true;
    try {
      await createWithdrawal.mutateAsync({
        amount: numericAmount,
        accountType,
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        bankName: requiresBankName ? bankName.trim() : undefined,
        withdrawalCode: code,
      });
      setSubmitted({ amount: numericAmount, account: `${accountType} — ${accountName.trim()}` });
      setCodeNote(note);
      setEnterOpen(false);
      setCodePages(null);
      setSucceeded(true);
      announce(t.wallet.withdrawSuccessTitle);
      return null;
    } catch (err) {
      const codeFailure = readCodeFailure(err);
      if (codeFailure?.kind === "locked") lastLockRef.current = codeFailure.until;
      if (codeFailure?.kind === "wrong" || codeFailure?.kind === "locked") return codeFailure;
      if (codeFailure?.kind === "notSet") {
        openCreateCode();
        return null;
      }
      const message = codeFailure
        ? failureText(codeFailure, t)
        : err instanceof ApiError
          ? err.message
          : t.wallet.withdrawFailure;
      setEnterOpen(false);
      setCodePages(null);
      setError(message);
      announce(message);
      return null;
    } finally {
      sendingRef.current = false;
      // The request's variables hold the code: let React Query drop them now.
      createWithdrawal.reset();
    }
  };

  /** "Forgot code?" — the SMS goes first; the pages open once it is on its way. */
  const handleForgot = async (): Promise<string | null> => {
    const problem = await resetSms.send({ reuseRecent: true });
    if (problem) return problem;
    setEnterOpen(false);
    setCodePages("forgot");
    announcePage(1, 3, t.withdrawalCode.smsTitle);
    return null;
  };

  /**
   * Back from the forgot pages: the code sheet over step 2 again, still
   * locked if the server last said so (the cached status, which a LOCKED
   * answer updates, or that answer's own lock). A lock that has run out
   * meanwhile simply opens the keys.
   */
  const leaveForgot = () => {
    const status = queryClient.getQueryData<WithdrawalCodeStatus>(WITHDRAWAL_CODE_STATUS_KEY);
    openEnterCode(laterLock(lockOf(status), lastLockRef.current));
  };

  /** The board's `.rise`: each step slides in 16pt from the side it comes from. */
  const entering =
    reduceMotion || !motion
      ? undefined
      : motion === "forward"
        ? FadeInRight.duration(300)
        : FadeInLeft.duration(300);

  const availableLine = t.wallet.withdrawAvailable.replace("{balance}", maskedKyat(availableBalance, hidden));
  /** What a screen reader says for that line: never the mask's dots. */
  const availableSpoken = hidden ? `${t.wallet.availableBalance}, ${t.wallet.balanceHiddenA11y}` : availableLine;

  const availableNote = (
    <View style={styles.availableNote} accessible accessibilityLabel={availableSpoken}>
      <Ionicons name="wallet-outline" size={16} color={theme.colors.finance} />
      <ThemedText variant="caption" weight="semibold" tabular style={styles.availableText}>
        {availableLine}
      </ThemedText>
    </View>
  );

  const nameInvalid = errorCheck === ACCOUNT_CHECK && !accountName.trim();
  const numberInvalid = errorCheck === ACCOUNT_CHECK && !accountNumber.trim();
  const bankInvalid = errorCheck === BANK_CHECK && !bankName.trim();
  const amountInvalid = errorCheck !== null && errorCheck >= FIRST_AMOUNT_CHECK;

  const stepOne = (
    <>
      <FlowHeading>{t.wallet.withdrawStepAccount}</FlowHeading>
      <View style={styles.availableTop}>{availableNote}</View>

      <FlowSectionTitle style={styles.typeTitle}>{t.wallet.withdrawAccountType}</FlowSectionTitle>
      <View style={styles.typeSection}>
        {typesLoading ? (
          <AccountTypeTilesSkeleton />
        ) : typesFailed && !types ? (
          // Without the catalogue there is nothing to pick and Continue stays
          // disabled — say why, and offer the retry, instead of an empty list.
          <InlineError
            message={t.wallet.listError}
            onRetry={() => void refetchTypes()}
            retrying={typesFetching}
            style={styles.typesError}
          />
        ) : (
          <AccountTypeTiles
            accessibilityLabel={t.wallet.withdrawAccountType}
            types={types ?? []}
            selected={accountType}
            onSelect={setAccountType}
          />
        )}
      </View>

      <View style={styles.fields}>
        {requiresBankName ? (
          // The bank field rises in when a bank type is picked (under reduce motion it simply appears).
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(300)}>
            <FlowLabel>{t.wallet.withdrawBankName}</FlowLabel>
            <SheetInput
              value={bankName}
              onChangeText={setBankName}
              placeholder={t.wallet.withdrawBankNamePlaceholder}
              accessibilityLabel={t.wallet.withdrawBankName}
              invalid={bankInvalid}
            />
          </Animated.View>
        ) : null}

        <View>
          <FlowLabel>{t.wallet.withdrawAccountName}</FlowLabel>
          <SheetInput
            value={accountName}
            onChangeText={setAccountName}
            placeholder={t.wallet.withdrawAccountNamePlaceholder}
            accessibilityLabel={t.wallet.withdrawAccountName}
            invalid={nameInvalid}
          />
        </View>

        <View>
          <FlowLabel>{t.wallet.withdrawAccountNumber}</FlowLabel>
          <SheetInput
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder="09xxxxxxxxx"
            accessibilityLabel={t.wallet.withdrawAccountNumber}
            invalid={numberInvalid}
          />
        </View>
      </View>
    </>
  );

  const receivingTitle = `${accountType ?? ""} — ${accountName.trim()}`;
  const receivingDetail = [accountNumber.trim(), requiresBankName ? bankName.trim() : ""].filter(Boolean).join(" · ");

  const stepTwo = (
    <>
      <FlowHeading>{t.wallet.withdrawStepAmount}</FlowHeading>
      <View
        style={styles.receiving}
        accessible
        accessibilityLabel={`${t.wallet.summaryReceivingAccount}, ${receivingTitle}, ${receivingDetail}`}
      >
        <MethodLogo
          logoUrl={selectedTypeInfo?.logoUrl}
          label={selectedTypeInfo?.label ?? accountType ?? undefined}
          bank={requiresBankName}
          size={48}
        />
        <View style={styles.receivingText}>
          <ThemedText variant="caption" weight="regular" style={styles.faint}>
            {t.wallet.summaryReceivingAccount}
          </ThemedText>
          <ThemedText weight="bold">{receivingTitle}</ThemedText>
          <ThemedText variant="caption" weight="regular" tabular style={styles.muted}>
            {receivingDetail}
          </ThemedText>
        </View>
      </View>

      <View style={styles.rule} />

      <View style={styles.availableRow}>
        {availableNote}
        <PressScale
          onPress={() => toggleHidden(availableBalance)}
          accessibilityRole="button"
          accessibilityLabel={hidden ? t.wallet.showBalance : t.wallet.hideBalance}
          style={styles.eye}
        >
          <Ionicons name={hidden ? "eye-off-outline" : "eye-outline"} size={20} color={theme.colors.textMuted} />
        </PressScale>
      </View>

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
              .replace("{min}", formatKyat(financeSettings.minWithdrawalAmount))
              .replace("{max}", formatKyat(financeSettings.maxWithdrawalAmount))}
          </HelperText>
        ) : null}
        <QuickAmounts
          values={QUICK_AMOUNTS}
          amount={amount}
          onSelect={(value) => setAmount(String(value))}
          columns={quickAmountColumns}
        />
      </View>

      <InfoNote>{t.wallet.withdrawConfirm.replace("{amount}", formatKyat(numericAmount))}</InfoNote>
    </>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      fullScreen
      header={
        // The code pages draw their own header ("Withdrawal code", "1 of 2", back).
        codePages && !succeeded ? (
          NO_HEADER
        ) : (
          <FlowHeader
            // The success pane says "Withdrawal requested" once, in its body.
            title={succeeded ? undefined : t.wallet.withdrawTitle}
            onClose={handleClose}
            closeLabel={t.common.close}
            step={
              succeeded
                ? undefined
                : { n: step, total: 2, title: step === 1 ? t.wallet.withdrawStepAccount : t.wallet.withdrawStepAmount }
            }
          />
        )
      }
      closeLabel={t.common.close}
      dismissible={!createWithdrawal.isPending}
    >
      {succeeded ? (
        <View style={styles.successRoot}>
          <ScrollView contentContainerStyle={styles.successPane} showsVerticalScrollIndicator={false}>
            <View style={styles.narrow}>
              {/* The C-4 wording: the amount was set aside at request time and comes back on a reject. */}
              <View style={styles.inset}>
                <SheetSuccess title={t.wallet.withdrawSuccessTitle} body={t.wallet.withdrawSuccessBody} haloSize={96} />
              </View>
              {submitted ? (
                <View style={styles.summary}>
                  <SubmittedSummary
                    rows={[
                      { label: t.wallet.summaryAmount, value: formatKyat(submitted.amount) },
                      { label: t.wallet.summaryReceivingAccount, value: submitted.account },
                    ]}
                  />
                </View>
              ) : null}
              {/* CodeCreated: the note when this withdrawal also made the code. */}
              {codeNote === "created" ? (
                <CodeNote title={t.withdrawalCode.createdTitle} body={t.withdrawalCode.createdBody} />
              ) : codeNote === "reset" ? (
                <CodeNote title={t.withdrawalCode.resetTitle} body={t.withdrawalCode.resetBody} />
              ) : null}
            </View>
          </ScrollView>
          <FlowActionBar contentStyle={styles.narrow}>
            <FlowButton title={t.common.close} variant="play" onPress={handleClose} />
          </FlowActionBar>
        </View>
      ) : codePages === "create" ? (
        <CreateCodeFlow
          finishLabel={t.wallet.withdrawSubmit}
          finishVariant="primary"
          onLeave={() => setCodePages(null)}
          onCreated={(code) => submitWithCode(code, "created")}
          onAlreadySet={() => openEnterCode(null)}
          backRef={codeBackRef}
        />
      ) : codePages === "forgot" ? (
        <ForgotCodeFlow
          phone={user?.phone}
          sms={resetSms}
          finishLabel={t.wallet.withdrawSubmit}
          finishVariant="primary"
          onLeave={leaveForgot}
          onReset={(code) => {
            // The reset cleared the lock.
            lastLockRef.current = null;
            return submitWithCode(code, "reset");
          }}
          backRef={codeBackRef}
        />
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
             the button rather than sitting at the end of the form: a rejected
             amount or a failed request has to be readable from wherever the
             form happens to be scrolled. */
          action={
            <FlowActionBar contentStyle={styles.narrow}>
              {error ? <ErrorNotice message={error} /> : null}
              {step === 1 ? (
                <FlowButton title={t.wallet.continue} onPress={handleContinue} disabled={accountFieldsMissing} />
              ) : (
                <SheetStepActions
                  submitTitle={t.wallet.withdrawSubmit}
                  onSubmit={() => {
                    void once(handleSubmit);
                  }}
                  submitting={createWithdrawal.isPending || checkingCode}
                  submitDisabled={
                    !accountType ||
                    !accountName.trim() ||
                    !accountNumber.trim() ||
                    (requiresBankName && !bankName.trim()) ||
                    numericAmount <= 0
                  }
                  onBack={handleBack}
                />
              )}
            </FlowActionBar>
          }
        >
          <Animated.View entering={entering}>{step === 1 ? stepOne : stepTwo}</Animated.View>
        </SheetForm>
      )}
      {/* B1: over step 2, inside this sheet so iOS presents it from this one. */}
      <EnterCodeSheet
        key={enterSession}
        visible={enterOpen && !succeeded}
        onClose={() => setEnterOpen(false)}
        amountText={formatKyat(numericAmount)}
        accountText={receivingTitle}
        initialLockedUntil={enterLockedUntil}
        onSubmit={(code) => submitWithCode(code)}
        submitting={createWithdrawal.isPending}
        onForgot={handleForgot}
        forgotBusy={resetSms.sending}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  narrow: { width: "100%", maxWidth: SHEET_BODY_MAX_WIDTH, alignSelf: "center" },
  /** The page's 16pt margins: the full-height sheet has no side padding of its own. */
  inset: { paddingHorizontal: ROW_INSET },
  availableTop: { paddingTop: 12, paddingHorizontal: ROW_INSET },
  availableNote: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexShrink: 1, minHeight: 20 },
  availableText: { flexShrink: 1, color: theme.colors.textBody },
  typeTitle: { paddingTop: theme.spacing.xl, paddingHorizontal: ROW_INSET },
  typeSection: { paddingTop: 14 },
  typesError: { paddingHorizontal: ROW_INSET },
  /** The receiving account's fields: 20pt apart, 32pt under the type tiles. */
  fields: { gap: 20, paddingTop: theme.spacing.xl, paddingHorizontal: ROW_INSET },
  receiving: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: ROW_INSET,
  },
  receivingText: { flex: 1 },
  faint: { color: theme.colors.textFaint },
  muted: { color: theme.colors.textMuted },
  rule: { height: 1, marginTop: theme.spacing.lg, marginHorizontal: ROW_INSET, backgroundColor: theme.colors.border },
  /** The 44pt eye hangs 10pt into the right margin so its glyph lines up with the text edge. */
  availableRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    minHeight: theme.layout.minTouch,
    marginTop: 12,
    paddingLeft: ROW_INSET,
    paddingRight: ROW_INSET - 10,
  },
  eye: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  amountSection: { paddingTop: theme.spacing.md, paddingHorizontal: ROW_INSET },
  helper: { marginTop: 10 },
  successRoot: { flex: 1 },
  successPane: { paddingTop: theme.spacing.xxl, paddingBottom: theme.spacing.lg },
  summary: { marginTop: theme.spacing.xl },
});
