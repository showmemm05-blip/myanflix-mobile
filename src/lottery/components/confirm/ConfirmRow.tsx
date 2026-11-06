import { memo, useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LtIcon, type LtIconName } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import type { RowView } from "@/lottery/components/confirm/confirmModel";
import { DRAW_COPY } from "@/lottery/screens/draw/copy";
import { useLtFace } from "@/lottery/theme/fonts";
import { LT, LT_EASE, LT_RADIUS } from "@/lottery/theme/tokens";
import { LT_TYPE, MONO_ADVANCE, TABULAR } from "@/lottery/theme/type";

const R = DRAW_COPY.confirm.row;

/** The number's digits grow with the OS text size up to this, and their cells grow with them. */
const DIGIT_SCALE_MAX = 1.3;
/** Row totals and the typed box: a little growth, never enough to break the four columns. */
const ROW_SCALE_MAX = 1.2;
/** The total column fits "20,000 Ks" (the most one row can cost), so every row's stepper and total line up. */
const SUM_W = 64;
const STEP_W = 32;
const QTY_H = 34;
/** − and + reach 44 × 44 to the finger: 5 above and below the 34 pill, 12 outwards. */
const STEP_SLOP_Y = (44 - QTY_H) / 2;
const STEP_SLOP_OUT = 44 - STEP_W;
const REMOVE = 30;
/** A just-added row's indigo tint fades over 1.4 s; with reduced motion it simply goes after 1.6 s (Draw board). */
const FLASH_FADE_MS = 1400;
const FLASH_STILL_MS = 1600;
/** The tint reaches 8 past each side of the row (board box-shadow ±8). */
const FLASH_REACH = 8;

export interface ConfirmRowProps {
  number: string;
  view: RowView;
  /** Processing: the box and Remove are locked. */
  busy: boolean;
  /** The typed box has focus (the pill's edge turns indigo). */
  focused: boolean;
  /** Under 360pt wide: the digits step down to 17 and the gaps to 6 (the board's 320 rule). */
  narrow: boolean;
  /** Not the first row: a hairline above it. */
  divided: boolean;
  onLess: (number: string) => void;
  onMore: (number: string) => void;
  onType: (number: string, text: string) => void;
  onFocus: (number: string) => void;
  onBlur: (number: string) => void;
  onRemove: (number: string) => void;
  /** The row's y inside the list, to bring a focused box above the keyboard. */
  onPlaced: (number: string, y: number) => void;
  /**
   * Draw's "Your numbers" only: change it (to a non-zero value) to tint the row
   * indigo for a moment — it was just added, or got 1 more. Decoration only:
   * the toast and the spoken line say what changed.
   */
  flashKey?: number;
}

/**
 * ONE SLIM ROW PER NUMBER (Confirm v3 · compact, `.lt-cl__row`, about 56
 * tall): [number + caption | − qty + | row total | ×], with the limit line
 * under it only when it matters.
 *
 *  - Number: Courier Prime 700 19, each digit in a 1ch + 1.5 cell, so a
 *    dream's digits read as ONE indigo-tint chip with indigo digits; an 11pt
 *    caption under it ("Fish · dream 027" · "Your number").
 *  - Stepper: one 34-tall pill − | qty | +, each step 32 wide but 44 × 44 to
 *    the finger; the qty is a real box you can type into (bold 16). At the
 *    limits a step LOOKS disabled and is announced disabled, but stays
 *    pressable so focus is never dropped: the tap says the limit instead.
 *  - Row total, bold 13 in a fixed 64 column, then a 30 round ×, 44 to the finger.
 *
 * Screen readers hear the row as: the number (digit by digit, with its dream),
 * "Fewer tickets for 0 2 7 5 1 4", "Number of tickets for …", "More tickets
 * for …" — each with the row's limits as its hint — the line total, Remove.
 */
