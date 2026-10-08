import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressScale } from "@/components/wallet/PressScale";
import { useSheetKeyboardLift } from "@/components/ui/BottomSheet";
import { formatKyat, formatKyatNumber } from "@/utils/currency";
import { tabularNums, theme, withAlpha } from "@/theme";

/**
 * The form vocabulary of the app's bottom-sheet forms — one set of labels,
 * fields, quick-amount chips, method tiles and helper/error lines, so every
 * sheet form looks and behaves identically. Purely presentational: every value
 * and handler is owned by the sheet that renders these.
 *
 * `AmountField`, `QuickAmounts` and `SheetInput`'s `numeric`/`suffix`/`flat`
 * modes are money-specific and belong to the deposit/withdraw flows; `SheetForm`,
 * `SheetTextArea`, `HelperText`, `ErrorNotice` and `SheetSuccess`
 * carry no money semantics and are what the feedback, search and reader sheets
 * reuse, rather than growing a second, slightly different set of form parts.
 *
 * `SheetForm` is the one exception to "purely presentational": it owns the
 * keyboard behaviour of every sheet form, which is a layout job no single field
 * can do for itself.
 */

/**
 * "Bring the field I just focused into view" — supplied by `SheetForm`, called
 * by the fields below. Context rather than a prop so a field nested anywhere in
 * the form picks it up; the default no-op keeps a field usable outside a sheet.
 */
/** Air left between a revealed field and whatever was covering it. */
const REVEAL_GAP = 8;

const RevealContext = createContext<() => void>(() => {});

/**
 * For a sheet that renders its own TextInput instead of one of the fields here:
 * hand the result to `onFocus`. It only answers inside a `SheetForm`, so the
 * field has to live in a component below it, not in the sheet that renders it.
 */
export function useRevealOnFocus() {
  return useContext(RevealContext);
}

interface SheetFormProps {
  children: ReactNode;
  /** The pinned submit (and its error line). Floats above the keyboard. */
  action?: ReactNode;
  /** Layout for the field column — the bottom padding is owned here. */
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * The pinned bar's own look, for a form that is not on the sheet's popover
   * fill (the full-height money flows sit on the page background).
   */
  actionStyle?: StyleProp<ViewStyle>;
  /**
   * Lets touches through the parts of the pinned bar that draw nothing: the
   * money flows' FlowActionBar opens with a see-through fade over the form,
   * and a tap there belongs to the field under it. Off by default — this
   * form's own bar is an opaque fill, and what lies under it must stay
   * untouchable.
   */
  actionPassThrough?: boolean;
}

/**
 * The scrolling body of every sheet form.
 *
 * The sheet has a fixed height and an anchored bottom, so NOTHING here may
 * change the scroll view's frame when the keyboard opens — that is what used to
 * shove every field up the screen. So: the action bar is absolutely positioned
 * over the bottom of the body and merely translated up by the keyboard overlap
 * (a transform costs no layout), the scroll content gains bottom padding for
 * the bar plus the keyboard so nothing is stranded under either, and the
 * focused field is scrolled into view by hand — inside a Modal neither platform
 * does that for us, and the sheet is not going to move to make the point.
 */
