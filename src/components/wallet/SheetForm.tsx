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
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { useSheetKeyboardLift } from "@/components/ui/BottomSheet";
import { Chip } from "@/components/common/Chip";
import { MethodLogo } from "@/components/wallet/MethodLogo";
import { formatKyat } from "@/utils/currency";
import { tabularNums, theme } from "@/theme";

/**
 * The form vocabulary of the app's bottom-sheet forms — one set of labels,
 * fields, quick-amount chips, method tiles and helper/error lines, so every
 * sheet form looks and behaves identically. Purely presentational: every value
 * and handler is owned by the sheet that renders these.
 *
 * `QuickAmounts`, `MethodGrid` and `SheetInput`'s `numeric`/`suffix` modes are
 * money-specific and belong to the deposit/withdraw sheets; `SheetForm`,
 * `FieldLabel`, `SheetTextArea`, `HelperText`, `ErrorNotice` and `SheetSuccess`
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
export function SheetForm({ children, action, contentStyle }: SheetFormProps) {
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
          style={[styles.actionBar, keyboardLift > 0 && { transform: [{ translateY: -keyboardLift }] }]}
          onLayout={(event: LayoutChangeEvent) => setActionHeight(event.nativeEvent.layout.height)}
        >
          {action}
        </View>
      ) : null}
    </View>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <ThemedText variant="label" style={styles.fieldLabel}>
      {children}
    </ThemedText>
  );
}

interface FieldProps extends TextInputProps {
  /** Renders the value with tabular figures at hero size (amount fields). */
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
  /** Paints the ring red while the form is reporting an error for this field. */
  invalid?: boolean;
  /**
   * Handed straight to the TextInput, so a multi-field form can hop focus on
   * "next". Declared rather than relying on React 19's ref-as-a-prop, because
   * `TextInputProps` does not carry it and TypeScript would reject it.
   */
  ref?: Ref<TextInput>;
}

/** The one text field of the money sheets — 52pt tall, themed, never white. */
export function SheetInput({
  numeric,
  suffix,
  revealable,
  revealAccessibilityLabel,
  hideAccessibilityLabel,
  invalid,
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
    <View style={[styles.inputShell, invalid && styles.inputShellInvalid, !editable && styles.inputShellDisabled]}>
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
 * A validation message that belongs to ONE field, rendered directly under it —
 * unlike `ErrorNotice`, which rides with the pinned submit and speaks for the
 * whole form. A three-field password form needs both: "too short" has to point
 * at the field it is about.
 */
export function FieldError({ children }: { children: ReactNode }) {
  return (
    <ThemedText variant="caption" weight="semibold" style={styles.fieldError}>
      {children}
    </ThemedText>
  );
}

/**
 * The multi-line field — feedback messages, reader notes. Same shell as
 * `SheetInput` in a taller box, and the same bring-into-view on focus.
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

interface QuickAmountsProps {
  values: readonly number[];
  /** The current raw amount string — a chip lights up when it matches. */
  amount: string;
  onSelect: (value: number) => void;
}

/**
 * Preset top-up amounts — the shared `common/Chip`, so a money sheet's
 * selection reads exactly like a filter chip elsewhere in the app (quiet
 * elevated fill unselected, solid violet when picked). Each is a 44pt target.
 */
export function QuickAmounts({ values, amount, onSelect }: QuickAmountsProps) {
  return (
    <View style={styles.chipsRow}>
      {values.map((value) => (
        <Chip
          key={value}
          label={formatKyat(value)}
          selected={Number(amount) === value}
          onPress={() => onSelect(value)}
          style={styles.quickChip}
        />
      ))}
    </View>
  );
}

export interface MethodOption {
  key: string;
  label: string;
  logoUrl: string | null;
}

interface MethodGridProps {
  options: MethodOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

/**
 * Two-column payment-method picker. A tile is a chip with a logo, so it wears
 * the shared `common/Chip` selection language: elevated + hairline border when
 * idle, solid violet with near-black ink when picked.
 */
export function MethodGrid({ options, selectedKey, onSelect }: MethodGridProps) {
  return (
    <View style={styles.methodGrid}>
      {options.map((option) => {
        const active = selectedKey === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            style={({ pressed }) => [styles.methodTile, active && styles.methodTileActive, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
          >
            <MethodLogo logoUrl={option.logoUrl} size={30} />
            <ThemedText
              variant="caption"
              weight={active ? "bold" : "semibold"}
              numberOfLines={1}
              style={active ? styles.methodTextActive : styles.methodText}
            >
              {option.label}
            </ThemedText>
            {active ? (
              <View style={styles.methodCheck}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.onPrimary} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Quiet helper line under a field (limits, available balance, instructions). */
export function HelperText({ children }: { children: ReactNode }) {
  return (
    <ThemedText variant="caption" tabular style={styles.helper}>
      {children}
    </ThemedText>
  );
}

/**
 * Validation / submission failure — the only red in the sheet. It sits in the
 * pinned action row, so its spacing belongs to that row, not to this box.
 */
export function ErrorNotice({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
      <ThemedText variant="caption" weight="semibold" style={styles.errorText}>
        {message}
      </ThemedText>
    </View>
  );
}

/** Post-submit confirmation shown in place of the form. */
export function SheetSuccess({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.successBox}>
      <View style={styles.successHalo}>
        <Ionicons name="checkmark-circle" size={44} color={theme.colors.finance} />
      </View>
      <ThemedText variant="title" style={styles.center}>
        {title}
      </ThemedText>
      <ThemedText variant="muted" style={[styles.center, styles.successBody]}>
        {body}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  formRoot: { flex: 1 },
  formScroll: { flex: 1 },
  /**
   * Out of the column flow on purpose — in it, the keyboard inset would shrink
   * the scroll view above. The hairline is what tells you the fields keep
   * scrolling underneath, and the fill is the sheet's own, so they do it out of
   * sight instead of showing through.
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
    backgroundColor: theme.colors.popover,
  },
  fieldLabel: { marginTop: theme.spacing.md, marginBottom: theme.spacing.xs },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    minHeight: 52,
  },
  inputShellInvalid: { borderColor: theme.colors.danger + "8C" },
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
  inputNumeric: { ...tabularNums, fontFamily: theme.font.bold, fontSize: 22, letterSpacing: 0.2 },
  textArea: {
    minHeight: 132,
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    color: theme.colors.text,
    fontFamily: theme.font.regular,
    fontSize: 15,
    lineHeight: 21,
  },
  suffix: { color: theme.colors.textFaint },
  chipsRow: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  /** Four presets share the row, so the shared chip stretches instead of hugging. */
  quickChip: { flex: 1, alignSelf: "stretch", paddingHorizontal: 6 },
  methodGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  methodTile: {
    flexGrow: 1,
    flexBasis: "45%",
    minHeight: 84,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  methodTileActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  methodText: { color: theme.colors.textMuted },
  methodTextActive: { color: theme.colors.onPrimary },
  methodCheck: { position: "absolute", top: 6, right: 6 },
  helper: { color: theme.colors.textFaint, marginTop: 6 },
  /** Sits exactly where HelperText would, so a field swapping hint for error does not jump. */
  fieldError: { color: theme.colors.danger, marginTop: 6 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.sm + 2,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: theme.colors.danger + "3D",
  },
  errorText: { flex: 1, color: theme.colors.danger },
  pressed: { opacity: 0.75 },
  successBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  successHalo: {
    width: 84,
    height: 84,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.financeSoft,
    borderWidth: 1,
    borderColor: theme.colors.finance + "33",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xs,
  },
  center: { textAlign: "center" },
  successBody: { maxWidth: 320 },
});
