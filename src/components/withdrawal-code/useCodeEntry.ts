import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/localization/LanguageProvider";
import { useRequestWithdrawalCodeReset } from "@/hooks/useWithdrawalCode";
import type { CodeStatus } from "@/components/withdrawal-code/CodeParts";
import {
  CODE_LENGTH,
  announcePolite,
  digitsEnteredLabel,
  isTooEasyCode,
} from "@/components/withdrawal-code/codeRules";
import {
  failureText,
  isResendWait,
  plainErrorMessage,
  readCodeFailure,
  type CodeFailure,
} from "@/components/withdrawal-code/codeErrors";

/**
 * The state behind the withdrawal-code screens. Codes live here, in the
 * screen's own React state, and nowhere else — never a store, a query, the
 * device, or a log — and they go when the screen does.
 */

export interface DraftError {
  text: string;
  /**
   * The row is held: no key works until "Start over" (the boards' mismatch).
   * Otherwise the next key simply clears the message.
   */
  hold?: boolean;
}

/** One row of six dots: what is typed, the message under it, and the shake counter. */
export function useCodeDraft() {
  const { t } = useLanguage();
  const [value, setValue] = useState("");
  const [error, setError] = useState<DraftError | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  return {
    value,
    error,
    shakeKey,
    full: value.length === CODE_LENGTH,
    held: !!error?.hold,
    /** A typed digit (the caller has already judged it). Clears a non-holding message. */
    accept(next: string) {
      setValue(next);
      setError(null);
      announcePolite(digitsEnteredLabel(t, next.length));
    },
    erase() {
      if (!value) return;
      const next = value.slice(0, -1);
      setValue(next);
      setError(null);
      announcePolite(digitsEnteredLabel(t, next.length));
    },
    /** Refuses what was typed: the dots empty, the message shows, the row shakes. */
    refuse(text: string, options: { hold?: boolean } = {}) {
      setValue("");
      setError({ text, hold: options.hold });
      setShakeKey((key) => key + 1);
      announcePolite(text);
    },
    /** A message about the request rather than the digits (no connection…): the dots stay. */
    report(text: string) {
      setError({ text });
      announcePolite(text);
    },
    reset() {
      setValue("");
      setError(null);
    },
  };
}

export type CodeDraft = ReturnType<typeof useCodeDraft>;

/**
 * "Create a new code" then "Enter it again" — shared by the first code, the
 * forgot-code reset and the Profile change. Too-easy codes (and, when
 * changing, the old code) are refused on the 6th digit; a different second
 * entry is refused and holds the row until "Start over".
 */
export function useNewCodeSteps({ oldCode }: { oldCode?: string } = {}) {
  const { t } = useLanguage();
  const w = t.withdrawalCode;
  const [phase, setPhase] = useState<"new" | "confirm">("new");
  const [first, setFirst] = useState("");
  const draft = useCodeDraft();

  const typeDigit = (digit: string) => {
    if (draft.full || draft.held) return;
    const next = draft.value + digit;
    if (next.length === CODE_LENGTH) {
      if (phase === "new" && isTooEasyCode(next)) return draft.refuse(w.tooEasy);
      if (phase === "new" && oldCode && next === oldCode) return draft.refuse(w.same);
      if (phase === "confirm" && next !== first) return draft.refuse(w.mismatch, { hold: true });
      draft.accept(next);
      announcePolite(phase === "new" ? w.looksGood : w.codesMatch);
      return;
    }
    draft.accept(next);
  };

  const status: CodeStatus = draft.error
    ? { tone: "error", text: draft.error.text }
    : draft.full
      ? { tone: "ok", text: phase === "new" ? w.looksGood : w.codesMatch }
      : phase === "new"
        ? { tone: "hint", text: w.easyHint }
        : null;

  return {
    phase,
    draft,
    /** The first entry, once "Next" has taken it — the code that will be saved. */
    first,
    status,
    typeDigit,
    erase: () => {
      if (!draft.held) draft.erase();
    },
    /** "Next": the new code is taken and the confirm page opens. */
    next() {
      if (phase !== "new" || !draft.full || draft.error) return;
      setFirst(draft.value);
      setPhase("confirm");
      draft.reset();
    },
    /** Back to an empty "Create a new code". */
    startOver() {
      setPhase("new");
      setFirst("");
      draft.reset();
    },
    /** The header's back: confirm → new. False on "new" — the caller leaves this part. */
    back(): boolean {
      if (phase === "confirm") {
        setPhase("new");
        setFirst("");
        draft.reset();
        return true;
      }
      return false;
    },
    /** Puts a refusal the server made about the new code on the page it is about. True when handled. */
    applyFailure(failure: CodeFailure): boolean {
      if (failure.kind === "tooEasy" || failure.kind === "same") {
        setPhase("new");
        setFirst("");
        draft.refuse(failureText(failure, t));
        return true;
      }
      if (failure.kind === "mismatch") {
        setPhase("confirm");
        draft.refuse(w.mismatch, { hold: true });
        return true;
      }
      return false;
    },
  };
}

