import { useCallback, useState, type RefObject } from "react";
import { StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
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
import { BusyDots } from "@/components/ui/BusyDots";
import { PressableScale } from "@/components/ui/PressableScale";
import { theme, withAlpha } from "@/theme";

/**
 * Marquee's field: 56pt, radius 16, the raised #1C1C23 fill, a 22pt glyph and
 * 17pt text. FIXED rather than a minHeight so the glyph → busy-dots swap can
 * never nudge the row's height mid-keystroke.
 */
const FIELD_HEIGHT = 56;
const FIELD_RADIUS = 16;
/** The default field's 17pt text; the soft (wallet History) field draws 16pt. */
const INPUT_SIZE = 17;
const SOFT_INPUT_SIZE = 16;
/**
 * Focus ring width — a 2pt WHITE edge, drawn as the field's own border. The
 * boards draw a search field's focus in white (SearchTyping.dc.html,
 * Actors.dc.html); crimson rings belong to form fields (sign-in, sheets).
 */
const RING = 2;
/**
 * Noto Sans Myanmar's natural line is 2.184em (hhea ascent 1324 + descent 860
 * per 1000) — read from the bundled TTF. The field grows past 56pt once the
 * OS text size makes that line taller than the field, so stacked Burmese
 * marks are never clipped; it is still a FIXED height for any one text size.
 */
const MYANMAR_LINE_EM = 2.2;
/** Fully transparent white rather than "transparent" (black at 0), so the focus fade never passes through a dark tint. */
const IDLE_RING = withAlpha(theme.colors.text, 0);
const FOCUS_RING = theme.colors.text;
/** Three 4pt dots, 3pt apart: 18pt, inside the glyph's 22pt box. */
const BUSY_DOT = 4;
const BUSY_GAP = 3;

interface Props {
  value: string;
  onChangeText: (next: string) => void;
  /**
   * Return key. What a commit means is the caller's business (Search runs the
   * query and records the term; a list that filters as you type may just put
   * the keyboard away). The field blurs itself.
   */
  onSubmit: () => void;
  onClear: () => void;
  /**
   * True while the caller is genuinely fetching for a committed term — swaps
   * the glyph for three pulsing dots (Marquee: never a spinner). Leave it
   * false while the user is merely typing.
   */
  loading?: boolean;
  placeholder: string;
  accessibilityLabel: string;
  clearAccessibilityLabel: string;
  /** Lets the screen hand focus to the field, e.g. from a recent-search chip. */
  inputRef?: RefObject<TextInput | null>;
  /**
   * Focus, told to the caller as well as kept here (e.g. a suggestion panel
   * that hangs off the field and has to know when it is live); the field's own
   * look still comes from its private `focused` state.
   */
  onFocus?: () => void;
  onBlur?: () => void;
  /**
   * The field's outer view, so a caller can measure where its bottom edge is
   * and hang something off it. Optional and unused by the field itself.
   */
  anchorRef?: RefObject<View | null>;
  /**
   * "default" = the Search hero field (17pt text).
   * "soft" = the wallet History's filter box (16pt text). Marquee draws both
   * as the same flat 56pt field; focus shows as a 2pt white ring on either.
   */
  tone?: "default" | "soft";
  /** Takes the caret (and the keyboard) as soon as it mounts — the search screen opens ready to type. */
  autoFocus?: boolean;
}

/**
 * The app's search field — the Search screen's hero field and the wallet
 * History's filter box. Domain-free: every string arrives through props.
 *
 * Focus is animated rather than styled off a `focused` boolean so the ring
 * fades in instead of snapping (instantly under reduce motion). The ring is
 * the field's own 2pt border — present at rest in a transparent white — so
 * focusing never shifts the content by a pixel, and it renders the same on iOS
 * and Android (a coloured shadow would be dropped on Android).
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
  tone = "default",
  autoFocus,
}: Props) {
  const soft = tone === "soft";
  const inputSize = soft ? SOFT_INPUT_SIZE : INPUT_SIZE;
  const { fontScale } = useWindowDimensions();
  const height = Math.max(FIELD_HEIGHT, Math.ceil(inputSize * fontScale * MYANMAR_LINE_EM));
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
    borderColor: interpolateColor(focus.value, [0, 1], [IDLE_RING, FOCUS_RING]),
  }));

  // A field holding a term is "live" even once it loses focus, so the glyph
  // goes white — the tint is about the search being active, not the caret.
  const live = focused || value.length > 0;

  return (
    <View ref={anchorRef} style={styles.wrap}>
      <Animated.View style={[styles.field, { height }, fieldStyle]}>
        {/* Fixed box: the icon → dots swap must not reflow the input. */}
        <View style={styles.glyph}>
          {loading ? (
            <BusyDots color={theme.colors.textMuted} size={BUSY_DOT} gap={BUSY_GAP} />
          ) : (
            <Ionicons name="search" size={22} color={live ? theme.colors.text : theme.colors.textMuted} />
          )}
        </View>

        <TextInput
          ref={inputRef}
          autoFocus={autoFocus}
          style={[styles.input, { fontSize: inputSize }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textFaint}
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          accessibilityLabel={accessibilityLabel}
          returnKeyType="search"
          // The return key commits: `onSubmit` has to fire as well as blur.
          // "blurAndSubmit" does both, in that order.
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
              <View style={styles.clearDisc}>
                <Ionicons name="close" size={13} color={theme.colors.text} />
              </View>
            </PressableScale>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: FIELD_RADIUS,
    borderWidth: RING,
    borderColor: IDLE_RING,
    backgroundColor: theme.colors.surfaceElevated,
    // 18pt to the glyph as drawn, less the ring that sits inside the edge.
    paddingLeft: 18 - RING,
    paddingRight: 6 - RING,
  },
  glyph: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.font.regular,
    // The field owns the height; vertical padding here would fight it.
    paddingVertical: 0,
  },
  /** A 44pt target around the design's 24pt clear disc. */
  clear: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  clearDisc: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.tonalStrong,
  },
});
