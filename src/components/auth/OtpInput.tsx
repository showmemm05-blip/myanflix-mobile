import { useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { AuthLabel } from "@/components/auth/AuthParts";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  /** Number of cells — the caller's `maxLength` too. */
  length?: number;
  editable?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  autoComplete?: TextInputProps["autoComplete"];
  placeholder?: string;
  accessibilityLabel?: string;
  onSubmitEditing?: () => void;
  /** A visible label over the cells (the reset screen). Sign-in keeps it spoken only. */
  label?: string;
  /** The form is reporting an error about the code: the typed cells take the danger ring. */
  invalid?: boolean;
  /**
   * Changes with every error report (the screen's failure object), so a new
   * report about an edited code rings the cells again even though `invalid`
   * itself stayed true.
   */
  invalidKey?: unknown;
}

/**
 * A single real TextInput (so SMS autofill, paste and the number pad all keep
 * working exactly as before) laid invisibly over a row of cells that mirror
 * its value. The cells are decoration — every keystroke still goes straight to
 * the caller's `onChangeText`.
 *
 * Marquee cells (LoginCode.dc.html): 60pt, radius 12, #1C1C23 empty and a
 * step lighter once typed, 26pt extra-bold tabular digits, a 2pt crimson ring
 * on the cell the next digit lands in, and a danger ring on the typed cells
 * while the code is wrong (until the user edits it).
 */
export function OtpInput({
  value,
  onChangeText,
  length = 6,
  editable = true,
  keyboardType,
  autoComplete,
  placeholder,
  accessibilityLabel,
  onSubmitEditing,
  label,
  invalid,
  invalidKey,
}: Props) {
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, length - 1);
  const complete = value.length >= length;

  // The error is about the code as it was when it was reported. Once the user
  // edits it, the rings go back to normal (no danger ring on fresh digits, and
  // the crimson ring shows where the next digit lands again); the message
  // under the cells stays until the next submit, as before. Presentation
  // only: the caller's error state is untouched.
  const report = invalid ? (invalidKey ?? true) : null;
  const [flagged, setFlagged] = useState<{ report: unknown; value: string } | null>(() =>
    report === null ? null : { report, value },
  );
  if ((flagged?.report ?? null) !== report) {
    setFlagged(report === null ? null : { report, value });
  }
  const showInvalid = report !== null && flagged?.report === report && flagged.value === value;

  return (
    <View style={styles.container}>
      {label ? <AuthLabel>{label}</AuthLabel> : null}
      <View style={styles.wrapper}>
        <View style={[styles.cells, !editable && styles.cellsBusy]} pointerEvents="none">
          {Array.from({ length }, (_, index) => {
            const char = value[index] ?? "";
            const isActive = focused && editable && !showInvalid && !complete && index === activeIndex;
            return (
              <View
                key={index}
                style={[
                  styles.cell,
                  char !== "" && styles.cellFilled,
                  showInvalid && char !== "" ? styles.cellInvalid : isActive ? styles.cellActive : null,
                ]}
              >
                {/* Decoration only (the input is what a screen reader reads), so
                    it may stop growing before a 60pt cell would clip it. */}
                <ThemedText weight="extrabold" tabular maxFontSizeMultiplier={1.3} style={styles.digit}>
                  {char}
                </ThemedText>
              </View>
            );
          })}
        </View>

        <TextInput
          value={value}
          // The SMS shows "MyanFlix: 482 913": keep only the digits of what is
          // typed or pasted, so a pasted "482 913" (or the whole message) works.
          onChangeText={(text) => onChangeText(text.replace(/\D/g, "").slice(0, length))}
          editable={editable}
          maxLength={length + 16}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          placeholder={placeholder}
          accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          caretHidden
          placeholderTextColor="transparent"
          selectionColor="transparent"
          style={styles.input}
        />
      </View>
    </View>
  );
}

const CELL_HEIGHT = 60;

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm },
  wrapper: { position: "relative" },
  cells: { flexDirection: "row", gap: theme.spacing.sm },
  cellsBusy: { opacity: 0.6 },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
    borderRadius: theme.radius.lg,
    // Always 2pt, transparent at rest, so a ring never moves the digit.
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  cellFilled: { backgroundColor: theme.colors.tonal },
  cellActive: { borderColor: theme.colors.primary },
  cellInvalid: { borderColor: theme.colors.danger },
  digit: { fontSize: 26, lineHeight: 32 },
  /**
   * Invisible but fully interactive: transparent text/caret rather than
   * `opacity: 0`, which some Android builds refuse to focus.
   */
  input: {
    ...StyleSheet.absoluteFill,
    height: CELL_HEIGHT,
    color: "transparent",
    backgroundColor: "transparent",
    fontSize: 1,
    textAlign: "center",
  },
});
