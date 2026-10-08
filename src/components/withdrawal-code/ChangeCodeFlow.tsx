import { useEffect, useState } from "react";
import { FlowButton, FlowHeader } from "@/components/wallet/MoneyFlow";
import { CodeKeypad } from "@/components/withdrawal-code/CodeKeypad";
import { CodeLink, type CodeStatus } from "@/components/withdrawal-code/CodeParts";
import { CodeDotsBlock, CodePage } from "@/components/withdrawal-code/CodePage";
import { useBackHandler, type BackHandlerRef } from "@/components/withdrawal-code/CreateCodeFlow";
import { useCodeLayout } from "@/components/withdrawal-code/useCodeLayout";
import { useCodeDraft, useNewCodeSteps, useNow, useSingleFlight } from "@/components/withdrawal-code/useCodeEntry";
import {
  announcePolite,
  digitsEnteredLabel,
  lockedMessage,
  wrongMessage,
} from "@/components/withdrawal-code/codeRules";
import { failureText, plainErrorMessage, readCodeFailure } from "@/components/withdrawal-code/codeErrors";
import { useChangeWithdrawalCode, useVerifyWithdrawalCode } from "@/hooks/useWithdrawalCode";
import { useLanguage } from "@/localization/LanguageProvider";

interface Props {
  /** When the status said the code is locked, when that lock opens (ms). */
  initialLockedUntil: number | null;
  /** Back from the first page — closes the sheet. */
  onLeave: () => void;
  /** "Forgot code?": the host sends the SMS and opens the forgot-code pages; resolves with a message when it could not. */
  onForgot: () => Promise<string | null>;
  forgotBusy: boolean;
  /** Saved: the host shows "Code changed". */
  onChanged: () => void;
  /** The account has no code after all: the host switches to "Create code". */
  onNotSet: () => void;
  backRef?: BackHandlerRef;
}

/**
 * D1–D3 of the approved flow (ChangeCode.dc.html): "Enter your current code"
 * (1 of 3, checked by POST …/verify, which counts toward the same 5-try,
 * 15-minute lock as a withdrawal), then "Create a new code" — not too easy
 * and not the current one — and "Enter it again". "Save code" sends all
 * three to PUT …/withdrawal-code, which checks the current code once more.
 */
