import { memo, useEffect, useState, type Ref } from "react";
import { StyleSheet, TextInput, View, type StyleProp, type TextInputInstance, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { LtText } from "@/lottery/components/LtText";
import { LtHelp, type LtHelpKind } from "@/lottery/components/Surfaces";
import {
  cleanDigits,
  DIGIT_CELLS,
  useAnnounceDigits,
  useCaretBlink,
  useDigitPop,
  useLandedDigits,
} from "@/lottery/components/numberEntry";
import { DIGIT_WORDS, spaced } from "@/lottery/data/format";
import { useLtFace } from "@/lottery/theme/fonts";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";

export type NumberWindowState = "empty" | "typing" | "complete" | "warn" | "error" | "disabled" | "loading";

export interface NumberWindowProps {
  /** The digits so far, as a string ("372", "004821"); never more than six. */
  value: string;
  /**
   * Makes it an INPUT. Gets the cleaned digits (`replace(/\D/g, "").slice(0, 6)`)
   * and whether anything that was not a digit was dropped (a pasted "No.",
   * a typed letter) — the caller's cue for the "Only the digits 0 to 9 are
   * kept." help line. Without it, the window only DISPLAYS `value`.
   */
  onChange?: (digits: string, info: { dropped: boolean }) => void;
  /** Overrides the border state worked out from `value` (empty / typing / complete). */
  state?: NumberWindowState;
  onFocusChange?: (focused: boolean) => void;
  /** The spelled digits under the cells (ZER … NIN), as on the ticket. */
  words?: boolean;
  /** Change it to pop all six digits (45ms apart) at once. */
  popKey?: number;
  /** The label above ("Your six-digit number"). */
  label?: string;
  /** The help / validation line under the window; its text is also spoken after each change. */
  help?: { kind: LtHelpKind; text: string; spoken?: string };
  /**
   * The keyboard's Return / Enter. Given, the window keeps its focus on
   * Return, so the keyboard stays up for the next number; the caller
   * dismisses it when Return has nothing to do.
   */
  onSubmitEditing?: () => void;
  /** What is read when the window empties, instead of "No digits yet." — "" reads nothing. */
  emptySpoken?: string;
  inputRef?: Ref<TextInputInstance>;
  /** The spoken name; defaults to the label, then "Your six-digit number". */
  accessibilityLabel?: string;
  /**
   * Display only: "gold" is a WINNING number in the window's shape (Home's
   * latest result, board `.lt-lr__win`) — gold strip, gold edge, a gold-line
   * frame; with no digits, the dashed empty window (no frame, no dividers).
   * Gold is for winning only, so an input is never gold.
   */
  tone?: "paper" | "gold";
  style?: StyleProp<ViewStyle>;
}

const E = COMPONENT_COPY.entry;

/**
 * THE TICKET NUMBER WINDOW (lt-base 6.7, owner option A, 14 Oct 2026): one
 * cream strip of six equal cells with hairline dividers and a printed frame
 * 3pt outside it — drawn like the number window printed on the ticket. Check
 * my tickets types in it; Home's latest result shows the winning number in it
 * (gold). Draw types on the ticket itself since 22 Oct 2026
 * (ticket/TicketInput), which shares this window's pop, caret and spoken line
 * (numberEntry.ts).
 *
 * Input mode: ONE real TextInput lies over the strip — it is what a finger, a
 * paste and a screen reader reach — with its own text, caret and selection
 * made transparent so only the drawn cells show. It stays fully opaque on
 * purpose: iOS never hit-tests a view under 1% opacity, so an `opacity: 0`
 * input could not be tapped there. Digits only, the first six kept, leading
 * zeros kept (a string); paste "No. 004-821" fills all six.
 *
 * The current cell (only while focused) is white with a blinking indigo caret
 * (steady under reduced motion) and an indigo bar. A landing digit pops; the
 * strip, its border, the frame and the dividers never move. Each change is
 * read out digit by digit: "Your number: 3 7 2. 3 of 6 digits."
 */
export const NumberWindow = memo(function NumberWindow({
  value,
  onChange,
  state,
  onFocusChange,
  words = false,
  popKey,
  label,
  help,
  onSubmitEditing,
  emptySpoken,
  inputRef,
  accessibilityLabel,
  tone = "paper",
  style,
}: NumberWindowProps) {
  const reduceMotion = useReducedMotion();
  const face = useLtFace();
  const interactive = !!onChange && tone !== "gold";
  const gold = tone === "gold";
  const [focused, setFocused] = useState(false);
  const digits = value.slice(0, 6);
  const resolved: NumberWindowState =
    state ?? (digits.length === 0 ? "empty" : digits.length < 6 ? "typing" : "complete");
  const disabled = resolved === "disabled";
  const loading = resolved === "loading";
  /** The gold window with nothing drawn yet: dashed, no frame, no dividers. */
  const goldEmpty = gold && digits.length === 0;
  const showFocus = interactive && focused && !disabled && !loading;
  const nextIndex = showFocus && digits.length < 6 ? digits.length : -1;

  const { before, landedFrom } = useLandedDigits(digits);
  // Speak each change — never on mount. The help line is the caller's, for this same value.
  useAnnounceDigits({ digits, enabled: interactive, help, emptySpoken });

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (loading && !reduceMotion) {
      pulse.value = withRepeat(withTiming(0.55, { duration: 1200 }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = 1;
    }
  }, [loading, reduceMotion, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const borderColor =
    resolved === "complete"
      ? LT.indigo
      : resolved === "warn"
        ? LT.warn
        : resolved === "error"
          ? LT.err
          : resolved === "disabled"
            ? LT.line
            : resolved === "loading"
              ? LT.mist
              : LT.field;
  const spokenName = accessibilityLabel ?? label ?? E.label;

  return (
    <View style={style}>
      {label ? (
        <LtText role="metaB" color={LT.ink2} style={styles.label} accessible={false} importantForAccessibility="no">
          {label}
        </LtText>
      ) : null}

      <View
        style={styles.windowBox}
        accessible={!interactive}
        accessibilityRole={interactive ? undefined : "text"}
        accessibilityLabel={interactive ? undefined : E.windowA11y(spokenName, digits)}
      >
        {/* The printed frame, 3pt outside the strip; focus turns it into a 2pt indigo ring at the same place. */}
        {goldEmpty ? null : (
          <View
            pointerEvents="none"
            style={[
              styles.frame,
              gold ? styles.frameGold : null,
              showFocus ? styles.frameFocus : null,
              loading ? styles.frameLoading : null,
            ]}
          />
        )}
        <Animated.View
          style={[
            styles.strip,
            { borderColor },
            gold && styles.stripGold,
            goldEmpty && styles.stripGoldEmpty,
            (disabled || loading) && styles.stripMist,
            loading && pulseStyle,
          ]}
        >
          {DIGIT_CELLS.map((i) => (
            <Cell
              key={i}
              index={i}
              char={digits.charAt(i)}
              next={i === nextIndex}
              hideMarks={loading}
              disabled={disabled}
              interactive={interactive}
              before={before}
              landedFrom={landedFrom}
              popKey={popKey}
              reduceMotion={reduceMotion}
              fontFamily={face("literata700")}
            />
          ))}
          {/* Hairline dividers, painted over the cells and under the input. */}
          {loading || goldEmpty
            ? null
            : [1, 2, 3, 4, 5].map((k) => (
                <View
                  key={k}
                  pointerEvents="none"
                  style={[styles.divider, gold && styles.dividerGold, { left: `${(k / 6) * 100}%` }]}
                />
              ))}
          {interactive ? (
            <TextInput
              ref={inputRef}
              value={digits}
              onChangeText={(raw) => onChange?.(cleanDigits(raw), { dropped: /\D/.test(raw) })}
              onFocus={() => {
                setFocused(true);
                onFocusChange?.(true);
              }}
              onBlur={() => {
                setFocused(false);
                onFocusChange?.(false);
              }}
              editable={!disabled && !loading}
              keyboardType="number-pad"
              onSubmitEditing={onSubmitEditing}
              submitBehavior={onSubmitEditing ? "submit" : undefined}
              maxLength={20}
              contextMenuHidden={false}
              caretHidden
              selectionColor="transparent"
              underlineColorAndroid="transparent"
              autoComplete="off"
              autoCorrect={false}
              importantForAutofill="no"
              allowFontScaling={false}
              accessibilityLabel={spokenName}
              accessibilityValue={{ text: digits ? spaced(digits) : E.emptyValue }}
              accessibilityHint={help ? (help.spoken ?? help.text) : undefined}
              accessibilityState={{ disabled: disabled || loading }}
              style={styles.input}
            />
          ) : null}
        </Animated.View>
      </View>

      {words ? (
        <View style={styles.words} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {DIGIT_CELLS.map((i) => {
            const d = digits.charAt(i);
            return (
              <LtText
                key={i}
                role="microB"
                color={LT.ink2}
                style={[styles.word, { fontFamily: face("courier700") }]}
                maxFontSizeMultiplier={1.2}
              >
                {d ? DIGIT_WORDS[Number(d)] : " "}
              </LtText>
            );
          })}
        </View>
      ) : null}

      {help ? (
        <LtHelp kind={help.kind} text={help.text} spoken={help.spoken} style={styles.help} />
      ) : null}
    </View>
  );
});

interface CellProps {
  index: number;
  char: string;
  next: boolean;
  hideMarks: boolean;
  disabled: boolean;
  interactive: boolean;
  /** The digits before this change, and the first cell the change touched. */
  before: string;
  landedFrom: number;
  popKey?: number;
  reduceMotion: boolean;
  fontFamily: string;
}

/** One cell: a digit (popping as it lands), or the soft dot, or — the current one — white with caret and bar. */
function Cell({
  index,
  char,
  next,
  hideMarks,
  disabled,
  interactive,
  before,
  landedFrom,
  popKey,
  reduceMotion,
  fontFamily,
}: CellProps) {
  const digitStyle = useDigitPop({ index, char, before, landedFrom, popKey, reduceMotion, enabled: interactive });

  return (
    <View style={[styles.cell, next && styles.cellNext]}>
      {char ? (
        <Animated.View style={digitStyle}>
          <LtText
            role="digit"
            color={disabled ? LT.ink3 : LT.ink}
            style={[styles.digit, { fontFamily }]}
            maxFontSizeMultiplier={1}
            accessible={false}
          >
            {char}
          </LtText>
        </Animated.View>
      ) : hideMarks ? null : next ? (
        <>
          <View style={styles.bar} />
          <Caret reduceMotion={reduceMotion} />
        </>
      ) : (
        <View style={[styles.dot, disabled && styles.dotDisabled]} />
      )}
    </View>
  );
}

/** The 2pt indigo caret: blinks once a second, steady under reduced motion. */
function Caret({ reduceMotion }: { reduceMotion: boolean }) {
  const blink = useCaretBlink(reduceMotion);
  return <Animated.View style={[styles.caret, blink]} />;
}

const STRIP_HEIGHT = 62;

const styles = StyleSheet.create({
  label: { marginBottom: 10 },
  windowBox: { width: "100%", maxWidth: 360, height: STRIP_HEIGHT },
  frame: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.window + 3,
  },
  frameFocus: { top: -5, left: -5, right: -5, bottom: -5, borderWidth: 2, borderColor: LT.indigo, borderRadius: LT_RADIUS.window + 4 },
  frameLoading: { borderColor: LT.mist },
  /** The gold window (board `.lt-lr__win`): gold leaf, its edge, a gold-line frame, dividers in the edge's ink at 55%. */
  frameGold: { borderColor: LT.goldLine },
  stripGold: { backgroundColor: LT.gold, borderColor: LT.goldEdge },
  stripGoldEmpty: { backgroundColor: "transparent", borderStyle: "dashed", borderColor: LT.field },
  dividerGold: { backgroundColor: LT.goldEdge, opacity: 0.55 },
  strip: {
    flex: 1,
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor: LT.cream1,
    borderWidth: 1,
    borderRadius: LT_RADIUS.window,
  },
  stripMist: { backgroundColor: LT.mist },
  cell: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center" },
  cellNext: { backgroundColor: LT.white },
  digit: { textAlign: "center", includeFontPadding: false },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: LT.lineStrong },
  dotDisabled: { backgroundColor: LT.line },
  bar: { position: "absolute", left: 8, right: 8, bottom: 7, height: 3, borderRadius: 2, backgroundColor: LT.indigo },
  caret: {
    position: "absolute",
    left: "50%",
    top: 15,
    bottom: 17,
    width: 2,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: LT.indigo,
  },
  divider: { position: "absolute", top: 0, bottom: 0, width: 1, marginLeft: -1, backgroundColor: LT.line },
  /** The real input over the strip: full size, every mark of its own transparent. */
  input: {
    ...StyleSheet.absoluteFill,
    margin: 0,
    padding: 0,
    color: "transparent",
    backgroundColor: "transparent",
    fontSize: 16,
  },
  words: { flexDirection: "row", width: "100%", maxWidth: 360, marginTop: 8 },
  word: { flex: 1, textAlign: "center", letterSpacing: 0.48 },
  help: { marginTop: 10, minHeight: 32 },
});
