import { useEffect, useRef, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { Rise } from "@/components/auth/AuthParts";
import { CodeDisc, CodeStatusLine, type CodeStatus } from "@/components/withdrawal-code/CodeParts";
import { CodeDots, type CodeDotsTone } from "@/components/withdrawal-code/CodeDots";
import type { CodeGlyphName } from "@/components/withdrawal-code/CodeGlyph";
import { useCodeLayout } from "@/components/withdrawal-code/useCodeLayout";
import { ROW_INSET, SHEET_BODY_MAX_WIDTH } from "@/hooks/useWalletLayout";
import { theme } from "@/theme";

interface Props {
  /** The flow header (FlowHeader with a back chevron, "Withdrawal code", "1 of 2"). */
  header: ReactNode;
  glyph: CodeGlyphName;
  /** The disc turns red (a lock). */
  discDanger?: boolean;
  title: string;
  body: string;
  /** Changes when the page changes, so the new page's block rises in. */
  pageKey: string;
  /**
   * Changes with every key and every new message. On a phone too short to
   * show the whole block (320pt, large text) it scrolls the dots and the
   * message up into view; where everything fits it does nothing.
   */
  revealKey?: unknown;
  /** The dots (or SMS cells), the message line and the page's link. */
  children: ReactNode;
  keypad: ReactNode;
  /** The pinned button ("Next", "Submit Withdrawal", "Verify", "Save code"). */
  action: ReactNode;
}

/**
 * A full-height withdrawal-code page (CreateCode / ConfirmCode / ForgotCode /
 * ChangeCode .dc.html): the header, then a centred block — the 56pt disc,
 * the 24/30 title, the 15/23 explanation, the dots and the line under them —
 * and the keypad with the button pinned at the bottom, 16pt apart.
 *
 * The block scrolls on its own when it outgrows the room above the keypad
 * (320pt phones, Burmese, text at 200%); the disc is left out on short
 * phones and at large text so the dots stay above the keypad. A phone on its
 * side scrolls the keypad with the page and pins only the button.
 */
export function CodePage({
  header,
  glyph,
  discDanger,
  title,
  body,
  pageKey,
  revealKey,
  children,
  keypad,
  action,
}: Props) {
  const { compact, short } = useCodeLayout();
  const scrollRef = useRef<ScrollView>(null);
  const firstReveal = useRef(true);

  useEffect(() => {
    if (firstReveal.current) {
      firstReveal.current = false;
      return;
    }
    // A no-op when everything fits; on a short phone it brings the dots and
    // the new message up from under the keypad.
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [revealKey]);

  // A new page starts at its top, like the withdraw steps do.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [pageKey]);

  const block = (
    <Rise key={pageKey} style={styles.block}>
      {compact ? null : <CodeDisc glyph={glyph} size={56} danger={discDanger} />}
      <ThemedText variant="title" accessibilityRole="header" style={[styles.center, !compact && styles.titleGap]}>
        {title}
      </ThemedText>
      <ThemedText variant="body" tabular style={[styles.center, styles.body]}>
        {body}
      </ThemedText>
      {children}
    </Rise>
  );

  return (
    <View style={styles.root}>
      {header}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        <View style={styles.column}>
          {block}
          {short ? <View style={styles.keypadInline}>{keypad}</View> : null}
        </View>
      </ScrollView>
      <View style={[styles.bottom, styles.column, short && styles.bottomShort]}>
        {short ? null : keypad}
        <View style={short ? null : styles.actionGap}>{action}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  /** The boards' `padding: 24px 16px 0`. */
  scrollContent: { paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.md, paddingHorizontal: ROW_INSET },
  scrollContentCompact: { paddingTop: theme.spacing.md },
  column: { width: "100%", maxWidth: SHEET_BODY_MAX_WIDTH, alignSelf: "center" },
  block: { alignItems: "center" },
  center: { textAlign: "center" },
  titleGap: { marginTop: theme.spacing.md },
  body: { marginTop: theme.spacing.sm, maxWidth: 330, color: theme.colors.textMuted },
  keypadInline: { marginTop: theme.spacing.lg },
  bottom: { paddingHorizontal: ROW_INSET },
  bottomShort: { paddingTop: theme.spacing.sm },
  /** The keypad ends 16pt above the button. */
  actionGap: { marginTop: theme.spacing.md },
});

interface DotsBlockProps {
  count: number;
  tone: CodeDotsTone;
  cursor: boolean;
  shakeKey: number;
  /** "3 of 6 digits entered". */
  countLabel: string;
  status: CodeStatus;
  /** "Forgot code?" or "Start over", 4pt under the message. */
  link?: ReactNode;
}

/** A code page's dots (28pt under the explanation), the message line 18pt under them, then its link. */
export function CodeDotsBlock({ count, tone, cursor, shakeKey, countLabel, status, link }: DotsBlockProps) {
  return (
    <>
      <CodeDots
        count={count}
        tone={tone}
        cursor={cursor}
        shakeKey={shakeKey}
        accessibilityLabel={countLabel}
        style={blockStyles.dots}
      />
      <CodeStatusLine status={status} style={blockStyles.status} />
      {link ? <View style={blockStyles.link}>{link}</View> : null}
    </>
  );
}

const blockStyles = StyleSheet.create({
  dots: { marginTop: 28 },
  status: { marginTop: 18 },
  link: { marginTop: theme.spacing.xs },
});
