import { useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
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
}

/**
 * A single real TextInput (so SMS autofill, paste and the number pad all keep
 * working exactly as before) laid invisibly over a row of cells that mirror
 * its value. The cells are decoration — every keystroke still goes straight to
 * the caller's `onChangeText`.
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
}: Props) {
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <View style={styles.wrapper}>
      <View style={styles.cells} pointerEvents="none">
        {Array.from({ length }, (_, index) => {
          const char = value[index] ?? "";
          const isActive = focused && editable && index === activeIndex;
          return (
            <View
              key={index}
              style={[styles.cell, char !== "" && styles.cellFilled, isActive && styles.cellActive]}
            >
              <ThemedText variant="title" weight="bold" tabular>
                {char}
              </ThemedText>
            </View>
          );
        })}
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        maxLength={length}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        placeholder={placeholder}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        caretHidden
        placeholderTextColor="transparent"
        selectionColor="transparent"
        style={styles.input}
      />
    </View>
  );
}

const CELL_HEIGHT = 58;

const styles = StyleSheet.create({
  wrapper: { position: "relative" },
  cells: { flexDirection: "row", gap: theme.spacing.sm },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  cellFilled: { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.secondary },
  cellActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.accent },
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