export function ChangeCodeFlow({
  initialLockedUntil,
  onLeave,
  onForgot,
  forgotBusy,
  onChanged,
  onNotSet,
  backRef,
}: Props) {
  const { t } = useLanguage();
  const w = t.withdrawalCode;
  const { keyHeight } = useCodeLayout();
  const current = useCodeDraft();
  const [stage, setStage] = useState<"current" | "code">("current");
  /** The current code, once the server has accepted it — kept for the PUT and for the "same" check. */
  const [oldCode, setOldCode] = useState("");
  const steps = useNewCodeSteps({ oldCode });
  const verify = useVerifyWithdrawalCode();
  const change = useChangeWithdrawalCode();
  const [submitting, setSubmitting] = useState(false);
  const once = useSingleFlight();

  const [lockedUntil, setLockedUntil] = useState<number | null>(initialLockedUntil);
  const now = useNow(lockedUntil !== null ? 1000 : null);
  const locked = lockedUntil !== null && lockedUntil > now;
  // The lock has run out: the page simply works again.
  useEffect(() => {
    if (lockedUntil !== null && lockedUntil <= now) setLockedUntil(null);
  }, [lockedUntil, now]);

  const busy = verify.isPending || submitting || forgotBusy;
  const stepNumber = stage === "current" ? 1 : steps.phase === "new" ? 2 : 3;
  const title = stage === "current" ? w.currentTitle : steps.phase === "new" ? w.newTitle : w.confirmTitle;
  const stepLabel = (n: number, pageTitle: string) =>
    `${t.wallet.stepOf.replace("{n}", String(n)).replace("{total}", "3")}, ${pageTitle}`;

  const lock = (until: number) => {
    current.reset();
    setLockedUntil(until);
    announcePolite(lockedMessage(t, until, Date.now()));
  };

  const backToCurrent = () => {
    setStage("current");
    setOldCode("");
    steps.startOver();
    current.reset();
  };

  const goBack = () => {
    if (busy) return;
    if (stage === "current") {
      onLeave();
      return;
    }
    if (steps.back()) {
      announcePolite(stepLabel(2, w.newTitle));
      return;
    }
    backToCurrent();
    announcePolite(stepLabel(1, w.currentTitle));
  };
  useBackHandler(backRef, goBack);

  const typeCurrent = (digit: string) => {
    if (current.full || locked || busy) return;
    current.accept(current.value + digit);
  };

  const checkCurrent = async () => {
    if (!current.full || locked || busy) return;
    const code = current.value;
    try {
      await verify.mutateAsync(code);
    } catch (err) {
      const failure = readCodeFailure(err);
      if (failure?.kind === "wrong") return current.refuse(wrongMessage(t, failure.triesLeft));
      if (failure?.kind === "locked") return lock(failure.until);
      if (failure?.kind === "notSet") return onNotSet();
      current.report(failure ? failureText(failure, t) : plainErrorMessage(err, t, w.checkError));
      return;
    }
    setOldCode(code);
    current.reset();
    setStage("code");
    steps.startOver();
    announcePolite(stepLabel(2, w.newTitle));
  };

  const forgot = async () => {
    if (busy) return;
    const problem = await onForgot();
    if (problem) current.report(problem);
  };

  const save = async () => {
    const { draft } = steps;
    if (steps.phase !== "confirm" || !draft.full || draft.held || submitting) return;
    setSubmitting(true);
    try {
      await change.mutateAsync({ currentCode: oldCode, newCode: steps.first, confirm: draft.value });
    } catch (err) {
      setSubmitting(false);
      const failure = readCodeFailure(err);
      if (failure && steps.applyFailure(failure)) return;
      if (failure?.kind === "wrong" || failure?.kind === "locked") {
        // The current code stopped being right meanwhile (changed elsewhere):
        // it has to be entered again.
        backToCurrent();
        if (failure.kind === "wrong") current.refuse(wrongMessage(t, failure.triesLeft));
        else lock(failure.until);
        return;
      }
      if (failure?.kind === "notSet") return onNotSet();
      draft.report(failure ? failureText(failure, t) : plainErrorMessage(err, t, w.saveError));
      return;
    }
    setSubmitting(false);
    setOldCode("");
    onChanged();
  };

  const header = (
    <FlowHeader
      title={w.title}
      leading="back"
      onClose={goBack}
      closeLabel={t.common.back}
      closeDisabled={busy}
      step={{ n: stepNumber, total: 3, title }}
    />
  );

  if (stage === "current") {
    const status: CodeStatus =
      locked && lockedUntil !== null
        ? { tone: "error", text: lockedMessage(t, lockedUntil, now) }
        : current.error
          ? { tone: "error", text: current.error.text }
          : null;
    return (
      <CodePage
        header={header}
        glyph={locked ? "timer" : "shieldLock"}
        discDanger={locked}
        title={w.currentTitle}
        body={w.currentBody}
        pageKey="current"
        revealKey={`${current.value.length}|${status?.text ?? ""}`}
        keypad={
          <CodeKeypad
            keyHeight={keyHeight}
            onDigit={typeCurrent}
            onDelete={current.erase}
            digitsDisabled={current.full || locked || busy}
            deleteDisabled={!current.value || locked || busy}
          />
        }
        action={
          <FlowButton
            title={w.next}
            variant="play"
            onPress={() => {
              void once(checkCurrent);
            }}
            loading={verify.isPending}
            disabled={!current.full || locked}
          />
        }
      >
        <CodeDotsBlock
          count={current.value.length}
          tone={locked ? "locked" : current.error ? "error" : "idle"}
          cursor={!locked}
          shakeKey={current.shakeKey}
          countLabel={digitsEnteredLabel(t, current.value.length)}
          status={status}
          link={
            <CodeLink
              title={w.forgot}
              onPress={() => {
                void once(forgot);
              }}
              busy={forgotBusy}
              disabled={verify.isPending || submitting}
            />
          }
        />
      </CodePage>
    );
  }

  const { draft } = steps;
  const isNew = steps.phase === "new";
  return (
    <CodePage
      header={header}
      glyph="shieldLock"
      title={title}
      body={isNew ? w.createBody : w.confirmBody}
      pageKey={steps.phase}
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
            title={w.saveCode}
            variant="play"
            onPress={() => {
              void once(save);
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
