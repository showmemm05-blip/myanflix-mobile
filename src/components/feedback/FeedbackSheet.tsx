import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Chip } from "@/components/common/Chip";
import { ErrorNotice, FieldLabel, HelperText, SheetSuccess } from "@/components/wallet/SheetForm";
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
        // The sheet lives in a Modal, which never resizes for the keyboard —
        // without this the message field is typed into blind behind it.
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
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
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={t.feedback.messagePlaceholder}
              placeholderTextColor={theme.colors.textFaint}
              accessibilityLabel={t.feedback.message}
              multiline
              maxLength={FEEDBACK_MESSAGE_MAX}
              // Android centres multiline text vertically without this.
              textAlignVertical="top"
              style={styles.input}
            />
            <HelperText>
              {t.feedback.messageHint
                .replace("{n}", String(trimmed.length))
                .replace("{max}", String(FEEDBACK_MESSAGE_MAX))}
            </HelperText>

            {error ? <ErrorNotice message={error} /> : null}

            {/* Kept in the scroll flow (not pinned): the sheet renders in a
                Modal, which doesn't resize for the keyboard — a pinned footer
                would sit behind it while the message field is focused. */}
            <Button
              title={t.feedback.submit}
              onPress={handleSubmit}
              loading={submitFeedback.isPending}
              disabled={!canSubmit}
              size="lg"
              icon="paper-plane-outline"
              style={styles.submitButton}
            />

            <ThemedText variant="caption" style={styles.privacyNote}>
              {t.feedback.privacyNote}
            </ThemedText>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { paddingBottom: theme.spacing.lg },
  successPane: { flex: 1, justifyContent: "center" },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  input: {
    minHeight: 132,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    color: theme.colors.text,
    fontFamily: theme.font.regular,
    fontSize: 15,
    lineHeight: 21,
  },
  submitButton: { marginTop: theme.spacing.lg, alignSelf: "stretch" },
  privacyNote: { color: theme.colors.textFaint, marginTop: theme.spacing.md, textAlign: "center" },
});
