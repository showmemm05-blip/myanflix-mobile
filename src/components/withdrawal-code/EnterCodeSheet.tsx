import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ThemedText } from "@/components/ui/ThemedText";
import { FlowButton } from "@/components/wallet/MoneyFlow";
import { PressScale } from "@/components/wallet/PressScale";
import { CodeDots } from "@/components/withdrawal-code/CodeDots";
import { CodeKeypad } from "@/components/withdrawal-code/CodeKeypad";
import { CodeDisc, CodeLink, CodeStatusLine, type CodeStatus } from "@/components/withdrawal-code/CodeParts";
import { useCodeLayout } from "@/components/withdrawal-code/useCodeLayout";
import { useCodeDraft, useNow, useSingleFlight } from "@/components/withdrawal-code/useCodeEntry";
import {
  announcePolite,
  digitsEnteredLabel,
  lockedMessage,
  wrongMessage,
} from "@/components/withdrawal-code/codeRules";
import type { CodeFailure } from "@/components/withdrawal-code/codeErrors";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** "10,000 Ks" and "KBZPay — Kyaw Zin", for "To send … to …". */
  amountText: string;
  accountText: string;
  /** When the status said the code is locked, when that lock opens (ms). */
  initialLockedUntil: number | null;
  /**
   * Sends the withdrawal with the code. Resolves with a WRONG or LOCKED
   * refusal for this sheet to show, or null once the host has taken over
   * (success, or any other answer, which it shows on the amount step).
   */
  onSubmit: (code: string) => Promise<CodeFailure | null>;
  /** The withdrawal is in flight. */
  submitting: boolean;
  /** "Forgot code?": the host sends the SMS and opens the forgot-code pages; resolves with a message when it could not. */
  onForgot: () => Promise<string | null>;
  forgotBusy: boolean;
}

/** The grabber strip: 8pt above a 36×4 grabber. */
const HEADER_HEIGHT = 12;
/** Close: a 36pt disc in a 44pt target, 12pt down and 8pt in from the sheet's corner. */
const CLOSE_DISC = 36;
/** Before the first measurement — about the board's own sheet without the keypad. */
const ESTIMATED_BLOCK = 290;
/** Screen-reader focus moves to the title once the sheet has slid in. */
const FOCUS_DELAY_MS = 350;

/**
 * B1 of the approved flow — "Enter your withdrawal code", a sheet over the
 * amount step (EnterCode.dc.html): a 48pt shield disc, the title, "To send
 * 10,000 Ks to KBZPay — Kyaw Zin.", six dots, the message line, "Forgot
 * code?", the keypad and "Submit Withdrawal". A wrong code empties the dots,
 * shakes them and says how many tries are left; the 5th locks the code for
 * 15 minutes — the disc turns to a red timer, the keys go quiet and the
 * minutes count down, while "Forgot code?" still works.
 *
 * The sheet is as tall as its content (measured) and never taller than the
 * BottomSheet allows; past that, the part above the keypad scrolls, and each
 * key or message scrolls the dots and the message line into view. It is
 * rendered inside the withdraw flow's own sheet, so iOS presents it from
 * that one. The host remounts it (a new `key`) on every open, so nothing
 * typed survives a close.
 */
