import { memo, useCallback, useEffect, useMemo, useRef, useState, type Ref } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextInputInstance,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useScrollIntoView } from "@/hooks/useKeyboardLift";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { LtText } from "@/lottery/components/LtText";
import type { NumberWindowState } from "@/lottery/components/NumberWindow";
import { LtHelp, type LtHelpKind } from "@/lottery/components/Surfaces";
import {
  cleanDigits,
  DIGIT_CELLS,
  focusEntry,
  useAnnounceDigits,
  useCaretBlink,
  useDigitPop,
  useLandedDigits,
} from "@/lottery/components/numberEntry";
import { Barcode, QrCode } from "@/lottery/components/ticket/Barcode";
import {
  DrawPrint,
  Field,
  Overprint,
  PrintedText,
  TICKET_BOX,
  TicketPaper,
  useTicketGeometry,
  type TicketDraw,
} from "@/lottery/components/ticket/Ticket";
import { THAI_TEMPLATE, type TicketBox } from "@/lottery/components/ticket/template";
import { DIGIT_WORDS, pad, spaced } from "@/lottery/data/format";
import { barcodeCode, barcodePath, qrPath } from "@/lottery/data/ticketArt";
import { DRAW_COPY } from "@/lottery/screens/draw/copy";
import { LT_MYANMAR_FACE, useLtFace } from "@/lottery/theme/fonts";
import { MYANMAR_LINE_BONUS, MYANMAR_SCRIPT } from "@/lottery/theme/type";
import { LT, LT_EASE, LT_LAYOUT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

export interface TicketInputProps {
  /** The draw on sale: its frame, picture, dates, draw number and price print live. */
  draw: TicketDraw;
  /** The digits so far, as a string ("372", "004821"); never more than six. */
  value: string;
  /**
   * Gets the cleaned digits (`replace(/\D/g, "").slice(0, 6)`) and whether
   * anything that was not a digit was dropped (a pasted "No.", a letter) —
   * the caller's cue for the "Only the digits 0 to 9 are kept." help line.
   */
  onChange: (digits: string, info: { dropped: boolean }) => void;
  /** Overrides the ring state worked out from `value` (empty / typing / complete). */
  state?: NumberWindowState;
  /** Change it to pop all six digits (45ms apart) — Quick pick. */
  popKey?: number;
  /** The label above ("Your six-digit number"). */
  label?: string;
  /** The help / validation line under the ticket; its text is also spoken after each change. */
  help?: { kind: LtHelpKind; text: string; spoken?: string };
  /**
   * The keyboard's Return / Enter (Draw: adds the number to the list). Given,
   * the ticket keeps its focus on Return, so the keyboard stays up for the
   * next number; the caller dismisses it when Return has nothing to do.
   */
  onSubmitEditing?: () => void;
  /** What is read when the ticket empties, instead of "No digits yet." — "" reads nothing. */
  emptySpoken?: string;
  inputRef?: Ref<TextInputInstance>;
  /** The spoken name; defaults to the label, then "Your six-digit number". */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The board's boxes, as fractions of the ticket like the template's (Draw.dc.html
 * `.lt-slot`, `.lt-slot__input`, `.lt-tt__after`).
 */
/** The ring round the number slot: it hugs the number and its digit words (the Burmese date prints just under it). */
const SLOT: TicketBox = { x: 0.494, y: 0.042, w: 0.408, h: 0.188 };
/** The real input: from the paper's top edge down past the digit words, 44% wide — and never under 44pt tall. */
const INPUT: TicketBox = { x: 0.48, y: 0, w: 0.44, h: 0.27 };
/** "Printed after purchase": the number's columns over the barcode's rows. */
const AFTER: TicketBox = {
  x: THAI_TEMPLATE.fields.number.x,
  y: THAI_TEMPLATE.barcode.y,
  w: THAI_TEMPLATE.fields.number.w,
  h: THAI_TEMPLATE.barcode.h,
};
/** The ring's tint glow, 3 outside it. */
const RING = 3;
/** The ring's ink and the paper's lift ease between looks over 150ms (`.lt-slot{transition}`); never under reduced motion. */
const RING_EASE_MS = 150;
/** A cell with no digit: a dash max(2, .6% of W) tall in the number row; the words row's is 1 tall. */
const DASH_H_REL = 0.006;
/** The caret: max(2, .5% of W) wide, 16% in from the number row's top and bottom. */
const CARET_W_REL = 0.005;
const CARET_INSET = 0.16;
/** The pill: Franklin 600 at max(9, 2.5% of W), padding .25em / .7em, line height 1.2. */
const PILL_MIN_SIZE = 9;
const PILL_SIZE_REL = 0.025;
const PILL_PAD_Y = 0.25;
const PILL_PAD_X = 0.7;
const PILL_LINE = 1.2;
/** What the ghosts print where the purchase will print the digits. */
const GHOST_RUN = "––––––";
/**
 * A beat after focus or a complete number, so the ring and the help line have
 * laid out before the page is asked to lift (AuthField's beat).
 */
const LIFT_DELAY_MS = 80;

/**
 * YOUR NUMBER, ON THE TICKET (Draw.dc.html, owner 22 Oct 2026: "combine your
 * six digit number and your ticket … type just on the ticket"). The Thai-style
 * ticket IS the number entry: the draw's own print is live (TicketPaper,
 * DrawPrint, Overprint — the same pieces as every Ticket), the six-digit
 * number slot is the input, and the ticket ID, barcode, its code and the QR
 * — not known before buying — print as ghosts in line-strong under one cream
 * "Printed after purchase".
 *
 * The ONE real TextInput lies invisibly over the slot (44% × 27% of the
 * ticket, never under 44pt tall), as it lay over the old number window: it is
 * what a finger, a paste and a screen reader reach, with its own text, caret
 * and selection transparent, fully opaque (iOS never hit-tests a view under 1%
 * opacity). Its selection is pinned to the end, so typing always appends and
 * Backspace always takes the last digit. A tap on the paper outside the slot
 * focuses it too. Digits only, the first six kept, leading zeros kept; a paste
 * of "No. 004-821" fills all six, and a pasted run of six or more digits
 * replaces the number (the board's onPaste), so the native field is never cut
 * at six characters before the digits are picked out.
 *
 * The digits are the ticket's own number layer, one cell each; a cell with no
 * digit shows a faint indigo-grey dash, with a shorter one under it in the
 * words row. The ring by state: empty dashed indigo-grey · typing solid ·
 * complete indigo · warn / error their ink. Focus: solid indigo (warn and
 * error keep their ink), the paper under it half white, a 3pt glow of the
 * state's tint, and a 2pt indigo caret blinking after the last digit (at the
 * right edge of the sixth once all six are in). The ring's ink and the lift
 * ease between looks over 150ms. A landing digit pops; the ring and the
 * dashes never move; nothing moves or eases under reduced motion. Each
 * change is read out digit by digit: "Your number: 3 7 2. 3 of 6 digits".
 *
 * On focus, and again once all six digits are in (the help line turns from
 * "N of 6" to checking / ready / held, and can take a second line), the
 * ticket asks the page to bring it into view (useScrollIntoView): on Draw
 * the page lifts the whole number block above the buy bar riding on the
 * keyboard, so Add is never under the bar.
 */
export const TicketInput = memo(function TicketInput({
  draw,
  value,
  onChange,
  state,
  popKey,
  label,
  help,
  onSubmitEditing,
  emptySpoken,
  inputRef,
  accessibilityLabel,
  style,
}: TicketInputProps) {
  const reduceMotion = useReducedMotion();
  const [W, setW] = useState(0);
  const [focused, setFocused] = useState(false);
  const digits = value.slice(0, 6);
  const resolved: NumberWindowState =
    state ?? (digits.length === 0 ? "empty" : digits.length < 6 ? "typing" : "complete");
  const disabled = resolved === "disabled";
  const showFocus = focused && !disabled;
  const { before, landedFrom } = useLandedDigits(digits);
  // Speak each change — never on mount. The help line is the caller's, for this same value.
  useAnnounceDigits({ digits, enabled: true, help, emptySpoken });

  // Focus, a complete number, and the help line changing under one (checking → ready / held can add a line
  // and push the Add row down): the page is asked to bring the ticket's block into view, a beat later.
  const scrollIntoView = useScrollIntoView();
  const complete = digits.length === 6;
  const completeHelp = complete ? help?.text : undefined;
  useEffect(() => {
    if (!focused) return;
    const timer = setTimeout(scrollIntoView, LIFT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [focused, complete, completeHelp, scrollIntoView]);

  // The one input: the caller's ref and this component's own (the paper focuses it).
  const own = useRef<TextInputInstance>(null);
  const setRef = useCallback(
    (node: TextInputInstance | null) => {
      own.current = node;
      if (typeof inputRef === "function") inputRef(node);
      else if (inputRef) inputRef.current = node;
    },
    [inputRef],
  );
  const focusInput = () => focusEntry(own.current);

  const { H } = useTicketGeometry(W);
  // Always after the last digit: a tap in the middle of the slot is put back at the end.
  const selection = useMemo(() => ({ start: digits.length, end: digits.length }), [digits.length]);
  const spokenName = accessibilityLabel ?? label ?? DRAW_COPY.numberLabel;

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (Math.abs(next - W) > 0.5) setW(next);
  };

  return (
    <View style={style}>
      {label ? (
        <LtText role="metaB" color={LT.ink2} style={styles.label} accessible={false} importantForAccessibility="no">
          {label}
        </LtText>
      ) : null}

      <View onLayout={onLayout} style={styles.box}>
        {W > 0 ? (
          <>
            {/* The paper and every drawn layer: artwork, so hidden from screen readers (the input speaks for it). */}
            <Pressable
              onPress={focusInput}
              disabled={disabled}
              style={StyleSheet.absoluteFill}
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <TicketInputLayers
                W={W}
                draw={draw}
                digits={digits}
                state={resolved}
                focused={showFocus}
                before={before}
                landedFrom={landedFrom}
                popKey={popKey}
                reduceMotion={reduceMotion}
              />
            </Pressable>
            <TextInput
              ref={setRef}
              value={digits}
              onChangeText={(raw) => {
                // The selection is pinned to the end, so what came in is raw's tail past the digits so far: one
                // typed digit, or a paste. A pasted run of six or more digits replaces the number; less appends.
                const added = raw.startsWith(digits) ? raw.slice(digits.length) : raw;
                const run = added.replace(/\D/g, "");
                onChange(run.length >= 6 ? run.slice(0, 6) : cleanDigits(raw), { dropped: /\D/.test(raw) });
              }}
              selection={selection}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              editable={!disabled}
              keyboardType="number-pad"
              onSubmitEditing={onSubmitEditing}
              submitBehavior={onSubmitEditing ? "submit" : undefined}
              // Room for a labelled paste ("No. 004-821"); the first six digits are what is kept.
              maxLength={20}
              caretHidden
              selectionColor="transparent"
              underlineColorAndroid="transparent"
              autoComplete="off"
              autoCorrect={false}
              importantForAutofill="no"
              allowFontScaling={false}
              accessibilityLabel={spokenName}
              accessibilityValue={{ text: digits ? spaced(digits) : COMPONENT_COPY.entry.emptyValue }}
              accessibilityHint={help ? (help.spoken ?? help.text) : undefined}
              accessibilityState={{ disabled }}
              style={[
                styles.input,
                // Android ignores the transparent text colour on this field (the owner's
                // phone printed a second "333333" over the ticket, 2026-10-23), so there the
                // field is fully see-through instead. iOS keeps the colour trick: it never
                // hit-tests a view under 1% opacity, so it has to stay opaque.
                Platform.OS === "android" && styles.inputAndroid,
                {
                  left: INPUT.x * W,
                  top: INPUT.y * H,
                  width: INPUT.w * W,
                  height: Math.max(INPUT.h * H, LT_LAYOUT.minTouch),
                },
              ]}
            />
          </>
        ) : null}
      </View>

      {help ? (
        <LtHelp kind={help.kind} text={help.text} spoken={help.spoken} style={styles.help} />
      ) : null}
    </View>
  );
});

interface LayersProps {
  W: number;
  draw: TicketDraw;
  digits: string;
  state: NumberWindowState;
  focused: boolean;
  before: string;
  landedFrom: number;
  popKey?: number;
  reduceMotion: boolean;
}

/** Every drawn layer, absolutely placed in the W × W/1.915 box, in the board's order. */
function TicketInputLayers({ W, draw, digits, state, focused, before, landedFrom, popKey, reduceMotion }: LayersProps) {
  const face = useLtFace();
  const { place, fontOf } = useTicketGeometry(W);
  const fields = THAI_TEMPLATE.fields;

  // The purchase's layers as ghosts: "MFL-24-––––––", "26103124––––––-––––––" and their stand-in bars and QR.
  const ghost = useMemo(() => {
    const id = `MFL-${pad(draw.no, 2)}-${GHOST_RUN}`;
    const code = barcodeCode(draw.no, draw.dateIso, id, GHOST_RUN);
    return { id, code, bars: barcodePath(code), qr: qrPath(id) };
  }, [draw.no, draw.dateIso]);

  // The ring's ink: the state's, or — focused — indigo unless warn / error keep theirs; the glow is the same tint.
  const tone = state === "warn" ? "warn" : state === "error" ? "err" : "indigo";
  const ringColor = focused
    ? tone === "warn"
      ? LT.warn
      : tone === "err"
        ? LT.err
        : LT.indigo
    : state === "complete"
      ? LT.indigo
      : state === "warn"
        ? LT.warn
        : state === "error"
          ? LT.err
          : state === "disabled"
            ? LT.line
            : LT.slotLine;
  const dashed = state === "empty" && !focused;
  // The ink and the lift ease over 150ms (reanimated interpolates the colour strings); set outright under reduced motion.
  const ring = useSharedValue(ringColor);
  const lift = useSharedValue(focused ? LT.slotLift : LT.slotClear);
  useEffect(() => {
    const nextLift = focused ? LT.slotLift : LT.slotClear;
    if (reduceMotion) {
      ring.value = ringColor;
      lift.value = nextLift;
      return;
    }
    ring.value = withTiming(ringColor, { duration: RING_EASE_MS, easing: LT_EASE });
    lift.value = withTiming(nextLift, { duration: RING_EASE_MS, easing: LT_EASE });
  }, [ringColor, focused, reduceMotion, ring, lift]);
  const ringStyle = useAnimatedStyle(() => ({ borderColor: ring.value, backgroundColor: lift.value }));

  const numberBox = place(fields.number);
  const barcodeBox = place(THAI_TEMPLATE.barcode);
  const numberFont = fontOf(fields.number);
  const wordFont = fontOf(fields.digitWords);
  const dashHeight = Math.max(2, DASH_H_REL * W);
  const caretWidth = Math.max(2, CARET_W_REL * W);
  const pillSize = Math.max(PILL_MIN_SIZE, PILL_SIZE_REL * W);
  // Libre Franklin has no Myanmar glyphs: a Burmese pill takes the Myanmar face and LtText's taller line.
  const pillMy = MYANMAR_SCRIPT.test(DRAW_COPY.ticket.printedAfter);
  const pillText: TextStyle = {
    fontFamily: pillMy ? LT_MYANMAR_FACE.franklin600 : face("franklin600"),
    fontSize: pillSize,
    lineHeight: PILL_LINE * pillSize + (pillMy ? MYANMAR_LINE_BONUS : 0),
    color: LT.ink2,
  };

  return (
    <>
      <TicketPaper W={W} draw={draw} />

      {/* The ring: under the number and words layers, so the lifted paper sits under the digits. */}
      <Animated.View
        style={[
          place(SLOT),
          styles.slot,
          { borderStyle: dashed ? "dashed" : "solid" },
          ringStyle,
          focused && (tone === "warn" ? styles.glowWarn : tone === "err" ? styles.glowErr : styles.glowIndigo),
        ]}
      />
      <View style={[numberBox, styles.cells]}>
        {DIGIT_CELLS.map((i) => (
          <DigitCell
            key={i}
            index={i}
            char={digits.charAt(i)}
            font={numberFont}
            dashHeight={dashHeight}
            before={before}
            landedFrom={landedFrom}
            popKey={popKey}
            reduceMotion={reduceMotion}
          />
        ))}
        {focused ? (
          <Caret
            left={(digits.length / 6) * numberBox.width}
            width={caretWidth}
            inset={CARET_INSET * numberBox.height}
            reduceMotion={reduceMotion}
          />
        ) : null}
      </View>
      <View style={[place(fields.digitWords), styles.cells]}>
        {DIGIT_CELLS.map((i) => {
          const digit = digits.charAt(i);
          return (
            <View key={i} style={styles.cell}>
              {digit ? <PrintedText text={DIGIT_WORDS[Number(digit)]} style={wordFont} /> : <View style={styles.wordDash} />}
            </View>
          );
        })}
      </View>

      <DrawPrint W={W} draw={draw} />

      <Field box={place(fields.ticketId)} text={ghost.id} style={[fontOf(fields.ticketId), styles.ghostInk]} align="right" />
      <View style={barcodeBox}>
        <Barcode
          d={ghost.bars.d}
          viewWidth={ghost.bars.width}
          width={barcodeBox.width}
          height={barcodeBox.height}
          color={LT.lineStrong}
        />
      </View>
      <Field box={place(fields.barcodeText)} text={ghost.code} style={[fontOf(fields.barcodeText), styles.ghostInk]} />
      <View style={[place(THAI_TEMPLATE.qr), styles.ghostQr]}>
        <QrCode d={ghost.qr} size={THAI_TEMPLATE.qr.w * W} color={LT.lineStrong} />
      </View>
      <View style={[place(AFTER), styles.after]}>
        <View style={[styles.pill, { paddingVertical: PILL_PAD_Y * pillSize, paddingHorizontal: PILL_PAD_X * pillSize }]}>
          <PrintedText text={DRAW_COPY.ticket.printedAfter} style={pillText} />
        </View>
      </View>

      <Overprint W={W} draw={draw} />
    </>
  );
}

/** One number cell: its digit (popping as it lands), or the dash. */
function DigitCell({
  index,
  char,
  font,
  dashHeight,
  before,
  landedFrom,
  popKey,
  reduceMotion,
}: {
  index: number;
  char: string;
  font: TextStyle;
  dashHeight: number;
  before: string;
  landedFrom: number;
  popKey?: number;
  reduceMotion: boolean;
}) {
  const pop = useDigitPop({ index, char, before, landedFrom, popKey, reduceMotion, enabled: true });
  return (
    <View style={styles.cell}>
      {char ? (
        <Animated.View style={pop}>
          <PrintedText text={char} style={font} />
        </Animated.View>
      ) : (
        <View style={[styles.dash, { height: dashHeight }]} />
      )}
    </View>
  );
}

/** The indigo caret after the last digit: blinks once a second, steady under reduced motion. */
function Caret({ left, width, inset, reduceMotion }: { left: number; width: number; inset: number; reduceMotion: boolean }) {
  const blink = useCaretBlink(reduceMotion);
  return <Animated.View style={[styles.caret, { left: left - width / 2, width, top: inset, bottom: inset }, blink]} />;
}

const styles = StyleSheet.create({
  /** `.lt-label` then `.lt-tt--type{margin-top:12px}`. */
  label: { marginBottom: 12 },
  box: { ...TICKET_BOX, width: "100%", boxShadow: LT_SHADOW.ticket },
  slot: { borderWidth: 1.5, borderRadius: LT_RADIUS.window },
  glowIndigo: { boxShadow: `0 0 0 ${RING}px ${LT.indigoTint}` },
  glowWarn: { boxShadow: `0 0 0 ${RING}px ${LT.warnTint}` },
  glowErr: { boxShadow: `0 0 0 ${RING}px ${LT.errTint}` },
  cells: { flexDirection: "row" },
  cell: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center" },
  /** 24% in from each side of its cell. */
  dash: { width: "52%", borderRadius: 1, backgroundColor: LT.slotDash },
  /** 34% in from each side. */
  wordDash: { width: "32%", height: 1, backgroundColor: LT.slotDash },
  caret: { position: "absolute", borderRadius: 1, backgroundColor: LT.indigo },
  ghostInk: { color: LT.lineStrong },
  ghostQr: { backgroundColor: LT.ghostPaper },
  after: { alignItems: "center", justifyContent: "center" },
  pill: { borderRadius: LT_RADIUS.round, backgroundColor: LT.cream1, borderWidth: 1, borderColor: LT.line },
  /** The real input over the slot: every mark of its own transparent. */
  input: {
    position: "absolute",
    margin: 0,
    padding: 0,
    color: "transparent",
    backgroundColor: "transparent",
    fontSize: 16,
  },
  /** Android: see-through, so its own text can never show over the ticket's digits. */
  inputAndroid: { opacity: 0 },
  help: { marginTop: 10, minHeight: 32 },
});
