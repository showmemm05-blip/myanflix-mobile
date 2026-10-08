import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { FlowButton, FlowHeader } from "@/components/wallet/MoneyFlow";
import { CodeKeypad } from "@/components/withdrawal-code/CodeKeypad";
import { CodeLink, CodeStatusLine } from "@/components/withdrawal-code/CodeParts";
import { CodeDotsBlock, CodePage } from "@/components/withdrawal-code/CodePage";
import { SmsCodeCells } from "@/components/withdrawal-code/SmsCodeCells";
import { useBackHandler, type BackHandlerRef } from "@/components/withdrawal-code/CreateCodeFlow";
import { useCodeLayout } from "@/components/withdrawal-code/useCodeLayout";
import { useNewCodeSteps, useSingleFlight, type ResetSms } from "@/components/withdrawal-code/useCodeEntry";
import { CODE_LENGTH, announcePolite, digitsEnteredLabel, maskPhone } from "@/components/withdrawal-code/codeRules";
import {
  failureText,
  plainErrorMessage,
  readCodeFailure,
  type CodeFailure,
} from "@/components/withdrawal-code/codeErrors";
import { useConfirmWithdrawalCodeReset, useVerifyWithdrawalCodeReset } from "@/hooks/useWithdrawalCode";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/** The reset token's life when an answer does not say (the server's 10 minutes). */
const TOKEN_SECONDS = 600;

interface Props {
  /** The account phone (GET /users/me), shown masked: "09 •••• ••• 471". */
  phone: string | null | undefined;
  /** The host's SMS sender — it sent the first code before opening these pages. */
  sms: ResetSms;
  /** "Submit Withdrawal" from Withdraw (crimson), "Save code" from Profile (white). */
  finishLabel: string;
  finishVariant: "primary" | "play";
  /** Back from the SMS page — to the code entry the user came from. */
  onLeave: () => void;
  /**
   * The server has saved the new code (and cleared the lock). Withdraw sends
   * the withdrawal with it; Profile shows its done page. Resolves with a
   * refusal to show here, or null once the host has moved on.
   */
  onReset: (code: string) => Promise<CodeFailure | null>;
  backRef?: BackHandlerRef;
}

/**
 * C1–C3 of the approved flow (ForgotCode.dc.html): "Verify it's you" — the
 * 6-digit SMS code on the same keypad, with the resend countdown — then
 * "Create a new code" and "Enter it again". The SMS code is checked first
 * (POST …/reset/verify), which returns a single-use token; the new code goes
 * to …/reset/confirm with it. Going back from the new code and pressing
 * Verify again with the same SMS code reuses that token instead of spending
 * a code that is already spent. The token is kept by the host's `sms` (not
 * here), so the same holds after leaving these pages and coming back.
 */
