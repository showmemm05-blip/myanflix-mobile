import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";
import { useScrollIntoView } from "@/hooks/useKeyboardLift";

interface Props extends Omit<TextInputProps, "style" | "placeholderTextColor"> {
  /** Sits above the field — also the fallback a11y label for the reveal toggle. */
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Adds the eye toggle to a `secureTextEntry` field. Presentation only. */
  revealable?: boolean;
  /** Paints the ring in danger red while the form is reporting an error for this field. */
  invalid?: boolean;
  revealAccessibilityLabel?: string;
}

/**
 * The one text field used across the auth screens: a quiet label, a leading
 * glyph, a violet focus ring, and a 54pt row so the target always clears 44pt.
 * Every TextInput prop is forwarded untouched — the field adds no behaviour
 * beyond local focus/reveal styling.
 */
export function AuthField({
  label,
  icon,
  revealable,
  invalid,
  revealAccessibilityLabel,
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
      <ThemedText variant="label" color={focused ? theme.colors.primary : theme.colors.textMuted}>
        {label}
      </ThemedText>

      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          invalid && styles.fieldInvalid,
          !editable && styles.fieldDisabled,
        ]}
      >
        {icon && (
          <Ionicons name={icon} size={18} color={focused ? theme.colors.primary : theme.colors.textFaint} />
        )}

        <TextInput
          {...rest}
          editable={editable}
          secureTextEntry={secureTextEntry && !revealed}
          placeholderTextColor={theme.colors.textFaint}
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          style={styles.input}
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
            hitSlop={6}
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
  container: { gap: 6 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm + 2,
    minHeight: 54,
    paddingHorizontal: 14,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
  },
  fieldFocused: { borderColor: theme.colors.primary, backgroundColor: theme.colors.accent },
  fieldInvalid: { borderColor: theme.colors.danger + "8C" },
  fieldDisabled: { opacity: 0.6 },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: theme.colors.text,
    fontFamily: theme.font.regular,
    fontSize: 16,
  },
  toggle: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    marginRight: -10,
    alignItems: "center",
    justifyContent: "center",
  },
  togglePressed: { opacity: 0.6 },
});