export function SheetForm({ children, action, contentStyle, actionStyle, actionPassThrough }: SheetFormProps) {
  const keyboardLift = useSheetKeyboardLift();
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const scrollY = useRef(0);
  const viewport = useRef(0);
  const [actionHeight, setActionHeight] = useState(0);

  /**
   * The strip along the bottom of the scroll view that is covered right now.
   *
   * The action bar is absolutely positioned at the scroll view's own bottom
   * edge and rises by `keyboardLift`, so it covers its height plus that lift.
   * A sheet with no `action` puts its button in BottomSheet's `footer` slot
   * instead (the search filters): that footer starts BELOW the scroll view, so
   * lifting it covers exactly `keyboardLift` of it — `actionHeight` is 0 and
   * the same expression is already right. Adding the footer's height on top of
   * that reserved it twice and left ~60dp of dead space under the last filter.
   */
  const covered = actionHeight + keyboardLift;

  /**
   * Read through a ref rather than closed over, so `reveal` keeps one identity
   * for the life of the form: the effect below must fire when the KEYBOARD
   * moves and at no other time. With `covered` as a dependency, an action bar
   * that grew (an error line appearing under a failed submit) re-ran it and
   * scrolled the form out from under the reader mid-typing.
   */
  const coveredRef = useRef(covered);
  useEffect(() => {
    coveredRef.current = covered;
  }, [covered]);

  const reveal = useCallback(() => {
    const field = TextInput.State.currentlyFocusedInput();
    const content = contentRef.current;
    if (!field || !content) return;
    // Measured against the content wrapper, so `y` is in content space and the
    // current scroll offset is what turns it into a position on screen.
    field.measureLayout(
      content,
      (_x, y, _width, height) => {
        const top = y - scrollY.current;
        const bottom = y + height - scrollY.current;
        const limit = viewport.current - coveredRef.current;
        let delta = 0;
        if (bottom > limit) delta = bottom - limit;
        else if (top < 0) delta = top;
        // A field taller than the gap left over would otherwise have its own
        // label scrolled off the top — never move more than it takes to get
        // the field's top to the top.
        if (delta > top) delta = top;
        // A few points of air so the field does not sit flush against the bar.
        if (delta > 0) delta += REVEAL_GAP;
        // The smallest move that clears them, never a centring jump.
        if (Math.abs(delta) < 1) return;
        scrollRef.current?.scrollTo({ y: Math.max(scrollY.current + delta, 0), animated: true });
      },
      () => {},
    );
  }, []);

  /**
   * The keyboard arrives after the focus event that summoned it, and can resize
   * under a field that is already focused (emoji panel, keyboard swap). This is
   * the only thing that may trigger a scroll while a field is focused, and it
   * runs at most once per keyboard transition — the sheet's source emits one
   * settled height per open/close, not one per animation frame, so one tap buys
   * one scroll animation. Anything that reports per-frame belongs behind a
   * settle check, or the reader watches the form stutter through 30 of them.
   */
  useEffect(() => {
    if (keyboardLift > 0) reveal();
  }, [keyboardLift, reveal]);

  /**
   * What a field calls when it gains focus. With no keyboard up yet there is
   * nothing to clear it of: the keyboard is on its way, and the effect above
   * reveals once it has arrived and the real overlap is known. Revealing here
   * too would scroll by the wrong amount first and the viewer would watch two
   * animations for one tap — which is the jumpiness this whole component
   * exists to remove. Moving BETWEEN fields with the keyboard already up is
   * the case this does handle, and there the overlap is already correct.
   */
  const revealOnFocus = useCallback(() => {
    if (keyboardLift <= 0) return;
    reveal();
  }, [keyboardLift, reveal]);

  return (
    <View style={styles.formRoot}>
      <ScrollView
        ref={scrollRef}
        style={styles.formScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // Dragging the fields is how you ask for more room, so it also puts the
        // keyboard away.
        keyboardDismissMode="on-drag"
        // A form is a fixed set of fields, not a browsing surface — the
        // rubber-band makes the sheet feel loose and drags the pinned action
        // away from the finger reaching for it.
        bounces={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
        }}
        onLayout={(event: LayoutChangeEvent) => {
          viewport.current = event.nativeEvent.layout.height;
        }}
      >
        <RevealContext.Provider value={revealOnFocus}>
          <View ref={contentRef} style={[contentStyle, { paddingBottom: covered + theme.spacing.lg }]}>
            {children}
          </View>
        </RevealContext.Provider>
      </ScrollView>

      {action ? (
        <View
          style={[styles.actionBar, actionStyle, keyboardLift > 0 && { transform: [{ translateY: -keyboardLift }] }]}
          pointerEvents={actionPassThrough ? "box-none" : "auto"}
          onLayout={(event: LayoutChangeEvent) => setActionHeight(event.nativeEvent.layout.height)}
        >
          {action}
        </View>
      ) : null}
    </View>
  );
}

interface FieldProps extends TextInputProps {
  /** Renders the value in large tracked tabular figures (the deposit's 6-digit reference). */
  numeric?: boolean;
  /** Static trailing unit, e.g. "Ks". */
  suffix?: string;
  /**
   * Adds the eye toggle to a `secureTextEntry` field. Same prop name as
   * `auth/AuthField` on purpose, so the app keeps ONE spelling for "let me see
   * what I typed"; a password field in a sheet gets this rather than AuthField
   * because only the fields here call `useRevealOnFocus`.
   */
  revealable?: boolean;
  /** Spoken label for that toggle while the value is hidden ("Show password"). */
  revealAccessibilityLabel?: string;
  /** …and while it is showing ("Hide password"), so the label names what the tap will do. */
  hideAccessibilityLabel?: string;
  /** Paints a 2pt red ring while the form is reporting an error for this field. */
  invalid?: boolean;
  /**
   * A borderless field: no fill, just a hairline under the value, flush with
   * the column's text edge. (The money flows used it before Marquee; kept for
   * any form that still wants it.)
   */
  flat?: boolean;
  /**
   * Handed straight to the TextInput, so a multi-field form can hop focus on
   * "next". Declared rather than relying on React 19's ref-as-a-prop, because
   * `TextInputProps` does not carry it and TypeScript would reject it.
   */
  ref?: Ref<TextInput>;
}

