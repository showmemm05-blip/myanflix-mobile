import type { ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Chip } from "@/components/common/Chip";
import { MethodLogo } from "@/components/wallet/MethodLogo";
import { formatKyat } from "@/utils/currency";
import { tabularNums, theme } from "@/theme";

/**
 * The form vocabulary of the app's bottom-sheet forms — one set of labels,
 * fields, quick-amount chips, method tiles and helper/error lines, so every
 * sheet form looks and behaves identically. Purely presentational: every value
 * and handler is owned by the sheet that renders these.
 *
 * `QuickAmounts`, `MethodGrid` and `SheetInput`'s `numeric`/`suffix` modes are
 * money-specific and belong to the deposit/withdraw sheets; `FieldLabel`,
 * `HelperText`, `ErrorNotice` and `SheetSuccess` carry no money semantics and
 * are what the feedback sheet reuses, rather than growing a second, slightly
 * different set of form parts.
 */

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <ThemedText variant="label" style={styles.fieldLabel}>
      {children}
    </ThemedText>
  );
}

interface FieldProps extends TextInputProps {
  /** Renders the value with tabular figures at hero size (amount fields). */
  numeric?: boolean;
  /** Static trailing unit, e.g. "Ks". */
  suffix?: string;
}

/** The one text field of the money sheets — 52pt tall, themed, never white. */
export function SheetInput({ numeric, suffix, style, ...rest }: FieldProps) {
  return (
    <View style={styles.inputShell}>
      <TextInput
        placeholderTextColor={theme.colors.textFaint}
        {...rest}
        style={[styles.input, numeric && styles.inputNumeric, style]}
      />
      {suffix ? (
        <ThemedText variant="section" style={styles.suffix}>
          {suffix}
        </ThemedText>
      ) : null}
    </View>
  );
}

interface QuickAmountsProps {
  values: readonly number[];
  /** The current raw amount string — a chip lights up when it matches. */
  amount: string;
  onSelect: (value: number) => void;
}

/**
 * Preset top-up amounts — the shared `common/Chip`, so a money sheet's
 * selection reads exactly like a filter chip elsewhere in the app (quiet
 * elevated fill unselected, solid violet when picked). Each is a 44pt target.
 */
export function QuickAmounts({ values, amount, onSelect }: QuickAmountsProps) {
  return (
    <View style={styles.chipsRow}>
      {values.map((value) => (
        <Chip
          key={value}
          label={formatKyat(value)}
          selected={Number(amount) === value}
          onPress={() => onSelect(value)}
          style={styles.quickChip}
        />
      ))}
    </View>
  );
}

export interface MethodOption {
  key: string;
  label: string;
  logoUrl: string | null;
}

interface MethodGridProps {
  options: MethodOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

/**
 * Two-column payment-method picker. A tile is a chip with a logo, so it wears
 * the shared `common/Chip` selection language: elevated + hairline border when
 * idle, solid violet with near-black ink when picked.
 */
export function MethodGrid({ options, selectedKey, onSelect }: MethodGridProps) {
  return (
    <View style={styles.methodGrid}>
      {options.map((option) => {
        const active = selectedKey === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            style={({ pressed }) => [styles.methodTile, active && styles.methodTileActive, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
          >
            <MethodLogo logoUrl={option.logoUrl} size={30} />
            <ThemedText
              variant="caption"
              weight={active ? "bold" : "semibold"}
              numberOfLines={1}
              style={active ? styles.methodTextActive : styles.methodText}
            >
              {option.label}
            </ThemedText>
            {active ? (
              <View style={styles.methodCheck}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.onPrimary} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Quiet helper line under a field (limits, available balance, instructions). */
export function HelperText({ children }: { children: ReactNode }) {
  return (
    <ThemedText variant="caption" tabular style={styles.helper}>
      {children}
    </ThemedText>
  );
}

/** Validation / submission failure — the only red in the sheet. */
export function ErrorNotice({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
      <ThemedText variant="caption" weight="semibold" style={styles.errorText}>
        {message}
      </ThemedText>
    </View>
  );
}

/** Post-submit confirmation shown in place of the form. */
export function SheetSuccess({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.successBox}>
      <View style={styles.successHalo}>
        <Ionicons name="checkmark-circle" size={44} color={theme.colors.finance} />
      </View>
      <ThemedText variant="title" style={styles.center}>
        {title}
      </ThemedText>
      <ThemedText variant="muted" style={[styles.center, styles.successBody]}>
        {body}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { marginTop: theme.spacing.md, marginBottom: theme.spacing.xs },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    minHeight: 52,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    color: theme.colors.text,
    fontFamily: theme.font.regular,
    fontSize: 16,
  },
  inputNumeric: { ...tabularNums, fontFamily: theme.font.bold, fontSize: 22, letterSpacing: 0.2 },
  suffix: { color: theme.colors.textFaint },
  chipsRow: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  /** Four presets share the row, so the shared chip stretches instead of hugging. */
  quickChip: { flex: 1, alignSelf: "stretch", paddingHorizontal: 6 },
  methodGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  methodTile: {
    flexGrow: 1,
    flexBasis: "45%",
    minHeight: 84,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  methodTileActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  methodText: { color: theme.colors.textMuted },
  methodTextActive: { color: theme.colors.onPrimary },
  methodCheck: { position: "absolute", top: 6, right: 6 },
  helper: { color: theme.colors.textFaint, marginTop: 6 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm + 2,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: theme.colors.danger + "3D",
  },
  errorText: { flex: 1, color: theme.colors.danger },
  pressed: { opacity: 0.75 },
  successBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  successHalo: {
    width: 84,
    height: 84,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.financeSoft,
    borderWidth: 1,
    borderColor: theme.colors.finance + "33",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xs,
  },
  center: { textAlign: "center" },
  successBody: { maxWidth: 320 },
});