export function EnterCodeSheet({
  visible,
  onClose,
  amountText,
  accountText,
  initialLockedUntil,
  onSubmit,
  submitting,
  onForgot,
  forgotBusy,
}: Props) {
  const { t } = useLanguage();
  const w = t.withdrawalCode;
  const { keyHeight, compact } = useCodeLayout();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const draft = useCodeDraft();
  const titleRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const once = useSingleFlight();

  const [lockedUntil, setLockedUntil] = useState<number | null>(initialLockedUntil);
  const now = useNow(lockedUntil !== null ? 1000 : null);
  const locked = lockedUntil !== null && lockedUntil > now;
  useEffect(() => {
    if (lockedUntil !== null && lockedUntil <= now) setLockedUntil(null);
  }, [lockedUntil, now]);

  // Measured, so the sheet hugs its content at every text size and language.
  const [blockHeight, setBlockHeight] = useState(ESTIMATED_BLOCK);
  const measured = useRef(false);
  const [pinnedHeight, setPinnedHeight] = useState(4 * keyHeight + 3 * 10 + 10 + 14 + 52);
  const sheetBottomPadding = Math.max(insets.bottom, theme.spacing.md);
  const snapHeight = Math.min(
    HEADER_HEIGHT + blockHeight + pinnedHeight + sheetBottomPadding,
    windowHeight * 0.92,
  );

  useEffect(() => {
    if (!visible) {
      // Nothing typed outlives the sheet.
      draft.reset();
      return;
    }
    const focus = setTimeout(() => {
      if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(focus);
    // Only the open/close matters here; `draft.reset` is a fresh function on
    // every render and must not re-run this.
  }, [visible]);

  // Like CodePage's revealKey: on a phone too short for the whole block
  // (320pt, Burmese, text at 200%) every key and every new message scrolls the
  // dots, the message and "Forgot code?" up from under the keypad. Where
  // everything fits, scrollToEnd does nothing.
  const revealKey = `${draft.value.length}|${draft.error?.text ?? ""}|${draft.shakeKey}|${locked}`;
  const firstReveal = useRef(true);
  useEffect(() => {
    if (firstReveal.current) {
      firstReveal.current = false;
      return;
    }
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [revealKey]);

  const onBlockSize = (_width: number, height: number) => {
    setBlockHeight(Math.ceil(height));
    if (measured.current) return;
    measured.current = true;
    // Opened already locked: "Too many tries…" is the one line that says why
    // the keys are quiet, so it starts in view.
    if (locked) scrollRef.current?.scrollToEnd({ animated: false });
  };

  // While the withdrawal or the "Forgot code?" SMS is on its way, the sheet
  // stays put: its answer has to land somewhere the user can see.
  const busy = submitting || forgotBusy;

  const handleClose = () => {
    // Closing mid-request would hide the only answer this withdrawal gets.
    if (busy) return;
    onClose();
  };

  const type = (digit: string) => {
    if (draft.full || locked || busy) return;
    draft.accept(draft.value + digit);
  };

  const submit = async () => {
    if (!draft.full || locked || busy) return;
    const failure = await onSubmit(draft.value);
    if (!failure) {
      draft.reset();
      return;
    }
    if (failure.kind === "wrong") {
      draft.refuse(wrongMessage(t, failure.triesLeft));
      return;
    }
    if (failure.kind === "locked") {
      draft.reset();
      setLockedUntil(failure.until);
      announcePolite(lockedMessage(t, failure.until, Date.now()));
    }
  };

  const forgot = async () => {
    if (busy) return;
    const problem = await onForgot();
    if (problem) draft.report(problem);
  };

  const status: CodeStatus =
    locked && lockedUntil !== null
      ? { tone: "error", text: lockedMessage(t, lockedUntil, now) }
      : draft.error
        ? { tone: "error", text: draft.error.text }
        : null;

  const body = w.enterBody.replace("{amount}", amountText).replace("{account}", accountText);

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      snapHeight={snapHeight}
      dismissible={!busy}
      closeLabel={t.common.close}
      header={
        <View style={styles.header}>
          <View style={styles.grabber} />
        </View>
      }
    >
      <View style={styles.root}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          onContentSizeChange={onBlockSize}
        >
          <View style={styles.block}>
            {compact ? null : <CodeDisc glyph={locked ? "timer" : "shieldLock"} size={48} danger={locked} />}
            <View
              ref={titleRef}
              accessible
              accessibilityRole="header"
              accessibilityLabel={w.enterTitle}
              style={[styles.titleBox, compact ? styles.titleBoxCompact : styles.titleGap]}
            >
              <ThemedText variant="title" style={styles.center}>
                {w.enterTitle}
              </ThemedText>
            </View>
            <ThemedText variant="body" tabular style={[styles.center, styles.body]}>
              {body}
            </ThemedText>
            <CodeDots
              count={draft.value.length}
              tone={locked ? "locked" : draft.error ? "error" : "idle"}
              cursor={!locked}
              shakeKey={draft.shakeKey}
              accessibilityLabel={locked ? (status?.text ?? "") : digitsEnteredLabel(t, draft.value.length)}
              style={styles.dots}
            />
            <CodeStatusLine status={status} style={styles.status} />
            <CodeLink
              title={w.forgot}
              onPress={() => {
                void once(forgot);
              }}
              busy={forgotBusy}
              disabled={submitting}
              style={styles.forgot}
            />
          </View>
        </ScrollView>

        <View onLayout={(event) => setPinnedHeight(Math.ceil(event.nativeEvent.layout.height))}>
          <CodeKeypad
            keyHeight={keyHeight}
            onDigit={type}
            onDelete={draft.erase}
            digitsDisabled={draft.full || locked || busy}
            deleteDisabled={!draft.value || locked || busy}
            style={styles.keypad}
          />
          <FlowButton
            title={t.wallet.withdrawSubmit}
            onPress={() => {
              void once(submit);
            }}
            loading={submitting}
            disabled={!draft.full || locked}
            style={styles.submit}
          />
        </View>

        {/* Over the block's top-right corner, inside the body so Android still
            routes its taps (a view outside its parent's bounds gets none). */}
        <PressScale
          onPress={handleClose}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t.common.close}
          accessibilityState={{ disabled: busy }}
          style={[styles.closeTarget, busy && styles.closeBusy]}
        >
          <View style={styles.closeDisc}>
            <Ionicons name="close" size={18} color={theme.colors.text} />
          </View>
        </PressScale>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { height: HEADER_HEIGHT, paddingTop: theme.spacing.sm },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.grabber },
  root: { flex: 1 },
  scroll: { flex: 1 },
  /** EnterCode: the disc 16pt under the grabber. */
  block: { alignItems: "center", paddingTop: theme.spacing.md },
  titleBox: { alignSelf: "stretch" },
  titleGap: { marginTop: 12 },
  /** Without the disc the title starts beside the close button, so it keeps clear of it. */
  titleBoxCompact: { paddingHorizontal: theme.layout.minTouch - 8 },
  center: { textAlign: "center" },
  body: { marginTop: 6, maxWidth: 320, color: theme.colors.textMuted },
  dots: { marginTop: 22 },
  status: { marginTop: 14 },
  forgot: { marginTop: 2 },
  keypad: { marginTop: 10 },
  submit: { marginTop: 14 },
  closeTarget: {
    position: "absolute",
    top: 0,
    right: -theme.spacing.sm,
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBusy: { opacity: 0.4 },
  closeDisc: {
    width: CLOSE_DISC,
    height: CLOSE_DISC,
    borderRadius: CLOSE_DISC / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.tonal,
  },
});
