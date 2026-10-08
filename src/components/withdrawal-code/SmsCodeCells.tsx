import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { CODE_LENGTH } from "@/components/withdrawal-code/codeRules";
import { theme } from "@/theme";

interface Props {
  value: string;
  /** The last check refused the code: every cell takes the danger ring until the next key. */
  invalid?: boolean;
  /** "3 of 6 digits entered" — what a screen reader hears for the row. */
  accessibilityLabel: string;
}

/** ForgotCode.dc.html: 56pt cells, radius 12, 8pt apart. */
const CELL_HEIGHT = 56;
/** A 24pt figure in a 56pt cell clips past this. */
const DIGIT_MAX_SCALE = 1.3;

/**
 * The SMS code's six cells on the forgot-code page, fed by the page's own
 * keypad (the board draws the same keypad under them). The look is the
 * sign-in code cells' (components/auth/OtpInput): #1C1C23 empty and a step
 * lighter once typed, extra-bold tabular digits, a 2pt crimson ring on the
 * cell the next digit lands in, and a danger ring while the code is refused.
 * The rings are drawn over the cell, so neither one moves the digit.
 */
export function SmsCodeCells({ value, invalid, accessibilityLabel }: Props) {
  const next = value.length;
  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.row}>
      {Array.from({ length: CODE_LENGTH }, (_, index) => {
        const char = value[index] ?? "";
        const ring = invalid ? styles.ringInvalid : index === next ? styles.ringNext : null;
        return (
          <View key={index} style={[styles.cell, char !== "" && styles.cellFilled]}>
            <ThemedText weight="extrabold" tabular maxFontSizeMultiplier={DIGIT_MAX_SCALE} style={styles.digit}>
              {char}
            </ThemedText>
            {ring ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ring, ring]} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: theme.spacing.sm, width: "100%" },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  cellFilled: { backgroundColor: theme.colors.tonal },
  digit: { fontSize: 24, lineHeight: 30 },
  ring: { borderRadius: theme.radius.lg },
  ringNext: { borderWidth: 2, borderColor: theme.colors.primary },
  ringInvalid: { borderWidth: 1.5, borderColor: theme.colors.danger },
});
