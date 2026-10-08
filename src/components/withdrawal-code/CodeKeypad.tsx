import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressScale } from "@/components/wallet/PressScale";
import { CodeGlyph } from "@/components/withdrawal-code/CodeGlyph";
import { KEYPAD_MAX_WIDTH } from "@/components/withdrawal-code/useCodeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  onDigit: (digit: string) => void;
  onDelete: () => void;
  /** The digit keys are off: the code is full, refused until "Start over", locked, or being checked. */
  digitsDisabled?: boolean;
  deleteDisabled?: boolean;
  /** One key's height (useCodeLayout) — 72pt on the boards. */
  keyHeight: number;
  style?: StyleProp<ViewStyle>;
}

const ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "del"],
] as const;

/** The boards' keypad: 12pt between columns, 10pt between rows, radius 16. */
const COLUMN_GAP = 12;
const ROW_GAP = 10;
/**
 * The digits are the same in every language, and a 28pt figure in a 72pt key
 * has room for 1.3× but not for 2×: past that it would clip. The keys' spoken
 * labels are unaffected.
 */
const DIGIT_MAX_SCALE = 1.3;

/**
 * The in-app number pad of the withdrawal-code screens (CreateCode,
 * EnterCode, ForgotCode, ChangeCode): 1–9, a blank, 0 and delete. The code
 * never goes through the system keyboard, so no keyboard app, autofill or
 * clipboard history ever sees it. Each key is a button a screen reader names
 * ("5", "Delete last digit"); a disabled key fades to 40% and stops taking
 * taps.
 */
export function CodeKeypad({ onDigit, onDelete, digitsDisabled, deleteDisabled, keyHeight, style }: Props) {
  const { t } = useLanguage();
  return (
    <View style={[styles.pad, style]}>
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key, keyIndex) => {
            if (key === "") return <View key={keyIndex} style={[styles.key, { height: keyHeight }]} />;
            if (key === "del") {
              return (
                <PressScale
                  key={keyIndex}
                  onPress={onDelete}
                  disabled={deleteDisabled}
                  accessibilityRole="button"
                  accessibilityLabel={t.withdrawalCode.deleteDigit}
                  accessibilityState={{ disabled: !!deleteDisabled }}
                  style={[styles.key, styles.deleteKey, { height: keyHeight }, deleteDisabled && styles.off]}
                >
                  <CodeGlyph name="backspace" size={30} color={theme.colors.text} />
                </PressScale>
              );
            }
            return (
              <PressScale
                key={keyIndex}
                onPress={() => onDigit(key)}
                disabled={digitsDisabled}
                accessibilityRole="button"
                accessibilityLabel={key}
                accessibilityState={{ disabled: !!digitsDisabled }}
                style={[styles.key, styles.digitKey, { height: keyHeight }, digitsDisabled && styles.off]}
              >
                <ThemedText weight="bold" tabular maxFontSizeMultiplier={DIGIT_MAX_SCALE} style={styles.digit}>
                  {key}
                </ThemedText>
              </PressScale>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { gap: ROW_GAP, width: "100%", maxWidth: KEYPAD_MAX_WIDTH, alignSelf: "center" },
  row: { flexDirection: "row", gap: COLUMN_GAP },
  key: { flex: 1, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  digitKey: { backgroundColor: theme.colors.surfaceElevated },
  deleteKey: { backgroundColor: "transparent" },
  digit: { fontSize: 28, lineHeight: 34, color: theme.colors.text },
  off: { opacity: 0.4 },
});
