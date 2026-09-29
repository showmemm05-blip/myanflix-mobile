import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

export interface SearchTabOption {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface Props {
  options: readonly SearchTabOption[];
  value: string;
  onChange: (value: string) => void;
}

/** Shorter than the 44pt rung on purpose — the strip shares the header with the field; hitSlop restores the target. */
const TAB_HEIGHT = 40;
const TAB_HIT_SLOP = { top: 2, bottom: 2, left: 0, right: 0 };
const UNDERLINE = 2.5;

/**
 * The Media screen's tab strip — icon + label with a violet underline under
 * the active one, the owner's mock-up, in place of the pill segments
 * SegmentedControl draws everywhere else (that control stays as it is for its
 * other eight screens).
 *
 * The tabs grow to share the width when they fit, and the strip scrolls when
 * they do not — a label is never shrunk. There are five (All, Movies, Series,
 * Books, Music), which fit a phone in English; a longer language can still
 * push Music past the right edge, and then the strip scrolls.
 *
 * Memoized for the same reason the segment strip it replaces was: nothing in
 * it can change while the user types, and with stable `options`/`onChange`
 * from the screen a keystroke does not reach it.
 */
export const SearchTabs = memo(function SearchTabs({ options, value, onChange }: Props) {
  return (
    <View style={styles.strip}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map((option) => {
          const active = option.value === value;
          const color = active ? theme.colors.primary : theme.colors.textMuted;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              hitSlop={TAB_HIT_SLOP}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              style={styles.tab}
            >
              <View style={styles.tabContent}>
                <Ionicons name={option.icon} size={16} color={color} />
                <ThemedText variant="label" weight={active ? "bold" : "semibold"} numberOfLines={1} style={{ color }}>
                  {option.label}
                </ThemedText>
              </View>
              <View style={[styles.underline, active && styles.underlineActive]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  /** The hairline the underline sits on — one rule across the full width, tabs or not. */
  strip: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  row: { flexGrow: 1, paddingHorizontal: theme.spacing.sm },
  tab: {
    flexGrow: 1,
    height: TAB_HEIGHT,
    paddingHorizontal: theme.spacing.md - 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tabContent: { flexDirection: "row", alignItems: "center", gap: 6 },
  underline: {
    position: "absolute",
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    bottom: 0,
    height: UNDERLINE,
    borderTopLeftRadius: UNDERLINE,
    borderTopRightRadius: UNDERLINE,
    backgroundColor: "transparent",
  },
  underlineActive: { backgroundColor: theme.colors.primary },
});