/**
 * The one text field of the sheet forms (Marquee): 56pt, radius 16, the raised
 * #1C1C23 fill, no border; a 2pt red ring when invalid. Never white.
 */
export function SheetInput({
  numeric,
  suffix,
  revealable,
  revealAccessibilityLabel,
  hideAccessibilityLabel,
  invalid,
  flat,
  secureTextEntry,
  editable = true,
  style,
  onFocus,
  ref,
  ...rest
}: FieldProps) {
  const reveal = useRevealOnFocus();
  const [revealed, setRevealed] = useState(false);
  const showToggle = !!revealable && !!secureTextEntry;

  return (
    <View
      style={[
        styles.inputShell,
        flat && styles.inputShellFlat,
        invalid && (flat ? styles.inputShellFlatInvalid : styles.inputShellInvalid),
        !editable && styles.inputShellDisabled,
      ]}
    >
      <TextInput
        ref={ref}
        placeholderTextColor={theme.colors.textFaint}
        {...rest}
        editable={editable}
        secureTextEntry={secureTextEntry && !revealed}
        onFocus={(event) => {
          reveal();
          onFocus?.(event);
        }}
        style={[styles.input, numeric && styles.inputNumeric, style]}
      />
      {showToggle ? (
        <Pressable
          onPress={() => setRevealed((value) => !value)}
          disabled={!editable}
          style={({ pressed }) => [styles.revealToggle, pressed && styles.pressed]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={revealed ? hideAccessibilityLabel : revealAccessibilityLabel}
          accessibilityState={{ selected: revealed }}
        >
          <Ionicons name={revealed ? "eye-off-outline" : "eye-outline"} size={20} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
      {suffix ? (
        <ThemedText variant="section" style={styles.suffix}>
          {suffix}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * The multi-line field — feedback messages, reader notes. Same flat raised
 * fill as `SheetInput` in a taller box, and the same bring-into-view on focus.
 */
export function SheetTextArea({ style, onFocus, ...rest }: TextInputProps) {
  const reveal = useRevealOnFocus();
  return (
    <TextInput
      placeholderTextColor={theme.colors.textFaint}
      multiline
      // Android centres multiline text vertically without this.
      textAlignVertical="top"
      {...rest}
      onFocus={(event) => {
        reveal();
        onFocus?.(event);
      }}
      style={[styles.textArea, style]}
    />
  );
}

/** The boards' amount figure: 52/64 Black. */
const AMOUNT_FONT = 52;
/** Never scale the amount past this much of the OS text size — a 52pt figure is already large. */
const AMOUNT_MAX_SCALE = 1.3;
/** Smallest the figure shrinks to while it fits a very long number on a narrow phone. */
const AMOUNT_MIN_FONT = 24;
/**
 * Advance widths in Noto Sans Myanmar Black with tabular figures, in em — a
 * digit ~0.6em, the comma ~0.3em (the -0.03em tracking only buys slack); "Ks"
 * in the 22pt ExtraBold unit ~1.2em. The slack covers the caret.
 */
const DIGIT_EM = 0.6;
const COMMA_EM = 0.3;
const CARET_SLACK_EM = 0.4;
const UNIT_EM = 1.2;
const UNIT_FONT = 22;
/** The unit sits 10pt from the figure. */
const UNIT_GAP = 10;

interface AmountFieldProps {
  label: string;
  /** The raw digits ("10000"); shown grouped ("10,000"). */
  value: string;
  /** Receives digits only — the separators are stripped here. */
  onChangeText: (digits: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  /** The form's current error is about the amount: the underline turns into a 2pt red rule. */
  invalid?: boolean;
}

/**
 * The money flows' amount input: a big borderless 52pt Black figure with "Ks"
 * beside it and a rule under both (2pt red while the amount is the error). The
 * state stays the raw digit string the validation always read; only the
 * display is grouped. The figure shrinks to fit rather than scrolling out of
 * sight, so an amount is never cut off.
 */
export function AmountField({
  label,
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  invalid,
}: AmountFieldProps) {
  const reveal = useRevealOnFocus();
  const { fontScale } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(0);
  // Past 15 digits a Number can no longer hold the value exactly, so the raw
  // digits are shown rather than a rounded figure the user never typed.
  const display = value === "" ? "" : value.length > 15 ? value : formatKyatNumber(Number(value));
  const scale = Math.min(fontScale, AMOUNT_MAX_SCALE);
  const target = AMOUNT_FONT * scale;
  const unitSize = UNIT_FONT * scale;
  const shown = display || placeholder;
  const commas = (shown.match(/,/g) ?? []).length;
  const ems = (shown.length - commas) * DIGIT_EM + commas * COMMA_EM + CARET_SLACK_EM;
  const room = rowWidth - unitSize * UNIT_EM - UNIT_GAP;
  const fontSize = rowWidth > 0 ? Math.max(AMOUNT_MIN_FONT, Math.min(target, Math.floor(room / ems))) : target;

  return (
    <View>
      <ThemedText variant="caption" weight="bold" style={styles.amountLabel}>
        {label}
      </ThemedText>
      <View
        style={[styles.amountRow, invalid && styles.amountRowInvalid]}
        onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
      >
        <TextInput
          value={display}
          onChangeText={(next) => onChangeText(next.replace(/\D/g, ""))}
          keyboardType="number-pad"
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textFaint}
          accessibilityLabel={accessibilityLabel}
          onFocus={reveal}
          // The size is computed above from the OS text size (capped), so the
          // platform must not scale it a second time.
          allowFontScaling={false}
          underlineColorAndroid="transparent"
          style={[
            styles.amountInput,
            { fontSize, lineHeight: Math.round(fontSize * 1.23), letterSpacing: -fontSize * 0.03 },
          ]}
        />
        <ThemedText
          maxFontSizeMultiplier={AMOUNT_MAX_SCALE}
          weight="extrabold"
          style={styles.amountUnit}
        >
          Ks
        </ThemedText>
      </View>
    </View>
  );
}

interface QuickAmountsProps {
  values: readonly number[];
  /** The current raw amount string — a chip lights up when it matches. */
  amount: string;
  onSelect: (value: number) => void;
  /**
   * 4 (default) = one row of four. 2 = a 2×2 grid, for narrow screens and
   * large text sizes, where four in one row would squeeze "50,000".
   */
  columns?: 2 | 4;
}

/**
 * Preset amounts — 44pt flat chips on the raised fill, radius 12; the picked
 * one turns white with near-black figures. The figure is shown without the
 * unit (the field above already says "Ks") and is spoken with it. A label may
 * wrap to a second line at the largest text sizes rather than being cut.
 */
export function QuickAmounts({ values, amount, onSelect, columns = 4 }: QuickAmountsProps) {
  return (
    <View style={[styles.quickGrid, columns === 2 && styles.quickGridWrap]}>
      {values.map((value) => {
        const selected = Number(amount) === value;
        return (
          <PressScale
            key={value}
            onPress={() => onSelect(value)}
            accessibilityRole="button"
            accessibilityLabel={formatKyat(value)}
            accessibilityState={{ selected }}
            style={[
              styles.quickButton,
              columns === 2 ? styles.quickButtonHalf : styles.quickButtonQuarter,
              selected && styles.quickButtonSelected,
            ]}
          >
            <ThemedText
              weight="extrabold"
              tabular
              numberOfLines={2}
              style={[styles.quickLabel, selected && styles.quickLabelSelected]}
            >
              {formatKyatNumber(value)}
            </ThemedText>
          </PressScale>
        );
      })}
    </View>
  );
}

/**
 * Quiet helper line under a field (limits, available balance, instructions).
 * `tone="muted"` lifts it from the faint ink to the readable muted one, for a
 * hint the user needs to act on; every other caller keeps the default.
 */
export function HelperText({
  children,
  tone = "faint",
  style,
}: {
  children: ReactNode;
  tone?: "faint" | "muted";
  style?: StyleProp<TextStyle>;
}) {
  return (
    <ThemedText
      variant="caption"
      weight="regular"
      tabular
      style={[styles.helper, tone === "muted" && styles.helperMuted, style]}
    >
      {children}
    </ThemedText>
  );
}

/**
 * Validation / submission failure — a soft red fill, no border (Marquee). It
 * sits in the pinned action row, so its spacing belongs to that row, not to
 * this box.
 */
export function ErrorNotice({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle-outline" size={18} color={theme.colors.danger} style={styles.errorIcon} />
      <ThemedText variant="caption" weight="semibold" tabular style={styles.errorText}>
        {message}
      </ThemedText>
    </View>
  );
}

/** The success disc's entrance: 0.7 → 1 with a fade, .42s ease-out (the boards' `.pop`). */
const POP_MS = 420;
const POP_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);

/**
 * Post-submit confirmation shown in place of the form: a green check on its
 * soft disc (it pops in, or simply appears under reduce motion), the title in
 * 24/30 ExtraBold and the body in 15/23.
 */
export function SheetSuccess({ title, body, haloSize = 88 }: { title: string; body: string; haloSize?: number }) {
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      pop.value = 1;
      return;
    }
    pop.value = withTiming(1, { duration: POP_MS, easing: POP_EASING });
  }, [pop, reduceMotion]);
  const popStyle = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ scale: 0.7 + 0.3 * pop.value }] }));

  return (
    <View style={styles.successBox}>
      <Animated.View
        style={[
          styles.successHalo,
          { width: haloSize, height: haloSize, borderRadius: haloSize / 2 },
          popStyle,
        ]}
      >
        <Ionicons name="checkmark" size={44} color={theme.colors.finance} />
      </Animated.View>
      <ThemedText variant="title" accessibilityRole="header" style={[styles.center, styles.successTitle]}>
        {title}
      </ThemedText>
      <ThemedText style={[styles.center, styles.successBody]}>{body}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  formRoot: { flex: 1 },
  formScroll: { flex: 1 },
  /**
   * Out of the column flow on purpose — in it, the keyboard inset would shrink
   * the scroll view above. The hairline is what tells you the fields keep
   * scrolling underneath, and the fill is the sheet's own (#121217), so they
   * do it out of sight instead of showing through.
   */
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 16,
    // Always 2pt, clear at rest: the invalid ring then costs no layout shift.
    borderWidth: 2,
    borderColor: "transparent",
    paddingHorizontal: theme.spacing.md - 2,
    minHeight: 56,
  },
  inputShellFlat: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.tonalStrong,
    paddingHorizontal: 0,
    minHeight: 48,
  },
  inputShellInvalid: { borderColor: theme.colors.danger },
  inputShellFlatInvalid: { borderBottomWidth: 2, borderBottomColor: theme.colors.danger },
  inputShellDisabled: { opacity: 0.6 },
  /** Full 44pt target, pulled into the shell's right padding so the box keeps its shape. */
  revealToggle: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    marginRight: -10,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    color: theme.colors.text,
    fontFamily: theme.font.regular,
    fontSize: 16,
  },
  /** DepositStep2's reference: 24pt ExtraBold, tracked 0.24em so six digits read one by one. */
  inputNumeric: { ...tabularNums, fontFamily: theme.font.extrabold, fontSize: 24, letterSpacing: 5.5 },
  textArea: {
    minHeight: 132,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 16,
    paddingHorizontal: theme.spacing.md,
    paddingTop: 14,
    paddingBottom: 14,
    color: theme.colors.text,
    fontFamily: theme.font.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  suffix: { color: theme.colors.textFaint },
  amountLabel: { color: theme.colors.textMuted },
  /** The rule under the figure and its unit — the field's only outline. */
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: UNIT_GAP,
    minHeight: 64,
    marginTop: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.tonalStrong,
  },
  amountRowInvalid: { borderBottomWidth: 2, borderBottomColor: theme.colors.danger },
  amountInput: {
    ...tabularNums,
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    color: theme.colors.text,
    fontFamily: theme.font.black,
  },
  amountUnit: { fontSize: UNIT_FONT, lineHeight: 28, color: theme.colors.textFaint },
  quickGrid: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.md },
  quickGridWrap: { flexWrap: "wrap" },
  quickButton: {
    minHeight: theme.layout.minTouch,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  quickButtonQuarter: { flex: 1 },
  /** Two per row: a basis just under half (the 8pt gap takes the rest), then grow to fill. */
  quickButtonHalf: { flexGrow: 1, flexBasis: "46%" },
  quickButtonSelected: { backgroundColor: theme.colors.play },
  quickLabel: { fontSize: 14, color: theme.colors.text, textAlign: "center" },
  quickLabelSelected: { color: theme.colors.onPlay },
  helper: { color: theme.colors.textFaint, marginTop: 6 },
  helperMuted: { color: theme.colors.textMuted },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.button,
    backgroundColor: withAlpha(theme.colors.danger, 0.12),
  },
  errorIcon: { marginTop: 0 },
  errorText: { flex: 1, color: theme.colors.danger },
  pressed: { opacity: 0.75 },
  successBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: theme.spacing.xl,
  },
  successHalo: {
    backgroundColor: withAlpha(theme.colors.finance, 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
  successTitle: { marginTop: theme.spacing.lg },
  successBody: { marginTop: 10, maxWidth: 330, color: theme.colors.textBody },
});
