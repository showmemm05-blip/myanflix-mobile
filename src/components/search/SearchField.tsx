import { useCallback, useState, type RefObject } from "react";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { PressableScale } from "@/components/ui/PressableScale";
import { theme, withAlpha } from "@/theme";

/**
 * Taller than the 44pt minimum on purpose — this field is the screen's subject,
 * not one control in a toolbar, and it is FIXED rather than a minHeight so the
 * glyph → spinner swap can never nudge the row's height mid-keystroke.
 */
/*
 * Was 52. Brought down because the field and the tab strip together were
 * eating ~130pt before a single result — on a phone that is most of the space
 * above the fold. 46 still clears the 44pt touch minimum on its own, and the
 * 16pt input inside it has not changed size, so the row reads tighter rather
 * than smaller.
 */
const FIELD_HEIGHT = 46;
const IDLE_BORDER = theme.colors.border;
const FOCUS_BORDER = withAlpha(theme.colors.primary, 0.55);

interface Props {
  value: string;
  onChangeText: (next: string) => void;
  /**
   * Return key. The caller COMMITS the term — runs the search and records it —
   * because the grid below no longer follows the typing. The field blurs itself.
   */
  onSubmit: () => void;
  onClear: () => void;
  /**
   * True while the grid is genuinely fetching, i.e. after a commit. It is NOT
   * true while the user is merely typing — nothing is being fetched then, and
   * the suggestion panel's own skeleton rows, which sit directly under this
   * field, are the loading affordance for that half.
   */
  loading?: boolean;
  placeholder: string;
  accessibilityLabel: string;
  clearAccessibilityLabel: string;
  /** Lets the screen hand focus to the field, e.g. from a recent-search chip. */
  inputRef?: RefObject<TextInput | null>;
  /**
   * Focus, told to the caller as well as kept here. The suggestion panel hangs
   * off this field and has to know when it is live; the field's own look still
   * comes from its private `focused` state, so these are purely additional.
   */
  onFocus?: () => void;
  onBlur?: () => void;
  /**
   * The field's outer view, so a caller can measure where its bottom edge is
   * and hang something off it. Optional and unused by the field itself.
   */
  anchorRef?: RefObject<View | null>;
}

/**
 * The search screen's hero field.
 *
 * Focus is animated rather than styled off a `focused` boolean because the
 * resting and focused states have to read as obviously different: the border
 * warms to violet and a second ring fades in just outside it. The ring is a
 * sibling view, not a shadow — a coloured shadow renders on iOS and is
 * silently dropped on Android, and this state has to be visible on both.
 */
export function SearchField({
  value,
  onChangeText,
  onSubmit,
  onClear,
  loading,
  placeholder,
  accessibilityLabel,
  clearAccessibilityLabel,
  inputRef,
  onFocus,
  onBlur,
  anchorRef,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);

  const driveFocus = useCallback(
    (next: number) => {
      // Reduced motion still gets the state change, it just arrives instantly
      // instead of travelling — proving the animation was never scheduled.
      focus.value = reduceMotion ? next : withTiming(next, { duration: next === 1 ? 180 : 220 });
    },
    [focus, reduceMotion],
  );

  const fieldStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [IDLE_BORDER, FOCUS_BORDER]),
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: focus.value }));

  // A field holding a term is "live" even once it loses focus, so the glyph
  // stays violet — the tint is about the search being active, not the caret.
  const live = focused || value.length > 0;

  return (
    <View ref={anchorRef} style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />

      <Animated.View style={[styles.field, fieldStyle]}>
        {/* Fixed box: the icon → spinner swap must not reflow the input. */}
        <View style={styles.glyph}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Ionicons name="search" size={20} color={live ? theme.colors.primary : theme.colors.textFaint} />
          )}
        </View>

        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textFaint}
          accessibilityLabel={accessibilityLabel}
          returnKeyType="search"
          // The return key IS the search: the grid below re-queries on this and
          // on nothing else — never on a keystroke — so `onSubmit` has to fire
          // as well as blur. "blurAndSubmit" does both, in that order.
          submitBehavior="blurAndSubmit"
          onSubmitEditing={onSubmit}
          // Android capitalises the first letter by default, which turns a
          // lowercase title search into a mismatched term on screen.
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          // iOS draws its own clear affordance otherwise, next to ours.
          clearButtonMode="never"
          underlineColorAndroid="transparent"
          onFocus={() => {
            setFocused(true);
            driveFocus(1);
            onFocus?.();
          }}
          onBlur={() => {
            setFocused(false);
            driveFocus(0);
            onBlur?.();
          }}
        />

        {/* Mounted for as long as there is anything to clear — deliberately
            never gated on `loading`, which is true at exactly the moment a
            user wants to abandon a search. */}
        {value.length > 0 ? (
          <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)}>
            <PressableScale
              onPress={onClear}
              style={styles.clear}
              hitSlop={8}
              accessibilityLabel={clearAccessibilityLabel}
            >
              <Ionicons name="close" size={16} color={theme.colors.textMuted} />
            </PressableScale>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  /** Sits just outside the field's own border, so the two never overlap. */
  glow: {
    position: "absolute",
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.primary, 0.28),
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    height: FIELD_HEIGHT,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: IDLE_BORDER,
    backgroundColor: theme.colors.surfaceElevated,
    paddingLeft: theme.spacing.md,
    paddingRight: theme.spacing.xs + 2,
    ...theme.shadow.sm,
  },
  glyph: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    fontFamily: theme.font.regular,
    // FIELD_HEIGHT owns the height; vertical padding here would fight it.
    paddingVertical: 0,
  },
  clear: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(theme.colors.text, 0.08),
  },
});