export function ForgotCodeFlow({ phone, sms, finishLabel, finishVariant, onLeave, onReset, backRef }: Props) {
  const { t } = useLanguage();
  const w = t.withdrawalCode;
  const { keyHeight } = useCodeLayout();
  const steps = useNewCodeSteps();
  const { phase, draft } = steps;
  const verify = useVerifyWithdrawalCodeReset();
  const confirm = useConfirmWithdrawalCodeReset();

  const [stage, setStage] = useState<"sms" | "code">("sms");
  const [smsValue, setSmsValue] = useState("");
  const [smsInvalid, setSmsInvalid] = useState(false);
  const [smsMessage, setSmsMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const once = useSingleFlight();

  const busy = verify.isPending || submitting;
  const stepNumber = stage === "sms" ? 1 : phase === "new" ? 2 : 3;
  const title = stage === "sms" ? w.smsTitle : phase === "new" ? w.newTitle : w.confirmTitle;
  const stepLabel = (n: number, pageTitle: string) =>
    `${t.wallet.stepOf.replace("{n}", String(n)).replace("{total}", "3")}, ${pageTitle}`;

  const showSmsMessage = (message: string | null) => {
    setSmsMessage(message);
    if (message) announcePolite(message);
  };

  const goBack = () => {
    if (busy) return;
    if (stage === "sms") {
      onLeave();
      return;
    }
    if (steps.back()) {
      announcePolite(stepLabel(2, w.newTitle));
      return;
    }
    // Back to the SMS page: what was typed there stays, and so does the token.
    setStage("sms");
    announcePolite(stepLabel(1, w.smsTitle));
  };
  useBackHandler(backRef, goBack);

  const typeSms = (digit: string) => {
    if (smsValue.length >= CODE_LENGTH || busy) return;
    const next = smsValue + digit;
    setSmsValue(next);
    setSmsInvalid(false);
    setSmsMessage(null);
    announcePolite(digitsEnteredLabel(t, next.length));
  };

  const eraseSms = () => {
    if (!smsValue || busy) return;
    const next = smsValue.slice(0, -1);
    setSmsValue(next);
    setSmsInvalid(false);
    setSmsMessage(null);
    announcePolite(digitsEnteredLabel(t, next.length));
  };

  const openNewCode = () => {
    setStage("code");
    steps.startOver();
    announcePolite(stepLabel(2, w.newTitle));
  };

  const checkSms = async () => {
    if (smsValue.length !== CODE_LENGTH || busy) return;
    if (sms.tokenFor(smsValue)) {
      openNewCode();
      return;
    }
    try {
      const { resetToken, expiresInSeconds } = await verify.mutateAsync(smsValue);
      sms.remember(smsValue, resetToken, expiresInSeconds || TOKEN_SECONDS);
      openNewCode();
    } catch (err) {
      const failure = readCodeFailure(err);
      if (failure?.kind === "smsInvalid" || failure?.kind === "smsTooMany") {
        setSmsValue("");
        setSmsInvalid(true);
        showSmsMessage(failureText(failure, t));
        return;
      }
      showSmsMessage(failure ? failureText(failure, t) : plainErrorMessage(err, t, w.checkError));
    }
  };

  const resend = async () => {
    if (busy) return;
    const problem = await sms.send({ reuseRecent: false });
    if (problem) {
      showSmsMessage(problem);
      return;
    }
    // A new code is on its way; the old one and anything bought with it are
    // done (`sms.send` has already dropped its token).
    setSmsValue("");
    setSmsInvalid(false);
    setSmsMessage(null);
  };

  const finish = async () => {
    if (phase !== "confirm" || !draft.full || draft.held || submitting) return;
    const resetToken = sms.tokenFor(smsValue);
    if (!resetToken) {
      // The token's 10 minutes are over: the SMS code it was bought with is
      // spent too, so start again from a fresh one, as the server's own
      // "expired" answer below does.
      setSmsValue("");
      setSmsInvalid(false);
      setStage("sms");
      steps.startOver();
      showSmsMessage(w.resetExpired);
      return;
    }
    const code = steps.first;
    setSubmitting(true);
    try {
      await confirm.mutateAsync({ resetToken, newCode: code, confirm: draft.value });
    } catch (err) {
      setSubmitting(false);
      const failure = readCodeFailure(err);
      if (failure && steps.applyFailure(failure)) return;
      if (failure?.kind === "resetExpired" || failure?.kind === "smsInvalid" || failure?.kind === "smsTooMany") {
        // The step's token is gone: start again from a fresh SMS code.
        sms.forget();
        setSmsValue("");
        setSmsInvalid(false);
        setStage("sms");
        steps.startOver();
        showSmsMessage(w.resetExpired);
        return;
      }
      draft.report(failure ? failureText(failure, t) : plainErrorMessage(err, t, w.saveError));
      return;
    }
    sms.forget();
    const problem = await onReset(code);
    setSubmitting(false);
    if (problem) draft.report(failureText(problem, t));
  };

  const header = (
    <FlowHeader
      title={w.forgotHeader}
      leading="back"
      onClose={goBack}
      closeLabel={t.common.back}
      closeDisabled={busy}
      step={{ n: stepNumber, total: 3, title }}
    />
  );

  if (stage === "sms") {
    const smsFull = smsValue.length === CODE_LENGTH;
    return (
      <CodePage
        header={header}
        glyph="sms"
        title={w.smsTitle}
        body={w.smsBody.replace("{phone}", maskPhone(phone))}
        pageKey="sms"
        revealKey={`${smsValue.length}|${smsMessage ?? ""}`}
        keypad={
          <CodeKeypad
            keyHeight={keyHeight}
            onDigit={typeSms}
            onDelete={eraseSms}
            digitsDisabled={smsFull || busy}
            deleteDisabled={!smsValue || busy}
          />
        }
        action={
          <FlowButton
            title={w.verify}
            variant="play"
            onPress={() => {
              void once(checkSms);
            }}
            loading={verify.isPending}
            disabled={!smsFull}
          />
        }
      >
        <View style={styles.cells}>
          <SmsCodeCells
            value={smsValue}
            invalid={smsInvalid}
            accessibilityLabel={digitsEnteredLabel(t, smsValue.length)}
          />
        </View>
        {smsMessage ? <CodeStatusLine status={{ tone: "error", text: smsMessage }} style={styles.smsMessage} /> : null}
        <View style={styles.resend}>
          {sms.cooldown > 0 ? (
            <CodeLink
              title={w.smsResendIn.replace("{n}", String(sms.cooldown))}
              glyph="clock"
              muted
              onPress={() => {}}
            />
          ) : (
            <CodeLink
              title={w.smsResend}
              glyph="resend"
              onPress={() => {
                void once(resend);
              }}
              busy={sms.sending}
              disabled={busy}
            />
          )}
        </View>
      </CodePage>
    );
  }

  const isNew = phase === "new";
  return (
    <CodePage
      header={header}
      glyph="shieldLock"
      title={title}
      body={isNew ? w.resetNewBody : w.confirmBody}
      pageKey={phase}
      revealKey={`${draft.value.length}|${steps.status?.text ?? ""}`}
      keypad={
        <CodeKeypad
          keyHeight={keyHeight}
          onDigit={steps.typeDigit}
          onDelete={steps.erase}
          digitsDisabled={draft.full || draft.held || submitting}
          deleteDisabled={!draft.value || draft.held || submitting}
        />
      }
      action={
        isNew ? (
          <FlowButton
            title={w.next}
            variant="play"
            onPress={() => {
              if (!draft.full || draft.error) return;
              steps.next();
              announcePolite(stepLabel(3, w.confirmTitle));
            }}
            disabled={!draft.full || !!draft.error}
          />
        ) : (
          <FlowButton
            title={finishLabel}
            variant={finishVariant}
            onPress={() => {
              void once(finish);
            }}
            loading={submitting}
            disabled={!draft.full || draft.held}
          />
        )
      }
    >
      <CodeDotsBlock
        count={draft.value.length}
        tone={draft.error ? "error" : "idle"}
        cursor={!draft.held}
        shakeKey={draft.shakeKey}
        countLabel={digitsEnteredLabel(t, draft.value.length)}
        status={steps.status}
        link={
          draft.held ? (
            <CodeLink title={w.startOver} glyph="startOver" onPress={steps.startOver} disabled={submitting} />
          ) : null
        }
      />
    </CodePage>
  );
}

const styles = StyleSheet.create({
  /** ForgotCode: the cells 24pt under the explanation, full width. */
  cells: { marginTop: theme.spacing.lg, alignSelf: "stretch" },
  smsMessage: { marginTop: 12 },
  resend: { marginTop: theme.spacing.xs, alignItems: "center" },
});
