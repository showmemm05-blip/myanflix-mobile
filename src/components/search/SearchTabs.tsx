import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Type-only here, but
// the rule is the same. Don't "tidy" it back.
import type Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { GlassFace } from "@/components/layout/GlassFace";
import { theme } from "@/theme";

export interface SearchTabOption {
  value: string;
  label: string;
  /** Kept for callers that still pass one; the Marquee pills draw no glyph. */
  icon?: keyof typeof Ionicons.glyphMap;
}

interface Props {
  options: readonly SearchTabOption[];
  value: string;
  onChange: (value: string) => void;
}

/** The visible pill; the Pressable around it keeps the full 44pt target. */
const PILL_HEIGHT = 36;

/**
 * The search screen's scope pills: the selected tab is a solid white pill
 * with near-black ink (the top bar's `selected` chip); the others are Liquid
 * Glass pills with white ink (GlassFace — the owner, 2026-11-10: "do the same
 * glass for search page filters"). Pressed, a pill shrinks to 96%; under
 * Reduce Motion the glass lights up instead (it never dims: an iOS blur under
 * alpha < 1 renders broken). One
 * sideways rail, so five tabs (and a long Burmese label) scroll instead of
 * ever being shrunk or cut.
 *
 * Memoized: nothing in it can change while the user types, and with stable
 * `options`/`onChange` from the screen a keystroke does not reach it.
 */
export const SearchTabs = memo(function SearchTabs({ options, value, onChange }: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [styles.target, pressed && !reduceMotion && styles.pressed]}
          >
            {({ pressed }) => (
              <View style={[styles.pill, active && styles.pillActive]}>
                {active ? null : <GlassFace radius={PILL_HEIGHT / 2} pressed={reduceMotion && pressed} />}
                <ThemedText
                  variant="muted"
                  weight={active ? "extrabold" : "semibold"}
                  numberOfLines={1}
                  color={active ? theme.colors.onPlay : theme.colors.text}
                >
                  {option.label}
                </ThemedText>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  row: { gap: theme.spacing.sm, paddingHorizontal: theme.layout.screenPadding },
  target: { minHeight: theme.layout.minTouch, justifyContent: "center" },
  /** A minimum, so 2× text grows the pill rather than clipping the label. */
  pill: {
    minHeight: PILL_HEIGHT,
    paddingHorizontal: theme.spacing.md,
    borderRadius: PILL_HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: { backgroundColor: theme.colors.play },
  pressed: { transform: [{ scale: 0.96 }] },
});
