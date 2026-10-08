import { useEffect, useState } from "react";
import { FlowButton, FlowHeader } from "@/components/wallet/MoneyFlow";
import { CodeKeypad } from "@/components/withdrawal-code/CodeKeypad";
import { CodeLink } from "@/components/withdrawal-code/CodeParts";
import { CodeDotsBlock, CodePage } from "@/components/withdrawal-code/CodePage";
import { useCodeLayout } from "@/components/withdrawal-code/useCodeLayout";
import { useNewCodeSteps, useSingleFlight } from "@/components/withdrawal-code/useCodeEntry";
import { announcePolite, digitsEnteredLabel } from "@/components/withdrawal-code/codeRules";
import {
  failureText,
  plainErrorMessage,
  readCodeFailure,
  type CodeFailure,
} from "@/components/withdrawal-code/codeErrors";
import { useCreateWithdrawalCode } from "@/hooks/useWithdrawalCode";
import { useLanguage } from "@/localization/LanguageProvider";

/** Where a hosting sheet's hardware back (Android) is sent while a code page is up. */
export type BackHandlerRef = { current: (() => void) | null };

/** Keeps `ref` pointing at the page's current back handler while it is mounted. */
export function useBackHandler(ref: BackHandlerRef | undefined, handler: () => void) {
  useEffect(() => {
    if (!ref) return;
    ref.current = handler;
    return () => {
      if (ref.current === handler) ref.current = null;
    };
  });
}

interface Props {
  /** "Submit Withdrawal" from Withdraw (crimson), "Save code" from Profile (white). */
  finishLabel: string;
  finishVariant: "primary" | "play";
  /** Back from the first page — returns to wherever the flow was opened from. */
  onLeave: () => void;
  /**
   * The server has saved the code. Withdraw sends the withdrawal with it;
   * Profile shows its done page. Resolves with a refusal to show here, or
   * null once the host has moved on.
   */
  onCreated: (code: string) => Promise<CodeFailure | null>;
  /** The account got a code meanwhile (another device, the website): enter that one instead. */
  onAlreadySet: () => void;
  backRef?: BackHandlerRef;
}

/**
 * A1 + A2 of the approved flow — "Create your withdrawal code" (1 of 2) and
 * "Enter it again" (2 of 2) — on the in-app keypad (CreateCode.dc.html,
 * ConfirmCode.dc.html). The first entry is checked against the too-easy list
 * on its 6th digit, the second must match it; the server checks both again
 * on POST /users/me/withdrawal-code before anything is saved.
 */
export function CreateCodeFlow({ finishLabel, finishVariant, onLeave, onCreated, onAlreadySet, backRef }: Props) {
  const { t } = useLanguage();
  const w = t.withdrawalCode;
  const { keyHeight } = useCodeLayout();
  const steps = useNewCodeSteps();
  const { phase, draft } = steps;
  const create = useCreateWithdrawalCode();
  const [submitting, setSubmitting] = useState(false);
  const once = useSingleFlight();

  const stepLabel = (n: number, title: string) =>
    `${t.wallet.stepOf.replace("{n}", String(n)).replace("{total}", "2")}, ${title}`;

  const goBack = () => {
    if (submitting) return;
    if (steps.back()) announcePolite(stepLabel(1, w.createTitle));
    else onLeave();
  };
  useBackHandler(backRef, goBack);

  const goNext = () => {
    if (!draft.full || draft.error) return;
    steps.next();
    announcePolite(stepLabel(2, w.confirmTitle));
  };

  const finish = async () => {
    if (phase !== "confirm" || !draft.full || draft.held || submitting) return;
    const code = steps.first;
    setSubmitting(true);
    try {
      await create.mutateAsync({ code, confirm: draft.value });
    } catch (err) {
      setSubmitting(false);
      const failure = readCodeFailure(err);
      if (failure?.kind === "alreadySet") {
        onAlreadySet();
        return;
      }
      if (failure && steps.applyFailure(failure)) return;
      draft.report(failure ? failureText(failure, t) : plainErrorMessage(err, t, w.saveError));
      return;
    }
    const problem = await onCreated(code);
    setSubmitting(false);
    if (problem) draft.report(failureText(problem, t));
  };

  const isNew = phase === "new";
  const title = isNew ? w.createTitle : w.confirmTitle;

  return (
    <CodePage
      header={
        <FlowHeader
          title={w.title}
          leading="back"
          onClose={goBack}
          closeLabel={t.common.back}
          closeDisabled={submitting}
          step={{ n: isNew ? 1 : 2, total: 2, title }}
        />
      }
      glyph="shieldLock"
      title={title}
      body={isNew ? w.createBody : w.confirmBody}
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
          <FlowButton title={w.next} variant="play" onPress={goNext} disabled={!draft.full || !!draft.error} />
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