/**
 * Runs one request-starting handler at a time. A second tap that lands
 * before the next render still reads the busy STATE as false; this ref does
 * not, so a fast double tap is one request — one withdrawal, one SMS.
 */
export function useSingleFlight() {
  const running = useRef(false);
  return useCallback(async (task: () => Promise<unknown>): Promise<void> => {
    if (running.current) return;
    running.current = true;
    try {
      await task();
    } finally {
      running.current = false;
    }
  }, []);
}

/** The current time, re-read every `intervalMs` while that is set (null = stop). */
export function useNow(intervalMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (intervalMs === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** The server's resend wait, used when an answer does not say. */
const RESEND_SECONDS = 60;

/** The SMS code reset/verify accepted, and the single-use token it bought. */
interface VerifiedSms {
  otp: string;
  token: string;
  /** When the token runs out on this phone's clock (ms). */
  until: number;
}

/**
 * "Forgot code?"'s SMS (POST …/reset/request — "MyanFlix: 482 913"), and the
 * 60-second wait before another can be sent. Owned by the sheet that hosts
 * the forgot-code pages, so going back from them and returning within the
 * minute reuses the code already on its way instead of asking for one the
 * server would refuse.
 *
 * It also keeps the reset token a verified SMS code bought (reset/verify
 * spends the code): leaving the pages after Verify and coming back within
 * that minute offers the same, already spent code, and typing it again must
 * reuse the token rather than be refused as "wrong or expired". The host
 * calls `forget()` when it closes; a new SMS, a saved code, or the token's
 * own 10 minutes end it too.
 */
export function useResetSms() {
  const { t } = useLanguage();
  const request = useRequestWithdrawalCodeReset();
  const inFlight = useRef<Promise<string | null> | null>(null);
  const verified = useRef<VerifiedSms | null>(null);
  const [resend, setResend] = useState<{ at: number; seconds: number } | null>(null);
  const now = useNow(resend !== null ? 1000 : null);
  // Capped at the wait itself: the render right after a send still holds the
  // clock's previous tick, which may be long ago.
  const cooldown =
    resend === null ? 0 : Math.min(resend.seconds, Math.max(0, Math.ceil((resend.at - now) / 1000)));
  const resendAt = resend?.at ?? null;
  const startWait = (seconds: number) => setResend({ at: Date.now() + seconds * 1000, seconds });

  // Stop the clock once the wait is over.
  useEffect(() => {
    if (resendAt !== null && cooldown === 0) setResend(null);
  }, [resendAt, cooldown]);

  /**
   * Sends a code. Resolves null once one is on its way, else the message to
   * show. `reuseRecent` (opening the pages): a code sent in the last minute
   * is still good, so none is requested — and the server's own "wait" answer
   * means the same thing. A tapped "Send a new code" is never reused.
   */
  const send = ({ reuseRecent }: { reuseRecent: boolean }): Promise<string | null> => {
    if (reuseRecent && cooldown > 0) return Promise.resolve(null);
    // A second tap while one is on its way shares its answer — one SMS, never two.
    inFlight.current ??= (async () => {
      try {
        const sent = await request.mutateAsync();
        // A new code is on its way; the old one and anything bought with it are done.
        verified.current = null;
        startWait(sent.resendAfterSeconds || RESEND_SECONDS);
        return null;
      } catch (err) {
        if (isResendWait(err)) {
          startWait(RESEND_SECONDS);
          return reuseRecent ? null : t.auth.otp.waitForCode;
        }
        const failure = readCodeFailure(err);
        return failure ? failureText(failure, t) : plainErrorMessage(err, t, t.withdrawalCode.smsError);
      } finally {
        inFlight.current = null;
      }
    })();
    return inFlight.current;
  };

  return {
    cooldown,
    sending: request.isPending,
    send,
    /** reset/verify accepted `otp` and returned `token`, good for `expiresInSeconds`. */
    remember(otp: string, token: string, expiresInSeconds: number) {
      verified.current = { otp, token, until: Date.now() + expiresInSeconds * 1000 };
    },
    /** The token bought with exactly this SMS code, while it is still good; else null. */
    tokenFor(otp: string): string | null {
      const known = verified.current;
      if (!known || known.otp !== otp) return null;
      if (known.until <= Date.now()) {
        verified.current = null;
        return null;
      }
      return known.token;
    },
    forget() {
      verified.current = null;
    },
  };
}

export type ResetSms = ReturnType<typeof useResetSms>;
