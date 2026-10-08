import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { BusyDots } from "@/components/ui/BusyDots";
import { SheetSuccess } from "@/components/wallet/SheetForm";
import { InlineError } from "@/components/wallet/InlineError";
import { FlowActionBar, FlowButton, FlowHeader } from "@/components/wallet/MoneyFlow";
import { ChangeCodeFlow } from "@/components/withdrawal-code/ChangeCodeFlow";
import { CreateCodeFlow } from "@/components/withdrawal-code/CreateCodeFlow";
import { ForgotCodeFlow } from "@/components/withdrawal-code/ForgotCodeFlow";
import { useResetSms } from "@/components/withdrawal-code/useCodeEntry";
import { announcePolite, lockEnd } from "@/components/withdrawal-code/codeRules";
import { plainErrorMessage } from "@/components/withdrawal-code/codeErrors";
import { WITHDRAWAL_CODE_STATUS_KEY, useFetchWithdrawalCodeStatus } from "@/hooks/useWithdrawalCode";
import { useAuth } from "@/hooks/useAuth";
import { ROW_INSET, SHEET_BODY_MAX_WIDTH } from "@/hooks/useWalletLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { WithdrawalCodeStatus } from "@/types/withdrawal-code";

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Mode =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "create" }
  | { kind: "change"; lockedUntil: number | null }
  | { kind: "forgot" }
  | { kind: "done"; title: string; body: string };

/** The pages draw their own header; the sheet's drag strip stays empty. */
const NO_HEADER = <View />;

/** The fresh status's lock as the change pages need it. */
const lockOf = (status: WithdrawalCodeStatus | undefined) =>
  status?.lockedUntil ? lockEnd(status.lockedUntil) : null;

/**
 * Profile › Account › "Withdrawal code" (D0–D4 of the approved flow): the
 * same full-height pages the withdraw flow uses, from a fresh status read on
 * every open — "Create code" (new + confirm, then saved) when the account
 * has none, otherwise "Change code" (current → new → confirm → "Code
 * changed"), with "Forgot code?" on the current-code page (SMS → new →
 * confirm → "New withdrawal code saved"). No withdrawal happens here.
 *
 * Every page lives only while the sheet is open: closing drops them after
 * the close animation, and with them every digit typed.
 */
export function WithdrawalCodeSheet({ visible, onClose }: Props) {
  const { t } = useLanguage();
  const w = t.withdrawalCode;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchStatus = useFetchWithdrawalCodeStatus();
  const sms = useResetSms();
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const backRef = useRef<(() => void) | null>(null);
  /** Bumped by every load and every close, so a late answer never lands on a newer state. */
  const loadId = useRef(0);

  const load = async () => {
    const id = ++loadId.current;
    setMode({ kind: "loading" });
    try {
      const status = await fetchStatus();
      if (id !== loadId.current) return;
      setMode(status.hasCode ? { kind: "change", lockedUntil: lockOf(status) } : { kind: "create" });
    } catch (err) {
      if (id !== loadId.current) return;
      setMode({ kind: "error", message: plainErrorMessage(err, t, w.statusError) });
    }
  };

  useEffect(() => {
    if (visible) void load();
    // Only an open starts a read; `load` is a fresh function every render.
  }, [visible]);

  const close = () => {
    const id = ++loadId.current;
    // A verified "Forgot code?" SMS and its reset token go with the sheet.
    sms.forget();
    onClose();
    // After the sheet's close animation, so the page does not visibly empty
    // first — unless it was opened again meanwhile (a new load bumped the id).
    setTimeout(() => {
      if (loadId.current === id) setMode({ kind: "loading" });
    }, 250);
  };

  /** Android's back: a page steps back the way its own back button does. */
  const handleRequestClose = () => {
    if (backRef.current) backRef.current();
    else close();
  };

  const finish = (title: string, body: string) => {
    setMode({ kind: "done", title, body });
    announcePolite(title);
  };

  const openForgot = async (): Promise<string | null> => {
    const problem = await sms.send({ reuseRecent: true });
    if (problem) return problem;
    setMode({ kind: "forgot" });
    announcePolite(`${t.wallet.stepOf.replace("{n}", "1").replace("{total}", "3")}, ${w.smsTitle}`);
    return null;
  };

  /**
   * Back from the forgot pages: the change pages, with whatever lock the
   * server last reported (a LOCKED answer writes it into the cached status).
   */
  const backToChange = () => {
    const status = queryClient.getQueryData<WithdrawalCodeStatus>(WITHDRAWAL_CODE_STATUS_KEY);
    setMode({ kind: "change", lockedUntil: lockOf(status) });
  };

  const plainHeader = <FlowHeader title={w.title} onClose={close} closeLabel={t.common.close} />;

  let body;
  switch (mode.kind) {
    case "loading":
      body = (
        <View style={styles.fill}>
          {plainHeader}
          <View style={styles.center} accessible accessibilityLabel={t.common.loading}>
            <BusyDots color={theme.colors.textMuted} />
          </View>
        </View>
      );
      break;
    case "error":
      body = (
        <View style={styles.fill}>
          {plainHeader}
          <View style={[styles.narrow, styles.errorBox]}>
            <InlineError
              message={mode.message}
              onRetry={() => {
                void load();
              }}
            />
          </View>
        </View>
      );
      break;
    case "create":
      body = (
        <CreateCodeFlow
          finishLabel={w.saveCode}
          finishVariant="play"
          onLeave={close}
          onCreated={async () => {
            finish(w.createdTitle, w.createBody);
            return null;
          }}
          onAlreadySet={() => {
            void load();
          }}
          backRef={backRef}
        />
      );
      break;
    case "change":
      body = (
        <ChangeCodeFlow
          initialLockedUntil={mode.lockedUntil}
          onLeave={close}
          onForgot={openForgot}
          forgotBusy={sms.sending}
          onChanged={() => finish(w.changedTitle, w.changedBody)}
          onNotSet={() => setMode({ kind: "create" })}
          backRef={backRef}
        />
      );
      break;
    case "forgot":
      body = (
        <ForgotCodeFlow
          phone={user?.phone}
          sms={sms}
          finishLabel={w.saveCode}
          finishVariant="play"
          onLeave={backToChange}
          onReset={async () => {
            finish(w.resetTitle, w.resetBody);
            return null;
          }}
          backRef={backRef}
        />
      );
      break;
    case "done":
      /* ChangeCode "saved": the green tick 104pt down (56 of header row +
         48), what changed, and Done pinned at the bottom. */
      body = (
        <View style={styles.fill}>
          <FlowHeader onClose={close} closeLabel={t.common.close} />
          <ScrollView contentContainerStyle={styles.donePane} showsVerticalScrollIndicator={false}>
            <View style={[styles.narrow, styles.inset]}>
              <SheetSuccess title={mode.title} body={mode.body} haloSize={96} />
            </View>
          </ScrollView>
          <FlowActionBar contentStyle={styles.narrow}>
            <FlowButton title={w.done} variant="play" onPress={close} />
          </FlowActionBar>
        </View>
      );
      break;
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={handleRequestClose}
      fullScreen
      header={NO_HEADER}
      closeLabel={t.common.close}
    >
      {body}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  narrow: { width: "100%", maxWidth: SHEET_BODY_MAX_WIDTH, alignSelf: "center" },
  inset: { paddingHorizontal: ROW_INSET },
  errorBox: { paddingTop: theme.spacing.lg, paddingHorizontal: ROW_INSET },
  donePane: { paddingTop: theme.spacing.xxl, paddingBottom: theme.spacing.lg },
});
