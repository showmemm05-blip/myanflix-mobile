import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { AuthLabel } from "@/components/auth/AuthParts";
import { theme, tabularNums } from "@/theme";
import { useScrollIntoView } from "@/hooks/useKeyboardLift";

interface Props extends Omit<TextInputProps, "style" | "placeholderTextColor"> {
  /** Sits above the field — also the fallback a11y label for the reveal toggle. */
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Adds the eye toggle to a `secureTextEntry` field. Presentation only. */
  revealable?: boolean;
  /** Paints the danger ring while the form is reporting an error about this field. */
  invalid?: boolean;
  revealAccessibilityLabel?: string;
  /** Tabular figures with a little tracking — the phone number field. */
  numeric?: boolean;
}

/**
 * The one text field across the auth screens (Login.dc.html): a 13pt bold
 * label, then a 56pt borderless #1C1C23 well with a leading glyph, a crimson
 * 1.5pt ring on focus and a danger ring while invalid. minHeight, so the
 * well grows with the OS text size instead of clipping. Every TextInput prop
 * is forwarded untouched — the field adds no behaviour beyond local
 * focus/reveal styling.
 */
export function AuthField({
  label,
  icon,
  revealable,
  invalid,
  revealAccessibilityLabel,
  numeric,
  secureTextEntry,
  editable = true,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const scrollIntoView = useScrollIntoView();
  const showToggle = !!revealable && !!secureTextEntry;

  return (
    <View style={styles.container}>
      <AuthLabel>{label}</AuthLabel>

      <View
        style={[
          styles.field,
          showToggle && styles.fieldWithToggle,
          // Invalid wins over focus: the ring that explains the error stays
          // while the user corrects it.
          invalid ? styles.fieldInvalid : focused ? styles.fieldFocused : null,
          !editable && styles.fieldDisabled,
        ]}
      >
        {icon && <Ionicons name={icon} size={20} color={theme.colors.textFaint} />}

        <TextInput
          {...rest}
          editable={editable}
          secureTextEntry={secureTextEntry && !revealed}
          placeholderTextColor={theme.colors.textFaint}
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          style={[styles.input, numeric && styles.inputNumeric]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
            // Focus moving between fields under an ALREADY open keyboard
            // fires no keyboard event, so the field asks for itself. A beat
            // later, so the focus ring and any step layout have settled.
            setTimeout(scrollIntoView, 80);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />

        {showToggle && (
          <Pressable
            onPress={() => setRevealed((value) => !value)}
            style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
            accessibilityRole="button"
            accessibilityLabel={revealAccessibilityLabel ?? label}
            accessibilityState={{ selected: revealed }}
          >
            <Ionicons
              name={revealed ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={theme.colors.textMuted}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    minHeight: 56,
    paddingLeft: 17,
    paddingRight: theme.spacing.md,
    borderRadius: 16,
    // Always 1.5pt, transparent at rest, so the ring never shifts the text.
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: theme.colors.surfaceElevated,
  },
  /** The 44pt eye sits 6pt in from the right edge. */
  fieldWithToggle: { paddingRight: 6 },
  fieldFocused: { borderColor: theme.colors.primary },
  fieldInvalid: { borderColor: theme.colors.danger },
  fieldDisabled: { opacity: 0.6 },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: theme.colors.text,
    fontFamily: theme.font.regular,
    fontSize: 17,
  },
  inputNumeric: { ...tabularNums, letterSpacing: 0.34 },
  toggle: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  togglePressed: { opacity: 0.6 },
});
