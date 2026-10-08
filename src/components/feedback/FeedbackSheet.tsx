import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SheetForm } from "@/components/wallet/SheetForm";
import {
  AccountTextArea,
  ActionButton,
  FieldCaption,
  Notice,
  SheetHeader,
  SheetIntro,
  SuccessPanel,
  accountActionBar,
} from "@/components/profile/AccountKit";
import { useSubmitFeedback } from "@/hooks/useFeedback";
import { useLanguage } from "@/localization/LanguageProvider";
import { ApiError } from "@/utils/errors";
import { theme, withAlpha } from "@/theme";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
  type FeedbackCategory,
} from "@/types/feedback";

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** One glyph per backend category (Feedback.dc.html's tiles). */
const CATEGORY_ICONS: Record<FeedbackCategory, keyof typeof Ionicons.glyphMap> = {
  BUG: "bug-outline",
  SUGGESTION: "bulb-outline",
  CONTENT: "film-outline",
  PAYMENT: "card-outline",
  OTHER: "ellipsis-horizontal",
};

/**
 * Below this many points of width per unit of text size, two tiles side by
 * side would squeeze a Burmese label into a sliver — 320pt at 1.3× or 390pt
 * at 1.6× — so the grid becomes one tile per row.
 */
const TWO_COLUMN_MIN_WIDTH = 270;

/**
 * "Send feedback" — a category and a message, posted to POST /feedback.
 * Marquee: Feedback.dc.html — the category is a 2-column grid of icon tiles
 * ("Something else" spans both), then the message box with its live count.
 *
 * A bottom sheet rather than a pushed screen, because that is what this app
 * already uses for a short form you fill in and dismiss (the deposit and
 * withdraw sheets), and because feedback should never feel like leaving the
 * screen you wanted to complain about.
 */
export function FeedbackSheet({ visible, onClose }: Props) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const { width, fontScale } = useWindowDimensions();
  const submitFeedback = useSubmitFeedback();
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  // Exhaustive by construction: adding a category to FEEDBACK_CATEGORIES is a
  // compile error here until it has been given both of its labels.
  const categoryLabels: Record<FeedbackCategory, string> = {
    BUG: t.feedback.categories.bug,
    SUGGESTION: t.feedback.categories.suggestion,
    CONTENT: t.feedback.categories.content,
    PAYMENT: t.feedback.categories.payment,
    OTHER: t.feedback.categories.other,
  };

  const trimmed = message.trim();
  const canSubmit = category !== null && trimmed.length >= FEEDBACK_MESSAGE_MIN;
  const busy = submitFeedback.isPending;
  const twoColumns = width / fontScale >= TWO_COLUMN_MIN_WIDTH;

  const reset = () => {
    setCategory(null);
    setMessage("");
    setError(null);
    setSucceeded(false);
  };

  const handleClose = () => {
    onClose();
    // Wait for the sheet's own close animation before resetting, so the form
    // doesn't visibly snap back to defaults while still sliding away.
    setTimeout(reset, 250);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!category) {
      setError(t.feedback.categoryError);
      return;
    }
    if (trimmed.length < FEEDBACK_MESSAGE_MIN) {
      setError(t.feedback.messageError.replace("{min}", String(FEEDBACK_MESSAGE_MIN)));
      return;
    }

    try {
      await submitFeedback.mutateAsync({ category, message: trimmed });
      setSucceeded(true);
    } catch (err) {
      // The rate limit gets its own localized line: the server's 429 message
      // is written in English for logs and admins, not for this sheet.
      if (err instanceof ApiError && err.status === 429) {
        setError(t.feedback.rateLimited);
        return;
      }
      setError(err instanceof ApiError ? err.message : t.feedback.failure);
    }
  };

  // The title and subtitle scroll with the form (first child below) rather
  // than sitting in this fixed header, where long Burmese at a large text
  // size would grow the header and squeeze the form under it.
  const header = <SheetHeader onClose={handleClose} closeLabel={t.common.close} />;

  return (
    <BottomSheet visible={visible} onClose={handleClose} snapHeight={succeeded ? 460 : 740} header={header}>
      {succeeded ? (
        /* Centred while it fits; at large text sizes the tick, the two lines
           and Close outgrow the 460pt sheet, and it scrolls instead of
           pushing Close off the bottom edge (as ChangePasswordSheet does). */
        <ScrollView
          style={styles.successScroll}
          contentContainerStyle={styles.successPane}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >
          <SuccessPanel title={t.feedback.successTitle} body={t.feedback.successBody} />
          <ActionButton title={t.common.close} tone="play" onPress={handleClose} style={styles.successButton} />
        </ScrollView>
      ) : (
        <SheetForm
          actionStyle={accountActionBar}
          /* Pinned outside the scroll so the submit is never something you have
             to scroll to find, and floated above the keyboard by SheetForm so
             it stays reachable while the message field is focused. The error
             rides with the button rather than sitting in the form: the
             rate-limit line has to be readable from wherever the form happens
             to be scrolled. */
          action={
            <>
              {error ? <Notice message={error} /> : null}
              <ActionButton
                title={t.feedback.submit}
                icon="paper-plane-outline"
                onPress={handleSubmit}
                loading={busy}
                disabled={!canSubmit}
              />
            </>
          }
        >
          <SheetIntro title={t.feedback.sheetTitle} subtitle={t.feedback.sheetSubtitle} />

          <FieldCaption style={styles.categoryCaption}>{t.feedback.category}</FieldCaption>
          <View style={styles.categories} accessibilityRole="radiogroup" accessibilityLabel={t.feedback.category}>
            {FEEDBACK_CATEGORIES.map((value) => {
              const selected = category === value;
              const spansRow = !twoColumns || value === "OTHER";
              return (
                <Pressable
                  key={value}
                  onPress={() => {
                    setCategory(value);
                    setError(null);
                  }}
                  disabled={busy}
                  accessibilityRole="radio"
                  accessibilityLabel={categoryLabels[value]}
                  accessibilityState={{ checked: selected, disabled: busy }}
                  style={({ pressed }) => [
                    styles.tile,
                    spansRow ? styles.tileFull : styles.tileHalf,
                    selected ? styles.tileSelected : null,
                    busy && styles.tileBusy,
                    pressed && !busy && (reduceMotion ? styles.pressedStill : styles.pressed),
                  ]}
                >
                  <Ionicons
                    name={CATEGORY_ICONS[value]}
                    size={22}
                    color={selected ? theme.colors.text : theme.colors.textBody}
                  />
                  <ThemedText
                    variant="muted"
                    weight="bold"
                    color={selected ? theme.colors.text : theme.colors.textBody}
                    style={styles.tileLabel}
                  >
                    {categoryLabels[value]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <FieldCaption style={styles.messageCaption}>{t.feedback.message}</FieldCaption>
          <AccountTextArea
            value={message}
            onChangeText={setMessage}
            placeholder={t.feedback.messagePlaceholder}
            accessibilityLabel={t.feedback.message}
            maxLength={FEEDBACK_MESSAGE_MAX}
            editable={!busy}
            style={styles.messageBox}
          />
          <ThemedText variant="caption" tabular color={theme.colors.textFaint} style={styles.count}>
            {t.feedback.messageHint
              .replace("{n}", String(trimmed.length))
              .replace("{max}", String(FEEDBACK_MESSAGE_MAX))}
          </ThemedText>

          <View style={styles.privacyRow}>
            <Ionicons name="person-outline" size={14} color={theme.colors.textFaint} style={styles.privacyIcon} />
            <ThemedText variant="caption" color={theme.colors.textFaint} style={styles.privacyText}>
              {t.feedback.privacyNote}
            </ThemedText>
          </View>
        </SheetForm>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  successScroll: { flex: 1 },
  successPane: { flexGrow: 1, justifyContent: "center", paddingBottom: theme.spacing.sm },
  successButton: { marginTop: theme.spacing.xl },
  categoryCaption: { marginTop: theme.spacing.md },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: theme.colors.surfaceElevated,
  },
  /** Two per row: a basis just under half (the 10pt gap takes the rest), then grow to fill. */
  tileHalf: { flexBasis: "45%", flexGrow: 1 },
  tileFull: { flexBasis: "100%" },
  tileSelected: { borderColor: theme.colors.primary, backgroundColor: withAlpha(theme.colors.primary, 0.14) },
  tileBusy: { opacity: 0.6 },
  tileLabel: { flex: 1 },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.8 },
  messageCaption: { marginTop: theme.spacing.lg },
  messageBox: { marginTop: 10 },
  count: { marginTop: theme.spacing.sm, textAlign: "right" },
  privacyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 6,
    marginTop: theme.spacing.md,
  },
  privacyIcon: { marginTop: 2 },
  privacyText: { flexShrink: 1, textAlign: "center" },
});