export const ConfirmRow = memo(function ConfirmRow({
  number,
  view,
  busy,
  focused,
  narrow,
  divided,
  onLess,
  onMore,
  onType,
  onFocus,
  onBlur,
  onRemove,
  onPlaced,
  flashKey = 0,
}: ConfirmRowProps) {
  const face = useLtFace();
  const reduceMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const digitSize = narrow ? 17 : LT_TYPE.mono.fontSize;
  // Monospaced: one cell = 1ch at the drawn size + 1.5 (the board's calc(1ch + 1.5px)).
  const cell = digitSize * Math.min(Math.max(fontScale, 1), DIGIT_SCALE_MAX) * MONO_ADVANCE + 1.5;

  const onLayout = (event: LayoutChangeEvent) => onPlaced(number, event.nativeEvent.layout.y);

  // A new key restarts the tint (a second Add on the same row); 0 leaves a running fade alone.
  const flash = useSharedValue(0);
  useEffect(() => {
    if (!flashKey) return;
    flash.value = withSequence(
      withTiming(1, { duration: 0 }),
      reduceMotion
        ? withDelay(FLASH_STILL_MS, withTiming(0, { duration: 0 }))
        : withTiming(0, { duration: FLASH_FADE_MS, easing: LT_EASE }),
    );
  }, [flashKey, reduceMotion, flash]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  return (
    <View style={[styles.row, divided && styles.divided]} onLayout={onLayout}>
      {flashKey ? <Animated.View pointerEvents="none" style={[styles.flash, flashStyle]} /> : null}
      <View style={[styles.grid, narrow && styles.gridNarrow]}>
        {/* The number and its caption: one stop for a screen reader. */}
        <View style={styles.id} accessible accessibilityLabel={view.spoken}>
          <View style={styles.digits}>
            {view.digits.map((d, i) => (
              <View
                key={i}
                style={[
                  styles.cell,
                  { width: cell },
                  d.dream && styles.dream,
                  d.first && styles.dreamStart,
                  d.last && styles.dreamEnd,
                ]}
              >
                <LtText
                  role="mono"
                  color={d.dream ? LT.indigo : LT.ink}
                  maxFontSizeMultiplier={DIGIT_SCALE_MAX}
                  style={narrow ? styles.digitNarrow : undefined}
                >
                  {d.digit}
                </LtText>
              </View>
            ))}
          </View>
          {view.caption ? (
            <LtText role="caption" color={LT.ink3} numberOfLines={1} style={styles.caption}>
              {view.caption}
            </LtText>
          ) : null}
        </View>

        {/* The stepper pill: − | qty | +. */}
        <View
          style={[
            styles.qty,
            focused && styles.qtyFocused,
            view.tone === "err" && styles.qtyErr,
            view.tone === "max" && styles.qtyMax,
          ]}
        >
          <Step
            side="start"
            icon="minus"
            label={R.fewer(number)}
            hint={view.hint}
            enabled={view.canLess}
            busy={busy}
            onPress={() => onLess(number)}
          />
          <TextInput
            value={view.value}
            onChangeText={(text) => onType(number, text)}
            onFocus={() => onFocus(number)}
            onBlur={() => onBlur(number)}
            editable={!busy}
            keyboardType="number-pad"
            returnKeyType="done"
            maxLength={2}
            selectTextOnFocus
            autoComplete="off"
            autoCorrect={false}
            maxFontSizeMultiplier={ROW_SCALE_MAX}
            accessibilityLabel={R.quantity(number)}
            accessibilityHint={view.hint}
            accessibilityState={{ disabled: busy }}
            selectionColor={LT.selection}
            cursorColor={LT.indigo}
            underlineColorAndroid="transparent"
            style={[styles.input, { fontFamily: face("franklin700") }, busy && styles.inputBusy]}
          />
          <Step
            side="end"
            icon="plus"
            label={R.more(number)}
            hint={view.hint}
            enabled={view.canMore}
            busy={busy}
            onPress={() => onMore(number)}
          />
        </View>

        <View style={styles.sum} accessible accessibilityLabel={view.sumSpoken}>
          <LtText
            role="buttonSm"
            tabular
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={ROW_SCALE_MAX}
            style={styles.sumText}
          >
            {view.sum}
          </LtText>
        </View>

        <Pressable
          onPress={() => onRemove(number)}
          disabled={busy}
          hitSlop={(44 - REMOVE) / 2}
          accessibilityRole="button"
          accessibilityLabel={R.remove(number)}
          accessibilityState={{ disabled: busy }}
          style={({ pressed }) => [styles.remove, pressed && !busy && styles.removePressed]}
        >
          {({ pressed }) => (
            <LtIcon name="remove" size={16} strokeWidth={2} color={busy ? LT.lineStrong : pressed ? LT.err : LT.ink3} />
          )}
        </Pressable>
      </View>

      {view.note ? (
        <LtText
          role="micro"
          tabular
          color={view.note.kind === "err" ? LT.err : LT.warn}
          style={styles.note}
          accessibilityLabel={view.hint}
        >
          {view.note.text}
        </LtText>
      ) : null}
    </View>
  );
});

/** One end of the pill. Never `disabled` while not busy: a refused press is announced by the row instead. */
function Step({
  side,
  icon,
  label,
  hint,
  enabled,
  busy,
  onPress,
}: {
  side: "start" | "end";
  icon: LtIconName;
  label: string;
  hint: string;
  enabled: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const slop = {
    top: STEP_SLOP_Y,
    bottom: STEP_SLOP_Y,
    left: side === "start" ? STEP_SLOP_OUT : 0,
    right: side === "end" ? STEP_SLOP_OUT : 0,
  };
  const corner: StyleProp<ViewStyle> = side === "start" ? styles.stepStart : styles.stepEnd;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [
        styles.step,
        corner,
        !enabled && styles.stepOff,
        pressed && enabled && styles.stepPressed,
        pressed && enabled && !reduceMotion && styles.stepDown,
      ]}
    >
      <LtIcon name={icon} size={16} strokeWidth={2} color={enabled ? LT.ink : LT.ink3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** `.lt-cl__row`: at least 56 tall, 9 above and below. */
  row: { minHeight: 56, paddingVertical: 9, justifyContent: "center" },
  divided: { borderTopWidth: 1, borderTopColor: LT.line },
  flash: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: -FLASH_REACH,
    right: -FLASH_REACH,
    backgroundColor: LT.indigoTint,
  },
  /** [number 1fr | stepper auto | total 64 | × 30], 10 apart (6 under 360). */
  grid: { flexDirection: "row", alignItems: "center", gap: 10 },
  gridNarrow: { gap: 6 },
  id: { flex: 1, minWidth: 0, alignItems: "flex-start", gap: 1 },
  digits: { flexDirection: "row" },
  cell: { alignItems: "center" },
  dream: { backgroundColor: LT.indigoTint },
  dreamStart: { borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  dreamEnd: { borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  digitNarrow: { fontSize: 17, lineHeight: 22 },
  /** 11/14 grey, one line. */
  caption: { alignSelf: "stretch", fontSize: 11, lineHeight: 14 },
  /** One 34-tall pill, 1px field edge, radius 8. */
  qty: {
    flexDirection: "row",
    alignItems: "stretch",
    height: QTY_H,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.field,
    borderRadius: LT_RADIUS.button,
  },
  qtyFocused: { borderColor: LT.indigo },
  qtyErr: { borderColor: LT.err },
  qtyMax: { borderColor: LT.warn },
  step: { width: STEP_W, alignItems: "center", justifyContent: "center" },
  stepStart: { borderTopLeftRadius: 7, borderBottomLeftRadius: 7 },
  stepEnd: { borderTopRightRadius: 7, borderBottomRightRadius: 7 },
  stepOff: { backgroundColor: LT.mist },
  stepPressed: { backgroundColor: LT.cream2 },
  stepDown: { transform: [{ translateY: 1 }] },
  /** The typed box: 34 wide, hairlines either side, Franklin 700 16 (16 so a phone never zooms on focus). */
  input: {
    width: 34,
    paddingVertical: 0,
    paddingHorizontal: 0,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
    fontSize: 16,
    fontVariant: TABULAR,
    color: LT.ink,
    backgroundColor: LT.white,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: LT.line,
  },
  inputBusy: { backgroundColor: LT.mist, color: LT.ink3 },
  sum: { width: SUM_W, alignItems: "flex-end" },
  /** Bold 13/18, tabular, right-aligned. */
  sumText: { fontSize: 13, lineHeight: 18, textAlign: "right" },
  remove: {
    width: REMOVE,
    height: REMOVE,
    borderRadius: REMOVE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  removePressed: { backgroundColor: LT.errLine },
  /** The limit line spans the row: 600 11/14. */
  note: { marginTop: 5, fontSize: 11, lineHeight: 14 },
});
