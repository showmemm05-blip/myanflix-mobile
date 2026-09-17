import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Chip } from "@/components/common/Chip";
import {
  ErrorNotice,
  FieldLabel,
  HelperText,
  SheetForm,
  SheetSuccess,
  SheetTextArea,
} from "@/components/wallet/SheetForm";
import { useSubmitFeedback } from "@/hooks/useFeedback";
import { useLanguage } from "@/localization/LanguageProvider";
import { ApiError } from "@/utils/errors";
import { theme } from "@/theme";
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

/**
 * "Send feedback" — a category and a message, posted to POST /feedback.
 *
 * A bottom sheet rather than a pushed screen, because that is what this app
 * already uses for a short form you fill in and dismiss (the deposit and
 * withdraw sheets), and because feedback should never feel like leaving the
 * screen you wanted to complain about.
 */
export function FeedbackSheet({ visible, onClose }: Props) {
  const { t } = useLanguage();
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

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      snapHeight={620}
      title={succeeded ? t.feedback.successTitle : t.feedback.sheetTitle}
      subtitle={succeeded ? undefined : t.feedback.sheetSubtitle}
      showClose
    >
      {succeeded ? (
        <View style={styles.successPane}>
          <SheetSuccess title={t.feedback.successTitle} body={t.feedback.successBody} />
          <Button title={t.common.close} onPress={handleClose} size="lg" style={styles.submitButton} />
        </View>
      ) : (
        <SheetForm
          /* Pinned outside the scroll so the submit is never something you have
             to scroll to find, and floated above the keyboard by SheetForm so
             it stays reachable while the message field is focused. The error
             rides with the button rather than sitting in the form: the
             rate-limit line has to be readable from wherever the form happens
             to be scrolled. */
          action={
            <>
              {error ? <ErrorNotice message={error} /> : null}
              <Button
                title={t.feedback.submit}
                onPress={handleSubmit}
                loading={submitFeedback.isPending}
                disabled={!canSubmit}
                size="lg"
                icon="paper-plane-outline"
                style={styles.actionButton}
              />
            </>
          }
        >
          <FieldLabel>{t.feedback.category}</FieldLabel>
          <View style={styles.categories}>
            {FEEDBACK_CATEGORIES.map((value) => (
              <Chip
                key={value}
                label={categoryLabels[value]}
                selected={category === value}
                onPress={() => {
                  setCategory(value);
                  setError(null);
                }}
              />
            ))}
          </View>

          <FieldLabel>{t.feedback.message}</FieldLabel>
          <SheetTextArea
            value={message}
            onChangeText={setMessage}
            placeholder={t.feedback.messagePlaceholder}
            accessibilityLabel={t.feedback.message}
            maxLength={FEEDBACK_MESSAGE_MAX}
          />
          <HelperText>
            {t.feedback.messageHint
              .replace("{n}", String(trimmed.length))
              .replace("{max}", String(FEEDBACK_MESSAGE_MAX))}
          </HelperText>

          <ThemedText variant="caption" style={styles.privacyNote}>
            {t.feedback.privacyNote}
          </ThemedText>
        </SheetForm>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  successPane: { flex: 1, justifyContent: "center" },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  submitButton: { marginTop: theme.spacing.lg, alignSelf: "stretch" },
  actionButton: { alignSelf: "stretch" },
  privacyNote: { color: theme.colors.textFaint, marginTop: theme.spacing.md, textAlign: "center" },
});
